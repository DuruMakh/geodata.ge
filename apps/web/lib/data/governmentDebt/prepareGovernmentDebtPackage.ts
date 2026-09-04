import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { csvEscape } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readPdfPages, requirePageMarker } from "./pdfText";
import {
  parseActualDebtService,
  parseDomesticServiceOverlapControls,
  parseDebtServiceForecast,
  parseGovernmentDebtStock,
  parseGovernmentDebtStockOverlapSources,
  parseInterestRateGrid,
  parsePublishedGovernmentDebtGdpRatios,
  readControlWorkbookValues,
} from "./parseDebtSources";
import { validateGovernmentDebtSourceManifest } from "./sourceManifest";
import { GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS } from "./types";
import type {
  DebtScope,
  GovernmentDebtActualServiceRow,
  GovernmentDebtActualServiceOverlapComparison,
  GovernmentDebtControlComparison,
  GovernmentDebtForecastRow,
  GovernmentDebtForecastCheck,
  GovernmentDebtGdpShareCheck,
  GovernmentDebtInterestRateCheck,
  GovernmentDebtInterestRateRow,
  GovernmentDebtPackageBuild,
  GovernmentDebtRateGap,
  GovernmentDebtSourceId,
  GovernmentDebtStockRow,
  GovernmentDebtStockOverlapComparison,
  GovernmentDebtValidationReport,
  SourceManifestRow,
} from "./types";

type CsvRow = Record<string, string>;

const ARTIFACT_LABEL = "government debt";
const REVIEW_DATE = "2026-09-01" as const;
const SCOPES: DebtScope[] = ["total", "domestic", "external"];

type ExpectedRateControl = {
  value: number | null;
  sourceId: GovernmentDebtSourceId | "";
};

const TOTAL_RATE_VALUES = [3.1, 3.3, 3.2, 3.3, 3.2, 2.8, 2.5, 3.9, 5, 4.9, 4.7];
const DOMESTIC_RATE_VALUES = new Map<number, [number, GovernmentDebtSourceId]>([
  [2018, [8.3, "mof_debt_strategy_2019_2021"]],
  [2019, [8.21, "mof_debt_strategy_2022_2025"]],
  [2020, [8.59, "mof_debt_strategy_2022_2025"]],
  [2021, [8.83, "mof_debt_strategy_2023_2026"]],
  [2022, [9.2, "mof_debt_strategy_2023_2026"]],
  [2023, [9.06, "mof_debt_strategy_2025_2029"]],
  [2024, [8.84, "mof_debt_strategy_2025_2029"]],
]);
const EXTERNAL_RATE_VALUES = new Map<number, [number, GovernmentDebtSourceId]>([
  [2021, [0.95, "mof_debt_strategy_2023_2026"]],
  [2022, [2.23, "mof_debt_strategy_2023_2026"]],
  [2023, [3.4, "mof_debt_strategy_2025_2029"]],
  [2024, [3.12, "mof_debt_strategy_2025_2029"]],
]);

function expectedRateControl(
  year: number,
  scope: DebtScope,
): ExpectedRateControl {
  if (scope === "total") {
    return {
      value: TOTAL_RATE_VALUES[year - 2015]!,
      sourceId: "mof_monthly_debt_report_2026_07",
    };
  }
  const available =
    scope === "domestic"
      ? DOMESTIC_RATE_VALUES.get(year)
      : EXTERNAL_RATE_VALUES.get(year);
  if (available) return { value: available[0], sourceId: available[1] };
  if (scope === "external" && year === 2018) {
    return { value: null, sourceId: "mof_debt_strategy_2019_2021" };
  }
  if (scope === "external" && (year === 2019 || year === 2020)) {
    return { value: null, sourceId: "mof_debt_strategy_2022_2025" };
  }
  return { value: null, sourceId: "" };
}

const FORECAST_SOURCE_CONTROLS = [
  {
    year: 2026,
    externalPrincipal: 1010.9,
    externalInterest: 237.6,
    domesticPrincipal: 822.211,
    domesticInterest: 973.4,
    domesticService: 1795.6,
  },
  {
    year: 2027,
    externalPrincipal: 512.6,
    externalInterest: 218.3,
    domesticPrincipal: 1539.249,
    domesticInterest: 879.1,
    domesticService: 2418.3,
  },
  {
    year: 2028,
    externalPrincipal: 526.5,
    externalInterest: 207,
    domesticPrincipal: 2833.611,
    domesticInterest: 669.4,
    domesticService: 3503,
  },
  {
    year: 2029,
    externalPrincipal: 521.3,
    externalInterest: 194.4,
    domesticPrincipal: 1413.474,
    domesticInterest: 536.5,
    domesticService: 1950,
  },
  {
    year: 2030,
    externalPrincipal: 508.9,
    externalInterest: 181.5,
    domesticPrincipal: 1516.849,
    domesticInterest: 342.3,
    domesticService: 1859.1,
  },
] as const;

