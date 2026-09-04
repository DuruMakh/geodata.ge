import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import * as XLSX from "xlsx";

import { csvEscape } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type {
  GeneralGovernmentBalanceFact,
  GeneralGovernmentBalanceIndicatorId,
  GeneralGovernmentBalancePreparationResult,
  GeneralGovernmentBalanceSourceFact,
  GeneralGovernmentBalanceStatus,
  GeneralGovernmentBalanceValidationReport,
  GeneralGovernmentBalanceValidationSummary,
} from "./types";

type ManifestRow = {
  source_id: string;
  dataset_version: string;
  local_file: string;
  sha256: string;
  bytes: string;
  country_id: string;
  source_sheet: string;
  percent_series_code: string;
  nominal_series_code: string;
  validation_gdp_series_code: string;
  year_min: string;
  year_max: string;
  latest_actual_year: string;
};

const EXPECTED_DATASET = "IMF.RES:WEO(9.0.0)" as const;
const EXPECTED_COUNTRY_ID = "GEO" as const;
const EXPECTED_SHEET = "Countries" as const;
const EXPECTED_SOURCE_BYTES = 5_585_205 as const;
const EXPECTED_SOURCE_SHA256 =
  "B29239CB48F8B895D1E526070C4FDE01147BC8F6BD3B86F636363BB6BD87FE7A";
const EXPECTED_LATEST_ACTUAL_YEAR = 2025;
const EXPECTED_YEARS = Array.from({ length: 37 }, (_, index) => 1995 + index);
const RECONCILIATION_TOLERANCE_PP = 0.02 as const;
const SOURCE_ID = "source.imf_weo_april_2026_general_government_balance";
const REVIEWED_AT = "2026-09-04" as const;
const TRANSFORMATION =
  "IMF billion GEL multiplied by 1,000,000,000; signed value preserved.";

const TARGETS = {
  GGXCNL_NGDP: {
    seriesCode: "GEO.GGXCNL_NGDP.A",
    unit: "Percent",
    scale: "Units",
  },
  GGXCNL: {
    seriesCode: "GEO.GGXCNL.A",
    unit: "Domestic currency",
    scale: "Billions",
  },
  NGDP_FY: {
    seriesCode: "GEO.NGDP_FY.A",
    unit: "Domestic currency",
    scale: "Billions",
  },
} as const;

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const PACKAGE_DIR = path.join(
  REPO_ROOT,
  "docs",
  "Raw Data",
  "Deficit",
  "imf-weo-general-government-balance",
);
const STAGING_PATH = path.join(
  REPO_ROOT,
  "data",
  "staging",
  "general-government-balance-source-facts-1995-2031.csv",
);
const CANONICAL_PATH = path.join(
  REPO_ROOT,
  "data",
  "imports",
  "general-government-balance-annual-1995-2031.csv",
);
const REPORT_PATH = path.join(
  REPO_ROOT,
  "data",
  "reports",
  "general-government-balance-annual-1995-2031-validation.json",
);

function serializeCsv(headers: string[], rows: Array<Record<string, string | number>>): string {
  return `\uFEFF${[
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ].join("\n")}\n`;
}

function textValue(sheet: XLSX.WorkSheet, row: number, column: number): string {
  return String(sheet[XLSX.utils.encode_cell({ r: row, c: column })]?.v ?? "").trim();
}

function expectMetadata(
  sheet: XLSX.WorkSheet,
  row: number,
  columns: Map<string, number>,
  name: string,
  expected: string,
): void {
  const column = columns.get(name);
  if (column === undefined) throw new Error(`IMF workbook is missing the ${name} column`);
  const actual = textValue(sheet, row, column);
  if (actual !== expected) {
    throw new Error(`Unexpected ${name} for IMF row ${row + 1}: ${actual}`);
  }
}

function expectedStatus(year: number): GeneralGovernmentBalanceStatus {
  return year <= EXPECTED_LATEST_ACTUAL_YEAR ? "actual" : "projection";
}

