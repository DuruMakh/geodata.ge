import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { serializeBomCsv } from "./csvEscape";
import { SERIES } from "./demography/series";
import { budgetFactHeaders } from "./factCsv";

export type PublicDatasetId =
  | "national-expenditure"
  | "national-revenue"
  | "municipal-expenditure"
  | "government-debt"
  | "general-government-balance"
  | "population"
  | "wages"
  | "unemployment"
  | "social-protection";

/** Every CSV this module writes under /downloads/data/, in the order of its outputs. */
export const PUBLIC_DATASET_FILE_NAMES: readonly string[] = [
  "national-expenditure.csv",
  "national-revenue.csv",
  "municipal-expenditure.csv",
  "government-debt.csv",
  "general-government-balance.csv",
  "population.csv",
  "wages.csv",
  "unemployment.csv",
  "social-protection.csv",
];

export type PublicDatasetValidation = {
  status: "PASS";
  datasetId: PublicDatasetId;
  rowCount: number;
  bytes: number;
  sha256: string;
  firstYear: number;
  lastYear: number;
};

type CsvRow = Record<string, string>;

const MUNICIPAL_HEADERS = [
  "year",
  "entity_id",
  "row_type",
  "category_id",
  "functional_code",
  "amount_gel",
  "basis",
  "source_id",
] as const;