const STOCK_HEADERS: Array<keyof GovernmentDebtStockRow> = [
  "year",
  "debt_scope",
  "amount_million_gel",
  "amount_gel",
  "observation_date",
  "status",
  "source_id",
  "source_table",
  "source_row_label",
  "source_unit",
  "transformation",
  "methodology_note_id",
  "last_reviewed_at",
];

const RATE_HEADERS: Array<keyof GovernmentDebtInterestRateRow> = [
  "year",
  "debt_scope",
  "weighted_average_interest_rate_percent",
  "observation_date",
  "portfolio_scope",
  "rate_definition",
  "availability_status",
  "source_id",
  "source_table",
  "source_row_label",
  "source_unit",
  "transformation",
  "last_reviewed_at",
];

const ACTUAL_SERVICE_HEADERS: Array<keyof GovernmentDebtActualServiceRow> = [
  "year",
  "debt_scope",
  "principal_paid_million_gel",
  "interest_paid_million_gel",
  "principal_paid_gel",
  "interest_paid_gel",
  "status",
  "source_id",
  "source_table",
  "source_row_label",
  "source_unit",
  "transformation",
  "methodology_note_id",
  "last_reviewed_at",
];

const FORECAST_HEADERS: Array<keyof GovernmentDebtForecastRow> = [
  "snapshot_date",
  "payment_year",
  "debt_scope",
  "principal_source_amount",
  "interest_source_amount",
  "source_currency",
  "published_exchange_rate",
  "published_exchange_rate_definition",
  "source_exchange_rate_to_gel",
  "principal_million_gel",
  "interest_million_gel",
  "total_service_million_gel",
  "status",
  "coverage_note",
  "source_id",
  "source_table",
  "source_row_label",
  "transformation",
  "last_reviewed_at",
];

export type GovernmentDebtPackagePaths = ReturnType<typeof packagePaths>;

function packagePaths() {
  const repoRoot = path.resolve(process.cwd(), "../..");
  const packageDir = path.join(
    repoRoot,
    "docs/Raw Data/Debt/government-debt-annual",
  );
  const officialDir = path.join(packageDir, "official");
  return {
    repoRoot,
    packageDir,
    officialDir,
    manifest: path.join(packageDir, "source-manifest.csv"),
    methodologyNotes: path.join(packageDir, "methodology-notes.csv"),
    gdp: path.join(repoRoot, "data/imports/national-gdp-annual-1996-2025.csv"),
    n7: path.join(officialDir, "public-debt-bulletin-n7.pdf"),
    n13: path.join(officialDir, "public-debt-bulletin-n13.pdf"),
    n19: path.join(officialDir, "public-debt-bulletin-n19.pdf"),
    n25: path.join(officialDir, "public-debt-bulletin-n25.pdf"),
    monthly: path.join(officialDir, "monthly-debt-report-2026-07.pdf"),
    strategy2019: path.join(
      officialDir,
      "debt-management-strategy-2019-2021.pdf",
    ),
    strategy2022: path.join(
      officialDir,
      "debt-management-strategy-2022-2025.pdf",
    ),
    strategy2023: path.join(
      officialDir,
      "debt-management-strategy-2023-2026.pdf",
    ),
    strategy2025: path.join(
      officialDir,
      "debt-management-strategy-2025-2029.pdf",
    ),
    controlWorkbook: path.join(
      officialDir,
      "central-government-debt-liabilities-control.xlsx",
    ),
    stockOutput: path.join(
      packageDir,
      "government-debt-stock-annual-2013-2025.csv",
    ),
    rateOutput: path.join(
      packageDir,
      "government-debt-interest-rates-annual-2015-2025.csv",
    ),
    actualServiceOutput: path.join(
      packageDir,
      "government-debt-service-actual-annual-2013-2025.csv",
    ),
    forecastOutput: path.join(
      packageDir,
      "government-debt-service-forecast-2026-2030.csv",
    ),
    validationOutput: path.join(packageDir, "validation-report.json"),
  };
}

function parseCsv(text: string): CsvRow[] {
  return parse(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];
}

async function readManifest(filePath: string): Promise<SourceManifestRow[]> {
  const rows = parseCsv(await fs.readFile(filePath, "utf8"));
  await validateGovernmentDebtSourceManifest(rows);
  return rows as SourceManifestRow[];
}

