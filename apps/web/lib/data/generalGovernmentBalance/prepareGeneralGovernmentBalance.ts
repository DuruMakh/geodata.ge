import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import { z } from "zod";

import { serializeBomCsv } from "../csvEscape";
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
import { readVerifiedPackageFile } from "../sourcePackage";

const EXPECTED_COUNTRY_ID = "GEO" as const;
const EXPECTED_SHEET = "Countries" as const;
const RECONCILIATION_TOLERANCE_PP = 0.02 as const;
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

const manifestSchema = z
  .object({
    source_id: z
      .string()
      .regex(/^source\.imf_weo_[a-z]+_\d{4}_general_government_balance$/),
    publisher: z.literal("International Monetary Fund"),
    dataset: z.literal("World Economic Outlook"),
    dataset_version: z.string().regex(/^IMF\.RES:WEO\(\d+\.\d+\.\d+\)$/),
    publication_date: z.string().regex(/^\d{4}-(?:04|10)-\d{2}$/),
    source_page_url: z.literal("https://data.imf.org/Datasets/WEO"),
    retrieved_file_url: z.string().url().startsWith("https://data.imf.org/"),
    retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    local_file: z.string().regex(/^official\/WEO[A-Za-z]{3}\d{4}all\.xlsx$/),
    sha256: z.string().regex(/^[0-9A-F]{64}$/),
    bytes: z.string().regex(/^\d+$/),
    country_id: z.literal(EXPECTED_COUNTRY_ID),
    source_sheet: z.literal(EXPECTED_SHEET),
    percent_series_code: z.literal(TARGETS.GGXCNL_NGDP.seriesCode),
    nominal_series_code: z.literal(TARGETS.GGXCNL.seriesCode),
    validation_gdp_series_code: z.literal(TARGETS.NGDP_FY.seriesCode),
    year_min: z.string().regex(/^\d{4}$/),
    year_max: z.string().regex(/^\d{4}$/),
    latest_actual_year: z.string().regex(/^\d{4}$/),
    methodology: z.literal("GFSM 2001"),
    valuation: z.literal("Cash"),
    general_government_composition: z.literal("Central Government; Local Government"),
  })
  .strict()
  .refine(
    (row) =>
      Number(row.year_min) < Number(row.latest_actual_year) &&
      Number(row.latest_actual_year) < Number(row.year_max),
    "The manifest's actual year must fall inside its coverage",
  )
  .refine(
    (row) => row.retrieved_at >= row.publication_date,
    "The file cannot be retrieved before it is published",
  )
  .refine(
    (row) => {
      const year = row.publication_date.slice(0, 4);
      const april = row.publication_date.slice(5, 7) === "04";
      const editionName = april ? "april" : "october";
      const workbookName = `WEO${april ? "Apr" : "Oct"}${year}all.xlsx`;
      return (
        row.source_id ===
          `source.imf_weo_${editionName}_${year}_general_government_balance` &&
        row.local_file === `official/${workbookName}` &&
        new URL(row.retrieved_file_url).pathname.endsWith(`/${workbookName}`)
      );
    },
    "The WEO edition must agree across the source ID, publication date, and workbook filenames",
  );

type ManifestRow = z.infer<typeof manifestSchema>;

export function validateGeneralGovernmentBalanceManifest(
  record: Record<string, string>,
): ManifestRow {
  return manifestSchema.parse(record);
}

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

function expectedStatus(
  year: number,
  latestActualYear: number,
): GeneralGovernmentBalanceStatus {
  return year <= latestActualYear ? "actual" : "projection";
}

function extractSourceFacts(
  workbookBytes: Buffer,
  manifest: ManifestRow,
  expectedYears: number[],
  latestActualYear: number,
): GeneralGovernmentBalanceSourceFact[] {
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
    if (Number.isInteger(year) && expectedYears.includes(year)) yearColumns.set(year, column);
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

    expectMetadata(sheet, sourceRow, columns, "DATASET", manifest.dataset_version);
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
    expectMetadata(
      sheet,
      sourceRow,
      columns,
      "LATEST_ACTUAL_ANNUAL_DATA",
      String(latestActualYear),
    );
    expectMetadata(sheet, sourceRow, columns, "PRIMARY_DOMESTIC_CURRENCY", "Georgian lari");

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
    }

    for (const year of expectedYears) {
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
        status: expectedStatus(year, latestActualYear),
        sourceId: manifest.source_id,
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
  manifest: ManifestRow,
  expectedYears: number[],
  latestActualYear: number,
): GeneralGovernmentBalanceFact[] {
  return expectedYears.map((year) => {
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
      status: expectedStatus(year, latestActualYear),
      sourceId: manifest.source_id,
      sourceDataset: manifest.dataset_version,
      sourceVintage: manifest.publication_date.slice(0, 7),
      sourceSheet: EXPECTED_SHEET,
      sourceCountryId: EXPECTED_COUNTRY_ID,
      sourcePercentSeriesCode: manifest.percent_series_code,
      sourceNominalSeriesCode: manifest.nominal_series_code,
      sourceUnit: "billion GEL",
      transformation: TRANSFORMATION,
      lastReviewedAt: manifest.retrieved_at,
    };
  });
}