function extractSourceFacts(workbookBytes: Buffer): GeneralGovernmentBalanceSourceFact[] {
  const workbook = XLSX.read(workbookBytes, { type: "buffer", cellNF: true });
  const sheet = workbook.Sheets[EXPECTED_SHEET];
  if (!sheet) throw new Error(`IMF workbook is missing the ${EXPECTED_SHEET} sheet`);

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const columns = new Map<string, number>();
  const yearColumns = new Map<number, number>();
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const value = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })]?.v;
    const header = String(value ?? "").trim();
    if (header) columns.set(header, column);
    const year = Number(value);
    if (Number.isInteger(year) && EXPECTED_YEARS.includes(year)) yearColumns.set(year, column);
  }

  const seriesColumn = columns.get("SERIES_CODE");
  if (seriesColumn === undefined) throw new Error("IMF workbook is missing the SERIES_CODE column");

  const sourceFacts: GeneralGovernmentBalanceSourceFact[] = [];
  for (const [indicatorId, target] of Object.entries(TARGETS) as Array<
    [GeneralGovernmentBalanceIndicatorId, (typeof TARGETS)[GeneralGovernmentBalanceIndicatorId]]
  >) {
    const matchingRows: number[] = [];
    for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
      if (textValue(sheet, row, seriesColumn) === target.seriesCode) matchingRows.push(row);
    }
    if (matchingRows.length !== 1) {
      throw new Error(`Expected exactly one IMF row for ${target.seriesCode}`);
    }
    const sourceRow = matchingRows[0];

    expectMetadata(sheet, sourceRow, columns, "DATASET", EXPECTED_DATASET);
    expectMetadata(sheet, sourceRow, columns, "COUNTRY.ID", EXPECTED_COUNTRY_ID);
    expectMetadata(sheet, sourceRow, columns, "INDICATOR.ID", indicatorId);
    expectMetadata(sheet, sourceRow, columns, "FREQUENCY", "Annual");
    expectMetadata(
      sheet,
      sourceRow,
      columns,
      "START_END_MONTHS_OF_REPORTING_YEAR",
      "January/December",
    );
    expectMetadata(sheet, sourceRow, columns, "SCALE", target.scale);
    expectMetadata(sheet, sourceRow, columns, "UNIT", target.unit);
    expectMetadata(sheet, sourceRow, columns, "LATEST_ACTUAL_ANNUAL_DATA", "2025");

    if (indicatorId !== "NGDP_FY") {
      expectMetadata(
        sheet,
        sourceRow,
        columns,
        "METHODOLOGY.ID",
        "Government Finance Statistics Manual (GFSM) 2001",
      );
      expectMetadata(sheet, sourceRow, columns, "VALUATION", "Cash");
      expectMetadata(
        sheet,
        sourceRow,
        columns,
        "FISCAL_SECTOR_GENERAL_GOVERNMENT_COMPOSITION",
        "Central Government; Local Government",
      );
      expectMetadata(sheet, sourceRow, columns, "PRIMARY_DOMESTIC_CURRENCY", "Georgian lari");
    }

    for (const year of EXPECTED_YEARS) {
      const column = yearColumns.get(year);
      if (column === undefined) throw new Error(`IMF workbook is missing the ${year} column`);
      const sourceCell = XLSX.utils.encode_cell({ r: sourceRow, c: column });
      const value = Number(sheet[sourceCell]?.v);
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid IMF value at ${EXPECTED_SHEET}!${sourceCell}`);
      }
      sourceFacts.push({
        year,
        indicatorId,
        seriesCode: target.seriesCode,
        value,
        unit: target.unit,
        scale: target.scale,
        status: expectedStatus(year),
        sourceId: SOURCE_ID,
        sourceSheet: EXPECTED_SHEET,
        sourceCell,
      });
    }
  }

  return sourceFacts.sort(
    (left, right) => left.year - right.year || left.indicatorId.localeCompare(right.indicatorId),
  );
}

function sourceValue(
  sourceFacts: GeneralGovernmentBalanceSourceFact[],
  year: number,
  indicatorId: GeneralGovernmentBalanceIndicatorId,
): number {
  const matches = sourceFacts.filter(
    (row) => row.year === year && row.indicatorId === indicatorId,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one ${indicatorId} source fact for ${year}`);
  }
  return matches[0].value;
}