const METHODOLOGY_NOTE_HEADERS = [
  "methodology_note_id",
  "effective_date",
  "affected_dataset",
  "affected_scope",
  "note_ka",
  "note_en",
  "source_id",
] as const;

const APPROVED_METHODOLOGY_NOTES: CsvRow[] = [
  {
    methodology_note_id: "government-domestic-2019-budget-organizations",
    effective_date: "2019-01-01",
    affected_dataset: "stock|actual_service",
    affected_scope: "domestic",
    note_ka:
      "2019 წლიდან მთავრობის საშინაო ვალი დამატებით მოიცავს საბიუჯეტო ორგანიზაციების სესხის სახით არსებულ ვალს.",
    note_en:
      "From 2019, domestic Government Debt additionally includes loan debt owed by budgetary organizations.",
    source_id: "mof_public_debt_bulletin_n25",
  },
  {
    methodology_note_id: "government-domestic-2022-general-government-soes",
    effective_date: "2022-12-31",
    affected_dataset: "stock|actual_service",
    affected_scope: "domestic",
    note_ka:
      "2022 წლის დეკემბრიდან გათვალისწინებულია სამთავრობო სექტორის სახელმწიფო საწარმოების სესხის სახით არსებული ვალიც.",
    note_en:
      "From December 2022, domestic Government Debt also includes loan debt of state-owned enterprises classified in general government.",
    source_id: "mof_public_debt_bulletin_n25",
  },
];

export function validateGovernmentDebtMethodologyNotes(
  rows: CsvRow[],
): true {
  if (
    rows.length !== APPROVED_METHODOLOGY_NOTES.length ||
    rows.some(
      (row) =>
        Object.keys(row).join(",") !== METHODOLOGY_NOTE_HEADERS.join(","),
    )
  ) {
    throw new Error("Methodology notes do not match the approved schema");
  }
  if (
    rows.some((row, index) =>
      METHODOLOGY_NOTE_HEADERS.some(
        (header) => row[header] !== APPROVED_METHODOLOGY_NOTES[index]![header],
      ),
    )
  ) {
    throw new Error("Methodology notes do not match the approved values");
  }
  return true;
}

async function validateMethodologyNotes(filePath: string): Promise<void> {
  validateGovernmentDebtMethodologyNotes(
    parseCsv(await fs.readFile(filePath, "utf8")),
  );
}

type ApprovedSourcePages = {
  n7Page32: string;
  n13Page31: string;
  n13Page32: string;
  n19Page34: string;
  n19Page35: string;
  n25Page7: string;
  n25Page17: string;
  n25Page20: string;
  n25Page22: string;
  n25Page24: string;
  n25Page26: string;
  n25Page27: string;
  n25Page28: string;
  monthlyPage3: string;
  strategy2019Page14: string;
  strategy2022Page23: string;
  strategy2023Page24: string;
  strategy2025Page28: string;
};

async function loadApprovedPages(
  paths: GovernmentDebtPackagePaths,
): Promise<ApprovedSourcePages> {
  const [n7, n13, n19, n25, monthly, strategy2019, strategy2022, strategy2023, strategy2025] =
    await Promise.all([
      readPdfPages(paths.n7, [32]),
      readPdfPages(paths.n13, [31, 32]),
      readPdfPages(paths.n19, [34, 35]),
      readPdfPages(paths.n25, [7, 17, 20, 22, 24, 26, 27, 28]),
      readPdfPages(paths.monthly, [3]),
      readPdfPages(paths.strategy2019, [14]),
      readPdfPages(paths.strategy2022, [23]),
      readPdfPages(paths.strategy2023, [24]),
      readPdfPages(paths.strategy2025, [28]),
    ]);

  return {
    n7Page32: requirePageMarker(
      n7,
      32,
      "NET",
    ),
    n13Page31: requirePageMarker(n13, 31, "PUBLIC DEBT STOCK"),
    n13Page32: requirePageMarker(n13, 32, "NET FLOWS & NET TRANSFERS"),
    n19Page34: requirePageMarker(n19, 34, "PUBLIC DEBT STOCK"),
    n19Page35: requirePageMarker(n19, 35, "NET FLOWS & NET TRANSFERS"),
    n25Page7: requirePageMarker(n25, 7, "Exchange Rates"),
    n25Page17: requirePageMarker(n25, 17, "Projected External Public Debt Service"),
    n25Page20: requirePageMarker(n25, 20, "Debt Service"),
    n25Page22: requirePageMarker(n25, 22, "T-Bills/T-Bonds Service"),
    n25Page24: requirePageMarker(n25, 24, "Treasury Securities Portfolio"),
    n25Page26: requirePageMarker(n25, 26, "Public Debt Stock"),
    n25Page27: requirePageMarker(n25, 27, "Net Flows & Net Transfers"),
    n25Page28: requirePageMarker(n25, 28, "Public Debt Indicators"),
    monthlyPage3: requirePageMarker(monthly, 3, "ATM and Interest Rate"),
    strategy2019Page14: requirePageMarker(
      strategy2019,
      14,
      "Weighted Average Interest Rates",
    ),
    strategy2022Page23: requirePageMarker(
      strategy2022,
      23,
      "Weighted Average Interest Rates",
    ),
    strategy2023Page24: requirePageMarker(
      strategy2023,
      24,
      "Weighted Average Interest Rates",
    ),
    strategy2025Page28: requirePageMarker(
      strategy2025,
      28,
      "Weighted Average Interest Rates",
    ),
  };
}