// Public columns of the topic files. The reviewed CSVs' source_sheet, source_cell, source_workbook and
// source_number_format stay out: they locate a figure inside a workbook and are not public metadata.
const POPULATION_HEADERS = [
  "series_id", "geography_id", "year", "value", "unit", "estimate_basis", "status", "source_id", "source_locator", "last_reviewed_at",
] as const;
const WAGES_HEADERS = [
  "year", "indicator_id", "dimension", "group_id", "sector_id", "value", "published_value", "unit", "basis", "value_status", "source_id",
  "last_reviewed_at",
] as const;
const UNEMPLOYMENT_HEADERS = [
  "year", "frequency", "dimension", "group_id", "group_label_en", "indicator_id", "sex", "unit", "value", "published_value", "basis",
  "value_status", "methodology_epoch", "role", "source_id",
] as const;
const SOCIAL_HEADERS = [
  "year", "indicator_id", "geography_id", "value", "unit", "months", "basis", "value_status", "source_id", "last_reviewed_at",
] as const;
// The four files loadUnemploymentFacts reads. Only the education and long-term files carry a sex column.
const UNEMPLOYMENT_FILES = [
  "unemployment-annual.csv",
  "unemployment-education-annual.csv",
  "unemployment-long-term-annual.csv",
  "unemployment-employment-status-annual.csv",
] as const;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readCsv(filePath: string): Promise<CsvRow[]> {
  return parse(await readFile(filePath, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];
}

function serialize(headers: readonly string[], rows: readonly CsvRow[]): Buffer {
  return Buffer.from(serializeBomCsv(headers, rows, "\r\n"), "utf8");
}

function byYearAndId(left: CsvRow, right: CsvRow): number {
  return (
    Number(left.year) - Number(right.year) ||
    (left.item_id ?? left.entity_id).localeCompare(right.item_id ?? right.entity_id, "en") ||
    (left.row_type ?? "").localeCompare(right.row_type ?? "", "en") ||
    (left.category_id ?? "").localeCompare(right.category_id ?? "", "en")
  );
}

// The four topic files below have no item_id or entity_id, so they sort on the year, then every other
// column in the file's own order. That is total and plain code-unit order, so the bytes never depend on
// the locale or on the order the reviewed CSV happens to list its rows in.
function byYearThenColumns(headers: readonly string[]) {
  return (left: CsvRow, right: CsvRow): number => {
    const byYear = Number(left.year) - Number(right.year);
    if (byYear !== 0) return byYear;
    for (const header of headers) {
      const a = left[header] ?? "";
      const b = right[header] ?? "";
      if (a !== b) return a < b ? -1 : 1;
    }
    return 0;
  };
}

// A topic file's rows, cut to its public columns and sorted.
function topicRows(rows: readonly CsvRow[], headers: readonly string[]): CsvRow[] {
  return rows
    .map((row) => Object.fromEntries(headers.map((header) => [header, row[header] ?? ""])))
    .toSorted(byYearThenColumns(headers));
}

function validation(datasetId: PublicDatasetId, rows: readonly CsvRow[], bytes: Buffer): PublicDatasetValidation {
  const years = rows.map((row) => Number(row.year));
  if (years.length === 0 || years.some((year) => !Number.isInteger(year))) {
    throw new Error(`${datasetId} produced no valid annual rows`);
  }
  return {
    status: "PASS",
    datasetId,
    rowCount: rows.length,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
  };
}

function functionRow(row: CsvRow, entityField: "municipality_code" | "scope_id"): CsvRow {
  return {
    year: row.year,
    entity_id: row[entityField],
    row_type: "function",
    category_id: row.category_id,
    functional_code: row.functional_code,
    amount_gel: row.amount_gel,
    basis: row.basis,
    source_id: row.source_id,
  };
}

function totalRow(row: CsvRow, entityField: "municipality_code" | "scope_id"): CsvRow {
  return {
    year: row.year,
    entity_id: row[entityField],
    row_type: "total",
    category_id: "municipal.total",
    functional_code: "",
    amount_gel: row.public_total_gel,
    basis: row.basis,
    source_id: row.source_id,
  };
}

export async function preparePublicDatasets(options: {
  repositoryRoot: string;
  publicRoot: string;
  mode: "write" | "check" | "check-output";
}): Promise<readonly PublicDatasetValidation[]> {
  const imports = path.join(options.repositoryRoot, "data", "imports");
  // The planned-year expenditure rows live in their own file beside the 2004-2025 facts.
  const budgetRows = [
    ...(await readCsv(path.join(imports, "budget-facts-2004-2025.csv"))),
    ...(await readCsv(path.join(imports, "expenditure-facts-2026-planned.csv"))),
  ];
  const debtRows = await readCsv(path.join(imports, "government-debt-facts-2013-2030.csv"));
  const balanceRows = await readCsv(
    path.join(imports, "general-government-balance-annual-1995-2031.csv"),
  );
  const expenditureRows = budgetRows.filter((row) => row.side === "expenditure").toSorted(byYearAndId);
  const revenueRows = budgetRows.filter((row) => row.side === "revenue").toSorted(byYearAndId);

  const [municipalFunctions, municipalTotals, countryFunctions, countryTotals] = await Promise.all([
    readCsv(path.join(imports, "municipal-function-facts-2015-2025.csv")),
    readCsv(path.join(imports, "municipal-total-facts-2015-2025.csv")),
    readCsv(path.join(imports, "municipal-georgia-function-facts-2015-2025.csv")),
    readCsv(path.join(imports, "municipal-georgia-total-facts-2015-2025.csv")),
  ]);
  const municipalRows = [
    ...municipalFunctions.map((row) => functionRow(row, "municipality_code")),
    ...municipalTotals.map((row) => totalRow(row, "municipality_code")),
    ...countryFunctions.map((row) => functionRow(row, "scope_id")),
    ...countryTotals.map((row) => totalRow(row, "scope_id")),
  ].toSorted(byYearAndId);

  // Each topic file publishes the rows its pages serve, which are the rows of its reviewed CSV: wages,
  // unemployment and social protection load every row (tests/data/publicDatasetExports.test.ts holds the
  // counts equal to their served loaders), and the population pages read only the population total.
  const [populationFacts, wagesFacts, socialFacts, ...unemploymentParts] = await Promise.all([
    readCsv(path.join(imports, "demography-population-annual.csv")),
    readCsv(path.join(imports, "wages-annual.csv")),
    readCsv(path.join(imports, "social-protection-annual.csv")),
    ...UNEMPLOYMENT_FILES.map((name) => readCsv(path.join(imports, name))),
  ]);
  const populationRows = topicRows(populationFacts.filter((row) => row.series_id === SERIES.populationTotal), POPULATION_HEADERS);
  const wagesRows = topicRows(wagesFacts, WAGES_HEADERS);
  const unemploymentRows = topicRows(unemploymentParts.flat(), UNEMPLOYMENT_HEADERS);
  const socialRows = topicRows(socialFacts, SOCIAL_HEADERS);

  const outputs = [
    {
      datasetId: "national-expenditure" as const,
      fileName: "national-expenditure.csv",
      rows: expenditureRows,
      bytes: serialize(budgetFactHeaders, expenditureRows),
    },
    {
      datasetId: "national-revenue" as const,
      fileName: "national-revenue.csv",
      rows: revenueRows,
      bytes: serialize(budgetFactHeaders, revenueRows),
    },
    {
      datasetId: "municipal-expenditure" as const,
      fileName: "municipal-expenditure.csv",
      rows: municipalRows,
      bytes: serialize(MUNICIPAL_HEADERS, municipalRows),
    },
    {
      datasetId: "government-debt" as const,
      fileName: "government-debt.csv",
      rows: debtRows,
      bytes: serialize([
        "year",
        "family",
        "series_id",
        "value",
        "value_kind",
        "status",
        "source_id",
        "snapshot_date",
        "last_reviewed_at",
      ], debtRows),
    },
    {
      datasetId: "general-government-balance" as const,
      fileName: "general-government-balance.csv",
      rows: balanceRows,
      bytes: serialize([
        "year",
        "general_government_balance_pct_gdp",
        "general_government_balance_gel",
        "status",
        "source_id",
        "last_reviewed_at",
      ], balanceRows),
    },
    {
      datasetId: "population" as const,
      fileName: "population.csv",
      rows: populationRows,
      bytes: serialize(POPULATION_HEADERS, populationRows),
    },
    {
      datasetId: "wages" as const,
      fileName: "wages.csv",
      rows: wagesRows,
      bytes: serialize(WAGES_HEADERS, wagesRows),
    },
    {
      datasetId: "unemployment" as const,
      fileName: "unemployment.csv",
      rows: unemploymentRows,
      bytes: serialize(UNEMPLOYMENT_HEADERS, unemploymentRows),
    },
    {
      datasetId: "social-protection" as const,
      fileName: "social-protection.csv",
      rows: socialRows,
      bytes: serialize(SOCIAL_HEADERS, socialRows),
    },
  ];

  const validations = outputs.map((output) => validation(output.datasetId, output.rows, output.bytes));
  const outputRoot = path.join(options.publicRoot, "downloads", "data");
  if (options.mode === "write") {
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(outputRoot, { recursive: true });
    await Promise.all(outputs.map((output) => writeFile(path.join(outputRoot, output.fileName), output.bytes)));
  }
  // "check" validates the inputs only. "write" reads back what it just wrote, so the build needs no
  // separate re-check after it; "check-output" is that same read on its own.
  if (options.mode !== "check") {
    const stale: string[] = [];
    for (const output of outputs) {
      const onDisk = await readFile(path.join(outputRoot, output.fileName)).catch(() => null);
      if (onDisk === null) stale.push(`${output.fileName}: missing`);
      else if (!onDisk.equals(output.bytes)) stale.push(`${output.fileName}: content differs`);
    }
    if (stale.length > 0) throw new Error(`Public dataset downloads are stale:\n${stale.join("\n")}`);
  }
  return validations;
}
