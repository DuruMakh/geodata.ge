import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { csvEscape } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readPdfPages, requirePageMarker } from "./pdfText";
import {
  parseActualDebtService,
  parseDebtServiceForecast,
  parseGovernmentDebtStock,
  parseGovernmentDebtStockOverlapSources,
  parseInterestRateGrid,
  parsePublishedGovernmentDebtGdpRatios,
  readControlWorkbookValues,
} from "./parseDebtSources";
import { validateGovernmentDebtSourceManifest } from "./sourceManifest";
import type {
  DebtScope,
  GovernmentDebtActualServiceRow,
  GovernmentDebtControlComparison,
  GovernmentDebtForecastRow,
  GovernmentDebtGdpShareCheck,
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
): GovernmentDebtRateGap[] {
  validateAnnualPanel(rows, 2015, 2025, "interest rate");
  const available = rows.filter(
    (row) => row.availability_status === "available",
  );
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
      reason: row.transformation,
    }));
  if (
    available.length !== 22 ||
    gaps.length !== 11 ||
    available.some(
      (row) =>
        row.weighted_average_interest_rate_percent === null ||
        row.weighted_average_interest_rate_percent < 0,
    ) ||
    gaps.some((gap) => gap.debt_scope === "total")
  ) {
    throw new Error("Interest-rate availability does not match the approved grid");
  }
  return gaps;
}

function validateForecast(rows: GovernmentDebtForecastRow[]): void {
  if (rows.length !== 15 || new Set(rows.map((row) => `${row.payment_year}:${row.debt_scope}`)).size !== 15) {
    throw new Error("Forecast does not contain the approved 15-row grid");
  }
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
  }
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
  const gaps = validateInterestRates(interestRateRows);
  validateForecast(forecastRows);
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
    },
    interestRates: {
      rowCount: interestRateRows.length,
      availableCount: interestRateRows.filter(
        (row) => row.availability_status === "available",
      ).length,
      gaps,
    },
    forecast: {
      rowCount: forecastRows.length,
      paymentYears: [2026, 2027, 2028, 2029, 2030],
      snapshotDate: "2025-12-31",
    },
    gdpShareChecks: gdpChecks,
    controlComparisons: controls,
    estimates_created: 0,
    source_hashes_match: true,
    normalized_values_reconcile: true,
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