function key(year: number, scope: DebtScope): string {
  return `${year}:${scope}`;
}

function assertClose(actual: number, expected: number, context: string): void {
  if (Math.abs(actual - expected) > 1e-8) {
    throw new Error(`${context} does not reconcile: ${actual} vs ${expected}`);
  }
}

function validateAnnualPanel<T extends { year: number; debt_scope: DebtScope }>(
  rows: T[],
  firstYear: number,
  lastYear: number,
  context: string,
): void {
  const expectedYears = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );
  if (rows.length !== expectedYears.length * SCOPES.length) {
    throw new Error(`Unexpected ${context} row count: ${rows.length}`);
  }
  const keys = rows.map((row) => key(row.year, row.debt_scope));
  if (new Set(keys).size !== keys.length) {
    throw new Error(`Duplicate ${context} year/scope key`);
  }
  for (const year of expectedYears) {
    if (SCOPES.some((scope) => !keys.includes(key(year, scope)))) {
      throw new Error(`Missing ${context} scope for ${year}`);
    }
  }
}

function validateStock(rows: GovernmentDebtStockRow[]): void {
  validateAnnualPanel(rows, 2013, 2025, "stock");
  for (let year = 2013; year <= 2025; year += 1) {
    const byScope = new Map(
      rows.filter((row) => row.year === year).map((row) => [row.debt_scope, row]),
    );
    const total = byScope.get("total")!;
    const domestic = byScope.get("domestic")!;
    const external = byScope.get("external")!;
    assertClose(
      total.amount_million_gel,
      domestic.amount_million_gel + external.amount_million_gel,
      `Stock total for ${year}`,
    );
    for (const row of byScope.values()) {
      if (
        row.amount_million_gel < 0 ||
        row.amount_gel !== Math.round(row.amount_million_gel * 1_000_000)
      ) {
        throw new Error(`Invalid stock value for ${year}:${row.debt_scope}`);
      }
    }
  }
}

function validateActualService(rows: GovernmentDebtActualServiceRow[]): void {
  validateAnnualPanel(rows, 2013, 2025, "actual service");
  for (let year = 2013; year <= 2025; year += 1) {
    const byScope = new Map(
      rows.filter((row) => row.year === year).map((row) => [row.debt_scope, row]),
    );
    const total = byScope.get("total")!;
    const domestic = byScope.get("domestic")!;
    const external = byScope.get("external")!;
    assertClose(
      total.principal_paid_million_gel,
      domestic.principal_paid_million_gel + external.principal_paid_million_gel,
      `Actual principal total for ${year}`,
    );
    assertClose(
      total.interest_paid_million_gel,
      domestic.interest_paid_million_gel + external.interest_paid_million_gel,
      `Actual interest total for ${year}`,
    );
  }
}