function buildCanonicalFacts(
  sourceFacts: GeneralGovernmentBalanceSourceFact[],
): GeneralGovernmentBalanceFact[] {
  return EXPECTED_YEARS.map((year) => {
    const percent = sourceValue(sourceFacts, year, "GGXCNL_NGDP");
    const nominalBillions = sourceValue(sourceFacts, year, "GGXCNL");
    const balanceGel = new Decimal(nominalBillions).times(1_000_000_000);
    if (!balanceGel.isInteger() || !Number.isSafeInteger(balanceGel.toNumber())) {
      throw new Error(`General-government balance GEL value is not a safe integer for ${year}`);
    }

    return {
      year,
      generalGovernmentBalancePctGdp: percent,
      generalGovernmentBalanceGel: balanceGel.toNumber(),
      status: expectedStatus(year),
      sourceId: SOURCE_ID,
      sourceDataset: EXPECTED_DATASET,
      sourceVintage: "2026-04",
      sourceSheet: EXPECTED_SHEET,
      sourceCountryId: EXPECTED_COUNTRY_ID,
      sourcePercentSeriesCode: "GEO.GGXCNL_NGDP.A",
      sourceNominalSeriesCode: "GEO.GGXCNL.A",
      sourceUnit: "billion GEL",
      transformation: TRANSFORMATION,
      lastReviewedAt: REVIEWED_AT,
    };
  });
}

export function validateGeneralGovernmentBalanceSeries(
  sourceFacts: GeneralGovernmentBalanceSourceFact[],
  canonicalFacts: GeneralGovernmentBalanceFact[],
): GeneralGovernmentBalanceValidationSummary {
  const canonicalYears = canonicalFacts.map((row) => row.year);
  if (JSON.stringify(canonicalYears) !== JSON.stringify(EXPECTED_YEARS)) {
    throw new Error("Canonical general-government balance coverage must be 1995-2031");
  }

  for (const row of canonicalFacts) {
    if (row.status !== expectedStatus(row.year)) {
      throw new Error(`General-government balance status is invalid for ${row.year}`);
    }
    const percentIsNegative = row.generalGovernmentBalancePctGdp < 0;
    const gelIsNegative = row.generalGovernmentBalanceGel < 0;
    if (
      row.generalGovernmentBalancePctGdp !== 0 &&
      row.generalGovernmentBalanceGel !== 0 &&
      percentIsNegative !== gelIsNegative
    ) {
      throw new Error(`General-government balance sign mismatch for ${row.year}`);
    }
  }

  const sourceKeys = new Set<string>();
  for (const row of sourceFacts) {
    const key = `${row.indicatorId}:${row.year}`;
    if (sourceKeys.has(key)) throw new Error(`Duplicate IMF balance source fact: ${key}`);
    sourceKeys.add(key);
    if (row.status !== expectedStatus(row.year)) {
      throw new Error(`IMF balance source status is invalid for ${row.year}`);
    }
  }
  for (const indicatorId of Object.keys(TARGETS) as GeneralGovernmentBalanceIndicatorId[]) {
    const years = sourceFacts
      .filter((row) => row.indicatorId === indicatorId)
      .map((row) => row.year);
    if (JSON.stringify(years) !== JSON.stringify(EXPECTED_YEARS)) {
      throw new Error(`${indicatorId} source coverage must be 1995-2031`);
    }
  }

  let maximumDifference = 0;
  const reconciliationFailureYears: number[] = [];
  for (const row of canonicalFacts) {
    const nominalBillions = sourceValue(sourceFacts, row.year, "GGXCNL");
    const fiscalYearGdpBillions = sourceValue(sourceFacts, row.year, "NGDP_FY");
    if (fiscalYearGdpBillions <= 0) {
      throw new Error(`Invalid fiscal-year GDP for ${row.year}`);
    }
    const calculatedPercent = new Decimal(nominalBillions)
      .dividedBy(fiscalYearGdpBillions)
      .times(100);
    const difference = calculatedPercent
      .minus(row.generalGovernmentBalancePctGdp)
      .abs()
      .toNumber();
    maximumDifference = Math.max(maximumDifference, difference);
    if (difference > RECONCILIATION_TOLERANCE_PP) reconciliationFailureYears.push(row.year);
  }

  return {
    maximumReconciliationDifferencePercentagePoints: maximumDifference,
    reconciliationFailureYears,
  };
}

