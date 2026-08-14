import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readCsvRecords } from "../csv";
import { csvEscape } from "../csvEscape";
import { aggregateFactsForEntity } from "./aggregateMunicipalFacts";
import { municipalCategoryIdForCode } from "./functionMapping";
import { MUNICIPAL_COUNTRY_ID, type MunicipalFunctionFact, type MunicipalTotalFact } from "./types";

const RAW_DIR = "../../docs/Raw Data/Municipalities/combined-annual-2015-2025";
const RAW_FUNCTIONS = `${RAW_DIR}/municipal-functional-main-annual-2015-2025.csv`;
const RAW_TOTALS = `${RAW_DIR}/municipal-total-payments-annual-2015-2025.csv`;

const OUT_FUNCTIONS = "../../data/imports/municipal-function-facts-2015-2025.csv";
const OUT_TOTALS = "../../data/imports/municipal-total-facts-2015-2025.csv";
const OUT_COUNTRY_FUNCTIONS = "../../data/imports/municipal-georgia-function-facts-2015-2025.csv";
const OUT_COUNTRY_TOTALS = "../../data/imports/municipal-georgia-total-facts-2015-2025.csv";

const PORTAL_SOURCE = "source.municipal_portal_archive";
const WORKBOOK_SOURCE = "source.municipal_mof_annual_and_history_workbooks";
// These official rows describe municipal bodies operating outside occupied
// territories, not territorially attributable spending there. Keep them in the
// raw archive, but never copy them into GeoData.ge's public municipal dataset.
const EXCLUDED_MUNICIPALITY_CODES = new Set(["05", "42", "43", "46", "64"]);

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

const COUNTRY_FUNCTION_HEADER = [
  "year",
  "scope_id",
  "category_id",
  "functional_code",
  "amount_gel",
  "basis",
  "source_id",
];

const COUNTRY_TOTAL_HEADER = [
  "year",
  "scope_id",
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
function money(value: string | number | null): string {
  const trimmed = value === null ? "" : String(value).trim();
  return trimmed === "" ? "" : Number(trimmed).toFixed(2);
}

function optionalMoney(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
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
  countryFunctionRows: number;
  countryTotalRows: number;
}> {
  const [rawFunctions, rawTotals] = await Promise.all([
    readCsvRecords(RAW_FUNCTIONS),
    readCsvRecords(RAW_TOTALS),
  ]);

  const allFunctionFacts: MunicipalFunctionFact[] = rawFunctions
    .map((record) => ({
      year: Number(record.year),
      municipalityCode: record.municipality_code,
      categoryId: municipalCategoryIdForCode(record.functional_code),
      functionalCode: record.functional_code,
      amountGel: Number(record.amount_gel),
      basis: "actual" as const,
      sourceId: sourceIdFor(record.source_family),
    }))
    .sort(
      (left, right) =>
        left.year - right.year ||
        left.municipalityCode.localeCompare(right.municipalityCode) ||
        Number(left.functionalCode.slice(2)) - Number(right.functionalCode.slice(2)),
    );

  const allTotalFacts: MunicipalTotalFact[] = rawTotals
    .map((record) => ({
      year: Number(record.year),
      municipalityCode: record.municipality_code,
      publicTotalGel: Number(record.public_total_gel),
      publicTotalMeasure: record.public_total_measure,
      totalPaymentsGel: optionalMoney(record.total_payments_gel),
      expensesGel: optionalMoney(record.expenses_gel),
      nonfinancialAssetGrowthGel: optionalMoney(record.nonfinancial_asset_growth_gel),
      financialAssetGrowthGel: optionalMoney(record.financial_asset_growth_gel),
      liabilityDecreaseGel: optionalMoney(record.liability_decrease_gel),
      functionalSumGel: Number(record.functional_sum_gel),
      reconciliationDifferenceGel: optionalMoney(record.reconciliation_difference_gel),
      warningAmountGel: optionalMoney(record.warning_amount_gel),
      showWarning: boolText(record.show_warning) === "true",
      warningType: warningType(record.warning_type) as MunicipalTotalFact["warningType"],
      basis: "actual" as const,
      sourceId: sourceIdFor(record.source_family),
    }))
    .sort((left, right) => left.year - right.year || left.municipalityCode.localeCompare(right.municipalityCode));

  const publicFunctionFacts = allFunctionFacts.filter(
    (fact) => !EXCLUDED_MUNICIPALITY_CODES.has(fact.municipalityCode),
  );
  const publicTotalFacts = allTotalFacts.filter(
    (fact) => !EXCLUDED_MUNICIPALITY_CODES.has(fact.municipalityCode),
  );
  const country = aggregateFactsForEntity(MUNICIPAL_COUNTRY_ID, allFunctionFacts, allTotalFacts);
  const countryFunctionFacts = country.functionFacts.sort(
    (left, right) =>
      left.year - right.year || Number(left.functionalCode.slice(2)) - Number(right.functionalCode.slice(2)),
  );
  const countryTotalFacts = country.totalFacts.sort((left, right) => left.year - right.year);

  const functionRows = publicFunctionFacts.map((fact) => [
    String(fact.year),
    fact.municipalityCode,
    fact.categoryId,
    fact.functionalCode,
    money(fact.amountGel),
    fact.basis,
    fact.sourceId,
  ]);
  const totalRows = publicTotalFacts.map((fact) => [
    String(fact.year),
    fact.municipalityCode,
    money(fact.publicTotalGel),
    fact.publicTotalMeasure,
    money(fact.totalPaymentsGel),
    money(fact.expensesGel),
    money(fact.nonfinancialAssetGrowthGel),
    money(fact.financialAssetGrowthGel),
    money(fact.liabilityDecreaseGel),
    money(fact.functionalSumGel),
    money(fact.reconciliationDifferenceGel),
    money(fact.warningAmountGel),
    fact.showWarning ? "true" : "false",
    fact.warningType,
    fact.basis,
    fact.sourceId,
  ]);
  const countryFunctionRows = countryFunctionFacts.map((fact) => [
    String(fact.year),
    fact.municipalityCode,
    fact.categoryId,
    fact.functionalCode,
    money(fact.amountGel),
    fact.basis,
    fact.sourceId,
  ]);
  const countryTotalRows = countryTotalFacts.map((fact) => [
    String(fact.year),
    fact.municipalityCode,
    money(fact.publicTotalGel),
    fact.publicTotalMeasure,
    money(fact.totalPaymentsGel),
    money(fact.expensesGel),
    money(fact.nonfinancialAssetGrowthGel),
    money(fact.financialAssetGrowthGel),
    money(fact.liabilityDecreaseGel),
    money(fact.functionalSumGel),
    money(fact.reconciliationDifferenceGel),
    money(fact.warningAmountGel),
    fact.showWarning ? "true" : "false",
    fact.warningType,
    fact.basis,
    fact.sourceId,
  ]);

  await Promise.all([
    writeRelative(OUT_FUNCTIONS, toCsv(FUNCTION_HEADER, functionRows)),
    writeRelative(OUT_TOTALS, toCsv(TOTAL_HEADER, totalRows)),
    writeRelative(OUT_COUNTRY_FUNCTIONS, toCsv(COUNTRY_FUNCTION_HEADER, countryFunctionRows)),
    writeRelative(OUT_COUNTRY_TOTALS, toCsv(COUNTRY_TOTAL_HEADER, countryTotalRows)),
  ]);

  return {
    functionRows: functionRows.length,
    totalRows: totalRows.length,
    countryFunctionRows: countryFunctionRows.length,
    countryTotalRows: countryTotalRows.length,
  };
}