function validateInterestRates(
  rows: GovernmentDebtInterestRateRow[],
): {
  gaps: GovernmentDebtRateGap[];
  checks: GovernmentDebtInterestRateCheck[];
} {
  validateAnnualPanel(rows, 2015, 2025, "interest rate");
  const checks = rows.map((row): GovernmentDebtInterestRateCheck => {
    const expected = expectedRateControl(row.year, row.debt_scope);
    const expectedStatus =
      expected.value === null
        ? ("not_found_in_reviewed_sources" as const)
        : ("available" as const);
    const observed = row.weighted_average_interest_rate_percent;
    const difference =
      expected.value === null || observed === null
        ? null
        : Number((observed - expected.value).toFixed(10));
    const valueMatches =
      expected.value === null
        ? observed === null
        : observed !== null && Math.abs(observed - expected.value) <= 1e-10;
    const status =
      valueMatches &&
      row.availability_status === expectedStatus &&
      row.source_id === expected.sourceId &&
      (observed === null || (Number.isFinite(observed) && observed >= 0))
        ? "pass"
        : "fail";
    return {
      check_id: `interest_rate_${row.year}_${row.debt_scope}`,
      year: row.year,
      debt_scope: row.debt_scope,
      expected_value: expected.value,
      observed_value: observed,
      difference,
      tolerance: 1e-10,
      expected_availability_status: expectedStatus,
      observed_availability_status: row.availability_status,
      expected_source_id: expected.sourceId,
      observed_source_id: row.source_id,
      source_reference: row.source_id
        ? `${row.source_id} | ${row.source_table} | ${row.source_row_label}`
        : `Reviewed sources: ${GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS.join("|")}`,
      status,
    };
  });
  const gaps = rows
    .filter(
      (row): row is GovernmentDebtInterestRateRow & {
        availability_status: GovernmentDebtRateGap["availability_status"];
      } => row.availability_status !== "available",
    )
    .map((row) => ({
      year: row.year,
      debt_scope: row.debt_scope,
      availability_status: row.availability_status,
      source_id: row.source_id,
      reviewed_source_ids: row.source_id
        ? [row.source_id]
        : [...GOVERNMENT_DEBT_REVIEWED_RATE_SOURCE_IDS],
      reason: row.transformation,
    }));
  const failedCheck = checks.find((check) => check.status === "fail");
  if (failedCheck || gaps.length !== 11) {
    throw new Error(
      `Interest-rate control failed: ${failedCheck?.check_id ?? "gap_count"}`,
    );
  }
  return { gaps, checks };
}

function validateForecast(
  rows: GovernmentDebtForecastRow[],
): GovernmentDebtForecastCheck[] {
  if (
    rows.length !== 15 ||
    new Set(rows.map((row) => `${row.payment_year}:${row.debt_scope}`)).size !==
      15
  ) {
    throw new Error("Forecast does not contain the approved 15-row grid");
  }
  const numericFields: Array<keyof GovernmentDebtForecastRow> = [
    "principal_source_amount",
    "interest_source_amount",
    "published_exchange_rate",
    "source_exchange_rate_to_gel",
    "principal_million_gel",
    "interest_million_gel",
    "total_service_million_gel",
  ];
  for (const row of rows) {
    if (
      row.source_id !== "mof_public_debt_bulletin_n25" ||
      row.snapshot_date !== "2025-12-31" ||
      row.status !== "projection_existing_portfolio" ||
      numericFields.some((field) => {
        const value = row[field];
        return typeof value !== "number" || !Number.isFinite(value) || value < 0;
      })
    ) {
      throw new Error(
        `Invalid forecast source/value for ${row.payment_year}:${row.debt_scope}`,
      );
    }
  }
  const checks: GovernmentDebtForecastCheck[] = [];
  for (let year = 2026; year <= 2030; year += 1) {
    const byScope = new Map(
      rows
        .filter((row) => row.payment_year === year)
        .map((row) => [row.debt_scope, row]),
    );
    const total = byScope.get("total")!;
    const domestic = byScope.get("domestic")!;
    const external = byScope.get("external")!;
    if (!total || !domestic || !external) {
      throw new Error(`Missing forecast scope for ${year}`);
    }
    assertClose(
      total.principal_million_gel,
      domestic.principal_million_gel + external.principal_million_gel,
      `Forecast principal total for ${year}`,
    );
    assertClose(
      total.interest_million_gel,
      domestic.interest_million_gel + external.interest_million_gel,
      `Forecast interest total for ${year}`,
    );
    assertClose(
      total.total_service_million_gel,
      domestic.total_service_million_gel + external.total_service_million_gel,
      `Forecast service total for ${year}`,
    );
    if (
      Number(
        (domestic.principal_million_gel + domestic.interest_million_gel).toFixed(
          1,
        ),
      ) !== domestic.total_service_million_gel
    ) {
      throw new Error(`Domestic forecast service does not reconcile for ${year}`);
    }

    const control = FORECAST_SOURCE_CONTROLS.find(
      (candidate) => candidate.year === year,
    )!;
    const controlFields: Array<{
      checkId: string;
      scope: "domestic" | "external";
      field: string;
      expected: number;
      observed: number;
      row: GovernmentDebtForecastRow;
    }> = [
      {
        checkId: `forecast_${year}_external_principal_usd`,
        scope: "external",
        field: "principal_source_amount",
        expected: control.externalPrincipal,
        observed: external.principal_source_amount,
        row: external,
      },
      {
        checkId: `forecast_${year}_external_interest_usd`,
        scope: "external",
        field: "interest_source_amount",
        expected: control.externalInterest,
        observed: external.interest_source_amount,
        row: external,
      },
      {
        checkId: `forecast_${year}_external_exchange_rate_usd_per_gel`,
        scope: "external",
        field: "published_exchange_rate",
        expected: 0.371,
        observed: external.published_exchange_rate,
        row: external,
      },
      {
        checkId: `forecast_${year}_domestic_principal_gel`,
        scope: "domestic",
        field: "principal_source_amount",
        expected: control.domesticPrincipal,
        observed: domestic.principal_source_amount,
        row: domestic,
      },
      {
        checkId: `forecast_${year}_domestic_interest_gel`,
        scope: "domestic",
        field: "interest_source_amount",
        expected: control.domesticInterest,
        observed: domestic.interest_source_amount,
        row: domestic,
      },
      {
        checkId: `forecast_${year}_domestic_total_service_gel`,
        scope: "domestic",
        field: "total_service_million_gel",
        expected: control.domesticService,
        observed: domestic.total_service_million_gel,
        row: domestic,
      },
    ];
    checks.push(
      ...controlFields.map((field): GovernmentDebtForecastCheck => {
        const difference = Number(
          (field.observed - field.expected).toFixed(10),
        );
        return {
          check_id: field.checkId,
          year,
          debt_scope: field.scope,
          field: field.field,
          expected_value: field.expected,
          observed_value: field.observed,
          difference,
          tolerance: 1e-10,
          expected_source_id: "mof_public_debt_bulletin_n25",
          observed_source_id: field.row.source_id,
          source_reference: `${field.row.source_id} | ${field.row.source_table} | ${field.row.source_row_label}`,
          status:
            Math.abs(difference) <= 1e-10 &&
            field.row.source_id === "mof_public_debt_bulletin_n25"
              ? "pass"
              : "fail",
        };
      }),
    );
  }
  const failedCheck = checks.find((check) => check.status === "fail");
  if (failedCheck) {
    throw new Error(`Forecast source control failed: ${failedCheck.check_id}`);
  }
  return checks;
}

