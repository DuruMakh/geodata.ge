import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readCsvRecords } from "../csv";
import { csvEscape } from "../csvEscape";
import { municipalCategoryIdForCode } from "./functionMapping";

const RAW_DIR = "../../docs/Raw Data/Municipalities/combined-annual-2015-2025";
const RAW_FUNCTIONS = `${RAW_DIR}/municipal-functional-main-annual-2015-2025.csv`;
const RAW_TOTALS = `${RAW_DIR}/municipal-total-payments-annual-2015-2025.csv`;

const OUT_FUNCTIONS = "../../data/imports/municipal-function-facts-2015-2025.csv";
const OUT_TOTALS = "../../data/imports/municipal-total-facts-2015-2025.csv";

const PORTAL_SOURCE = "source.municipal_portal_archive";
const WORKBOOK_SOURCE = "source.municipal_mof_annual_and_history_workbooks";

const FUNCTION_HEADER = [
  "year",
  "municipality_code",
  "category_id",
  "functional_code",
  "amount_gel",
  "basis",
  "source_id",
];

const TOTAL_HEADER = [
  "year",
  "municipality_code",
  "public_total_gel",
  "public_total_measure",
  "total_payments_gel",
  "expenses_gel",
  "nonfinancial_asset_growth_gel",
  "financial_asset_growth_gel",
  "liability_decrease_gel",
  "functional_sum_gel",
  "reconciliation_difference_gel",
  "warning_amount_gel",
  "show_warning",
  "warning_type",
  "basis",
  "source_id",
];

function sourceIdFor(sourceFamily: string): string {
  return sourceFamily === "municipalities_mof_ge_portal_archive" ? PORTAL_SOURCE : WORKBOOK_SOURCE;
}

// Amounts stay at two decimals so the CSV, the Decimal(18,2) column and the
// parity comparison all describe the same number.
function money(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "" : Number(trimmed).toFixed(2);
}

function boolText(value: string): string {
  return value.trim().toLowerCase() === "true" ? "true" : "false";
}

function warningType(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "none" : trimmed;
}

function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

async function writeRelative(relativePath: string, content: string): Promise<void> {
  // utf8 with no BOM, matching the other data/imports files.
  await writeFile(path.resolve(process.cwd(), relativePath), content, "utf8");
}

export async function generateMunicipalFactCsvs(): Promise<{
  functionRows: number;
  totalRows: number;
}> {
  const [rawFunctions, rawTotals] = await Promise.all([
    readCsvRecords(RAW_FUNCTIONS),
    readCsvRecords(RAW_TOTALS),
  ]);

  const functionRows = rawFunctions
    .map((record) => ({
      year: Number(record.year),
      code: record.municipality_code,
      functionalCode: record.functional_code,
      record,
    }))
    .sort(
      (left, right) =>
        left.year - right.year ||
        left.code.localeCompare(right.code) ||
        Number(left.functionalCode.slice(2)) - Number(right.functionalCode.slice(2)),
    )
    .map(({ record }) => [
      record.year,
      record.municipality_code,
      municipalCategoryIdForCode(record.functional_code),
      record.functional_code,
      money(record.amount_gel),
      "actual",
      sourceIdFor(record.source_family),
    ]);

  const totalRows = rawTotals
    .map((record) => ({ year: Number(record.year), code: record.municipality_code, record }))
    .sort((left, right) => left.year - right.year || left.code.localeCompare(right.code))
    .map(({ record }) => [
      record.year,
      record.municipality_code,
      money(record.public_total_gel),
      record.public_total_measure,
      money(record.total_payments_gel),
      money(record.expenses_gel),
      money(record.nonfinancial_asset_growth_gel),
      money(record.financial_asset_growth_gel),
      money(record.liability_decrease_gel),
      money(record.functional_sum_gel),
      money(record.reconciliation_difference_gel),
      money(record.warning_amount_gel),
      boolText(record.show_warning),
      warningType(record.warning_type),
      "actual",
      sourceIdFor(record.source_family),
    ]);

  await Promise.all([
    writeRelative(OUT_FUNCTIONS, toCsv(FUNCTION_HEADER, functionRows)),
    writeRelative(OUT_TOTALS, toCsv(TOTAL_HEADER, totalRows)),
  ]);

  return { functionRows: functionRows.length, totalRows: totalRows.length };
}