export async function prepareGeneralGovernmentBalance({
  write,
  checkArtifacts = true,
}: {
  write: boolean;
  checkArtifacts?: boolean;
}): Promise<GeneralGovernmentBalancePreparationResult> {
  const manifestText = await fs.readFile(path.join(PACKAGE_DIR, "source-manifest.csv"), "utf8");
  const manifestRows = parse(manifestText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ManifestRow[];
  if (manifestRows.length !== 1) throw new Error("Expected exactly one IMF balance source");
  const manifest = manifestRows[0];
  if (
    manifest.source_id !== SOURCE_ID ||
    manifest.dataset_version !== EXPECTED_DATASET ||
    manifest.country_id !== EXPECTED_COUNTRY_ID ||
    manifest.source_sheet !== EXPECTED_SHEET ||
    manifest.percent_series_code !== TARGETS.GGXCNL_NGDP.seriesCode ||
    manifest.nominal_series_code !== TARGETS.GGXCNL.seriesCode ||
    manifest.validation_gdp_series_code !== TARGETS.NGDP_FY.seriesCode ||
    manifest.year_min !== "1995" ||
    manifest.year_max !== "2031" ||
    manifest.latest_actual_year !== "2025"
  ) {
    throw new Error("IMF balance source manifest does not match the reviewed source contract");
  }

  const workbookBytes = await fs.readFile(path.join(PACKAGE_DIR, manifest.local_file));
  const sourceSha256 = createHash("sha256").update(workbookBytes).digest("hex").toUpperCase();
  if (
    workbookBytes.byteLength !== EXPECTED_SOURCE_BYTES ||
    sourceSha256 !== EXPECTED_SOURCE_SHA256 ||
    manifest.bytes !== String(EXPECTED_SOURCE_BYTES) ||
    manifest.sha256 !== EXPECTED_SOURCE_SHA256
  ) {
    throw new Error(`Reviewed source mismatch for ${SOURCE_ID}`);
  }

  const sourceFacts = extractSourceFacts(workbookBytes);
  const canonicalFacts = buildCanonicalFacts(sourceFacts);
  const validationSummary = validateGeneralGovernmentBalanceSeries(sourceFacts, canonicalFacts);
  const validation: GeneralGovernmentBalanceValidationReport = {
    status: "PASS",
    dataset: EXPECTED_DATASET,
    sourceBytes: EXPECTED_SOURCE_BYTES,
    sourceSha256,
    sourceFactCount: 111,
    canonicalFactCount: 37,
    canonicalYearMin: 1995,
    canonicalYearMax: 2031,
    latestActualYear: 2025,
    firstProjectionYear: 2026,
    reconciliationTolerancePercentagePoints: RECONCILIATION_TOLERANCE_PP,
    ...validationSummary,
  };

  const stagingRows = sourceFacts.map((row) => ({
    year: row.year,
    indicator_id: row.indicatorId,
    series_code: row.seriesCode,
    value: row.value.toFixed(3),
    unit: row.unit,
    scale: row.scale,
    status: row.status,
    source_id: row.sourceId,
    source_sheet: row.sourceSheet,
    source_cell: row.sourceCell,
  }));
  const canonicalRows = canonicalFacts.map((row) => ({
    year: row.year,
    general_government_balance_pct_gdp: row.generalGovernmentBalancePctGdp.toFixed(3),
    general_government_balance_gel: row.generalGovernmentBalanceGel,
    status: row.status,
    source_id: row.sourceId,
    source_dataset: row.sourceDataset,
    source_vintage: row.sourceVintage,
    source_sheet: row.sourceSheet,
    source_country_id: row.sourceCountryId,
    source_percent_series_code: row.sourcePercentSeriesCode,
    source_nominal_series_code: row.sourceNominalSeriesCode,
    source_unit: row.sourceUnit,
    transformation: row.transformation,
    last_reviewed_at: row.lastReviewedAt,
  }));
  const artifacts = [
    {
      filePath: STAGING_PATH,
      content: serializeCsv(Object.keys(stagingRows[0] ?? {}), stagingRows),
    },
    {
      filePath: CANONICAL_PATH,
      content: serializeCsv(Object.keys(canonicalRows[0] ?? {}), canonicalRows),
    },
    { filePath: REPORT_PATH, content: `${JSON.stringify(validation, null, 2)}\n` },
  ];

  if (write) {
    await Promise.all(
      artifacts.map((artifact) => fs.writeFile(artifact.filePath, artifact.content, "utf8")),
    );
  } else if (checkArtifacts) {
    await Promise.all(
      artifacts.map((artifact) =>
        assertGeneratedArtifactMatches(
          "general-government balance",
          artifact.filePath,
          artifact.content,
        ),
      ),
    );
  }

  return { sourceFacts, canonicalFacts, validation };
}