export function validateGovernmentDebtInterestRates(
  rows: GovernmentDebtInterestRateRow[],
): ReturnType<typeof validateInterestRates> {
  return validateInterestRates(rows);
}

export function validateGovernmentDebtForecast(
  rows: GovernmentDebtForecastRow[],
): GovernmentDebtForecastCheck[] {
  return validateForecast(rows);
}

async function gdpShareChecks(
  gdpPath: string,
  stockRows: GovernmentDebtStockRow[],
  publishedRatios: Map<number, number>,
): Promise<GovernmentDebtGdpShareCheck[]> {
  const gdpRows = parseCsv(await fs.readFile(gdpPath, "utf8"));
  const gdpByYear = new Map(
    gdpRows.map((row) => [Number(row.year), Number(row.gdp_current_prices_million_gel)]),
  );
  return Array.from({ length: 13 }, (_, index) => 2013 + index).map((year) => {
    const debt = stockRows.find(
      (row) => row.year === year && row.debt_scope === "total",
    )?.amount_million_gel;
    const gdp = gdpByYear.get(year);
    const published = publishedRatios.get(year);
    if (debt === undefined || !Number.isFinite(gdp) || published === undefined) {
      throw new Error(`Missing GDP-share input for ${year}`);
    }
    const calculated = (debt / gdp!) * 100;
    const difference = calculated - published;
    return {
      year,
      debt_total_million_gel: debt,
      gdp_million_gel: gdp!,
      calculated_share_percent: calculated,
      published_share_percent: published,
      difference_percentage_points: difference,
      comparison_status:
        Math.abs(difference) <= 0.1
          ? "rounding_match"
          : "possible_gdp_vintage_difference",
    };
  });
}

function controlComparisons(
  stockRows: GovernmentDebtStockRow[],
  controlRows: ReturnType<typeof readControlWorkbookValues>,
): GovernmentDebtControlComparison[] {
  return controlRows.map((control) => {
    const stock = new Map(
      stockRows
        .filter((row) => row.year === control.year)
        .map((row) => [row.debt_scope, row.amount_million_gel]),
    );
    return {
      year: control.year,
      canonical_total_million_gel: stock.get("total")!,
      canonical_domestic_million_gel: stock.get("domestic")!,
      canonical_external_million_gel: stock.get("external")!,
      control_total_million_gel: control.total_million_gel,
      control_domestic_million_gel: control.domestic_million_gel,
      control_external_million_gel: control.external_million_gel,
      source_cells: control.source_cells,
    };
  });
}

