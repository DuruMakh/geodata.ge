import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { serializeBomCsv } from "./csvEscape";
import { budgetFactHeaders } from "./factCsv";

export type PublicDatasetId =
  | "national-expenditure"
  | "national-revenue"
  | "municipal-expenditure"
  | "government-debt"
  | "general-government-balance";

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
  const budgetRows = await readCsv(path.join(imports, "budget-facts-2004-2025.csv"));
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
  ];

  const validations = outputs.map((output) => validation(output.datasetId, output.rows, output.bytes));
  const outputRoot = path.join(options.publicRoot, "downloads", "data");
  if (options.mode === "write") {
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(outputRoot, { recursive: true });
    await Promise.all(outputs.map((output) => writeFile(path.join(outputRoot, output.fileName), output.bytes)));
  } else if (options.mode === "check-output") {
    // "check" validates the inputs; only this mode reads what was written.
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