export function validateGeneralGovernmentBalanceSeries(
  sourceFacts: GeneralGovernmentBalanceSourceFact[],
  canonicalFacts: GeneralGovernmentBalanceFact[],
): GeneralGovernmentBalanceValidationSummary {
  const expectedYears = sourceFacts
    .filter((row) => row.indicatorId === "GGXCNL_NGDP")
    .map((row) => row.year)
    .sort((left, right) => left - right);
  const latestActualYear = Math.max(
    ...sourceFacts.filter((row) => row.status === "actual").map((row) => row.year),
  );
  if (!Number.isFinite(latestActualYear) || expectedYears.length === 0) {
    throw new Error("IMF balance source needs actual observations and annual coverage");
  }
  const canonicalYears = canonicalFacts.map((row) => row.year);
  if (JSON.stringify(canonicalYears) !== JSON.stringify(expectedYears)) {
    throw new Error(
      `Canonical general-government balance coverage must be ${expectedYears[0]}-${expectedYears.at(-1)}`,
    );
  }

  for (const row of canonicalFacts) {
    if (row.status !== expectedStatus(row.year, latestActualYear)) {
      throw new Error(`General-government balance status is invalid for ${row.year}`);
    }
    const sourcePercent = sourceValue(sourceFacts, row.year, "GGXCNL_NGDP");
    if (!new Decimal(row.generalGovernmentBalancePctGdp).equals(sourcePercent)) {
      throw new Error(
        `Canonical general-government balance percentage does not match IMF source for ${row.year}`,
      );
    }
    const sourceNominalBillions = sourceValue(sourceFacts, row.year, "GGXCNL");
    const sourceGel = new Decimal(sourceNominalBillions).times(1_000_000_000);
    if (!sourceGel.equals(row.generalGovernmentBalanceGel)) {
      throw new Error(
        `Canonical general-government balance GEL does not match IMF source for ${row.year}`,
      );
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
    if (row.status !== expectedStatus(row.year, latestActualYear)) {
      throw new Error(`IMF balance source status is invalid for ${row.year}`);
    }
  }
  for (const indicatorId of Object.keys(TARGETS) as GeneralGovernmentBalanceIndicatorId[]) {
    const years = sourceFacts
      .filter((row) => row.indicatorId === indicatorId)
      .map((row) => row.year);
    if (JSON.stringify(years) !== JSON.stringify(expectedYears)) {
      throw new Error(
        `${indicatorId} source coverage must be ${expectedYears[0]}-${expectedYears.at(-1)}`,
      );
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
  if (reconciliationFailureYears.length > 0) {
    throw new Error(
      `General-government balance reconciliation exceeds ${RECONCILIATION_TOLERANCE_PP} percentage points for ${reconciliationFailureYears.join(", ")}`,
    );
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
  }) as Record<string, string>[];
  if (manifestRows.length !== 1) throw new Error("Expected exactly one IMF balance source");
  const manifest = validateGeneralGovernmentBalanceManifest(manifestRows[0]);
  const expectedYears = Array.from(
    { length: Number(manifest.year_max) - Number(manifest.year_min) + 1 },
    (_, index) => Number(manifest.year_min) + index,
  );
  const latestActualYear = Number(manifest.latest_actual_year);
  const expectedSourceBytes = Number(manifest.bytes);

  const { bytes: workbookBytes, sha256 } = await readVerifiedPackageFile(
    PACKAGE_DIR,
    manifest.local_file,
    { sha256: manifest.sha256, bytes: expectedSourceBytes },
    `Reviewed source mismatch for ${manifest.source_id}`,
  );
  const sourceSha256 = sha256.toUpperCase();

  const sourceFacts = extractSourceFacts(
    workbookBytes,
    manifest,
    expectedYears,
    latestActualYear,
  );
  const canonicalFacts = buildCanonicalFacts(
    sourceFacts,
    manifest,
    expectedYears,
    latestActualYear,
  );
  const validationSummary = validateGeneralGovernmentBalanceSeries(sourceFacts, canonicalFacts);
  const validation: GeneralGovernmentBalanceValidationReport = {
    status: "PASS",
    dataset: manifest.dataset_version,
    sourceBytes: expectedSourceBytes,
    sourceSha256,
    sourceFactCount: sourceFacts.length,
    canonicalFactCount: canonicalFacts.length,
    canonicalYearMin: expectedYears[0]!,
    canonicalYearMax: expectedYears.at(-1)!,
    latestActualYear,
    firstProjectionYear: latestActualYear + 1,
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
      content: serializeBomCsv(Object.keys(stagingRows[0] ?? {}), stagingRows),
    },
    {
      filePath: CANONICAL_PATH,
      content: serializeBomCsv(Object.keys(canonicalRows[0] ?? {}), canonicalRows),
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