function stockOverlapComparisons(
  canonicalRows: GovernmentDebtStockRow[],
  controls: ReturnType<typeof parseGovernmentDebtStockOverlapSources>,
): GovernmentDebtStockOverlapComparison[] {
  const canonical = new Map(
    canonicalRows.map((row) => [
      key(row.year, row.debt_scope),
      row.amount_million_gel,
    ]),
  );
  return [
    ...controls.n13.filter((row) => row.year >= 2015),
    ...controls.n19.filter((row) => row.year >= 2015),
  ].map((control) => {
    const canonicalAmount = canonical.get(key(control.year, control.debt_scope));
    if (canonicalAmount === undefined) {
      throw new Error(
        `Missing canonical stock overlap for ${control.source_id} ${control.year}:${control.debt_scope}`,
      );
    }
    const difference = Number(
      (control.amount_million_gel - canonicalAmount).toFixed(10),
    );
    return {
      control_source_id: control.source_id as
        | "mof_public_debt_bulletin_n13"
        | "mof_public_debt_bulletin_n19",
      year: control.year,
      debt_scope: control.debt_scope,
      canonical_amount_million_gel: canonicalAmount,
      control_amount_million_gel: control.amount_million_gel,
      difference_million_gel: difference,
      comparison_status: difference === 0 ? "exact_match" : "revision",
    };
  });
}

function actualServiceOverlapComparisons(
  canonicalRows: GovernmentDebtActualServiceRow[],
  controls: ReturnType<typeof parseDomesticServiceOverlapControls>,
): GovernmentDebtActualServiceOverlapComparison[] {
  const canonical = new Map(
    canonicalRows
      .filter((row) => row.debt_scope === "domestic")
      .map((row) => [row.year, row]),
  );
  const comparisons = controls.map((control) => {
    const canonicalRow = canonical.get(control.year);
    if (!canonicalRow) {
      throw new Error(
        `Missing canonical domestic service overlap for ${control.year}`,
      );
    }
    const principalDifference = Number(
      (
        control.principal_paid_million_gel -
        canonicalRow.principal_paid_million_gel
      ).toFixed(10),
    );
    const interestDifference = Number(
      (
        control.interest_paid_million_gel -
        canonicalRow.interest_paid_million_gel
      ).toFixed(10),
    );
    const exact = principalDifference === 0 && interestDifference === 0;
    const withinTolerance =
      Math.abs(principalDifference) <= control.tolerance_million_gel + 1e-8 &&
      Math.abs(interestDifference) <= control.tolerance_million_gel + 1e-8;
    return {
      control_source_id: control.source_id,
      year: control.year,
      canonical_principal_million_gel:
        canonicalRow.principal_paid_million_gel,
      control_principal_million_gel: control.principal_paid_million_gel,
      principal_difference_million_gel: principalDifference,
      canonical_interest_million_gel: canonicalRow.interest_paid_million_gel,
      control_interest_million_gel: control.interest_paid_million_gel,
      interest_difference_million_gel: interestDifference,
      tolerance_million_gel: control.tolerance_million_gel,
      source_table: control.source_table,
      source_row_label: control.source_row_label,
      comparison_status: exact
        ? ("exact_match" as const)
        : withinTolerance
          ? ("within_source_precision" as const)
          : ("unexplained_difference" as const),
    };
  });
  const unexplained = comparisons.find(
    (comparison) =>
      comparison.comparison_status === "unexplained_difference",
  );
  if (unexplained) {
    throw new Error(
      `Unexplained domestic service overlap difference for ${unexplained.year}`,
    );
  }
  return comparisons;
}

function csvValue(value: unknown, header: string): string | number | boolean | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  throw new Error(`Unsupported CSV value for ${header}`);
}

function serializeCsv<T extends object>(headers: Array<keyof T>, rows: T[]): string {
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          csvEscape(
            csvValue(
              (row as Record<keyof T, unknown>)[header],
              String(header),
            ),
          ),
        )
        .join(","),
    ),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

async function writeOrCheck(
  write: boolean,
  artifacts: Array<{ filePath: string; content: string }>,
): Promise<void> {
  for (const artifact of artifacts) {
    if (write) {
      await fs.writeFile(artifact.filePath, artifact.content, "utf8");
    } else {
      await assertGeneratedArtifactMatches(
        ARTIFACT_LABEL,
        artifact.filePath,
        artifact.content,
      );
    }
  }
}

export async function buildGovernmentDebtPackage(options: {
  write: boolean;
}): Promise<GovernmentDebtPackageBuild> {
  const paths = packagePaths();
  const [manifestRows, pages] = await Promise.all([
    readManifest(paths.manifest),
    loadApprovedPages(paths),
    validateMethodologyNotes(paths.methodologyNotes),
  ]).then(([manifest, approvedPages]) => [manifest, approvedPages] as const);

  const stockRows = parseGovernmentDebtStock({
    n13Page31: pages.n13Page31,
    n25Page26: pages.n25Page26,
  });
  const stockOverlapSources = parseGovernmentDebtStockOverlapSources({
    n13Page31: pages.n13Page31,
    n19Page34: pages.n19Page34,
    n25Page26: pages.n25Page26,
  });
  const actualServiceRows = parseActualDebtService({
    n7Page32: pages.n7Page32,
    n13Page32: pages.n13Page32,
    n19Page35: pages.n19Page35,
    n25Page20: pages.n25Page20,
    n25Page27: pages.n25Page27,
  });
  const serviceOverlaps = actualServiceOverlapComparisons(
    actualServiceRows,
    parseDomesticServiceOverlapControls({
      n7Page32: pages.n7Page32,
      n13Page32: pages.n13Page32,
      n19Page35: pages.n19Page35,
      n25Page27: pages.n25Page27,
    }),
  );
  const interestRateRows = parseInterestRateGrid({
    monthlyPage3: pages.monthlyPage3,
    strategy2019Page14: pages.strategy2019Page14,
    strategy2022Page23: pages.strategy2022Page23,
    strategy2023Page24: pages.strategy2023Page24,
    strategy2025Page28: pages.strategy2025Page28,
  });
  const forecastRows = parseDebtServiceForecast({
    n25Page7: pages.n25Page7,
    n25Page17: pages.n25Page17,
    n25Page22: pages.n25Page22,
    n25Page24: pages.n25Page24,
  });

  validateStock(stockRows);
  validateActualService(actualServiceRows);
  const rateValidation = validateInterestRates(interestRateRows);
  const forecastChecks = validateForecast(forecastRows);
  const gdpChecks = await gdpShareChecks(
    paths.gdp,
    stockRows,
    parsePublishedGovernmentDebtGdpRatios(pages.n25Page28),
  );
  const controls = controlComparisons(
    stockRows,
    readControlWorkbookValues(paths.controlWorkbook),
  );
  const stockOverlaps = stockOverlapComparisons(
    stockRows,
    stockOverlapSources,
  );

  const validation: GovernmentDebtValidationReport = {
    status: "complete_with_documented_rate_gaps",
    review_date: REVIEW_DATE,
    sources: {
      rowCount: manifestRows.length,
      sourceIds: manifestRows.map(
        (row) => row.source_id as GovernmentDebtSourceId,
      ),
    },
    stock: {
      rowCount: stockRows.length,
      observedYears: Array.from({ length: 13 }, (_, index) => 2013 + index),
      overlapComparisons: stockOverlaps,
    },
    actualService: {
      rowCount: actualServiceRows.length,
      observedYears: Array.from({ length: 13 }, (_, index) => 2013 + index),
      overlapComparisons: serviceOverlaps,
    },
    interestRates: {
      rowCount: interestRateRows.length,
      availableCount: interestRateRows.filter(
        (row) => row.availability_status === "available",
      ).length,
      gaps: rateValidation.gaps,
    },
    forecast: {
      rowCount: forecastRows.length,
      paymentYears: [2026, 2027, 2028, 2029, 2030],
      snapshotDate: "2025-12-31",
    },
    gdpShareChecks: gdpChecks,
    controlComparisons: controls,
    checks: {
      interestRates: rateValidation.checks,
      forecast: forecastChecks,
    },
    estimates_created: 0,
    source_hashes_match: true,
    normalized_values_reconcile:
      rateValidation.checks.every((check) => check.status === "pass") &&
      forecastChecks.every((check) => check.status === "pass") &&
      serviceOverlaps.every(
        (comparison) =>
          comparison.comparison_status !== "unexplained_difference",
      ),
  };

  await writeOrCheck(options.write, [
    {
      filePath: paths.stockOutput,
      content: serializeCsv(STOCK_HEADERS, stockRows),
    },
    {
      filePath: paths.rateOutput,
      content: serializeCsv(RATE_HEADERS, interestRateRows),
    },
    {
      filePath: paths.actualServiceOutput,
      content: serializeCsv(ACTUAL_SERVICE_HEADERS, actualServiceRows),
    },
    {
      filePath: paths.forecastOutput,
      content: serializeCsv(FORECAST_HEADERS, forecastRows),
    },
    {
      filePath: paths.validationOutput,
      content: `${JSON.stringify(validation, null, 2)}\n`,
    },
  ]);

  return {
    stockRows,
    actualServiceRows,
    interestRateRows,
    forecastRows,
    validation,
  };
}
