import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAdminSpendingFacts } from "../lib/data/adminSpending/importAdminSpendingFacts";
import { ADMIN_SPENDING_YEARS, EXPENDITURE_YEARS, REVENUE_YEARS } from "../lib/data/coverage";
import { validateFoundationReferences } from "../lib/data/foundationValidation";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";
import { loadSpendingMappings } from "../lib/data/mappings";
import { SERVED_DATA_FILES } from "../lib/data/servedData";
import { loadSourceDocuments } from "../lib/data/sources";
import { loadTaxonomyFiles } from "../lib/data/taxonomy";
import { budgetRowsToCsvRows } from "./compose-budget-facts";

function sortedYears(years: number[]): number[] {
  return Array.from(new Set(years)).sort((a, b) => a - b);
}

function assertYears(label: string, actual: number[], expected: number[]) {
  const actualText = actual.join(",");
  const expectedText = expected.join(",");
  if (actualText !== expectedText) {
    throw new Error(`${label} years mismatch. Expected ${expectedText}, got ${actualText}`);
  }
}
function composedFactsMatchSideFiles(
  expenditureRows: Awaited<ReturnType<typeof loadBudgetFactRows>>,
  revenueRows: Awaited<ReturnType<typeof loadBudgetFactRows>>,
  facts: Awaited<ReturnType<typeof loadBudgetFactRows>>,
): boolean {
  return JSON.stringify(budgetRowsToCsvRows([...expenditureRows, ...revenueRows])) === JSON.stringify(budgetRowsToCsvRows(facts));
}

async function main() {
  const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
  // The served datasets come from SERVED_DATA_FILES so this gate, the site and
  // the database import all read the same four paths. The two side files below
  // are not served — they are the compose inputs this script cross-checks.
  const glossary = await loadGlossary(SERVED_DATA_FILES.glossary);
  const sources = await loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments);
  const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");
  const expenditureRows = await loadBudgetFactRows("../../data/imports/expenditure-facts-2005-2025.csv");
  const revenueRows = await loadBudgetFactRows("../../data/imports/revenue-facts-2005-2025.csv");
  const facts = await loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts);
  const adminSpendingFacts = await loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts);
  const report = buildImportReport("real-budget-2004-2025", facts);
  const missingGlossary = taxonomy.filter((item) => !glossary.has(item.id));
  const registeredSourceIds = new Set(sources.map((source) => source.sourceId));
  const unresolvedAdminSpendingSourceIds = Array.from(
    new Set(
      adminSpendingFacts
        .flatMap((fact) => fact.sourceId.split(";"))
        .filter((sourceId) => !registeredSourceIds.has(sourceId)),
    ),
  ).sort();

  assertYears("Expenditure", sortedYears(expenditureRows.map((row) => row.year)), EXPENDITURE_YEARS);
  assertYears("Revenue", sortedYears(revenueRows.map((row) => row.year)), REVENUE_YEARS);
  assertYears("Admin spending", sortedYears(adminSpendingFacts.map((row) => row.year)), ADMIN_SPENDING_YEARS);
  if (missingGlossary.length > 0) {
    throw new Error(`Missing glossary rows: ${missingGlossary.map((item) => item.id).join(", ")}`);
  }

  validateFoundationReferences({ taxonomy, sources, mappings, facts });
  if (unresolvedAdminSpendingSourceIds.length > 0) {
    throw new Error(
      `Admin spending facts reference unknown source documents: ${unresolvedAdminSpendingSourceIds.join(", ")}`,
    );
  }

  if (!composedFactsMatchSideFiles(expenditureRows, revenueRows, facts)) {
    throw new Error("Combined budget facts are stale. Run npm run data:compose-budget-facts.");
  }

  const reportPath = path.resolve(
    process.cwd(),
    "../../data/reports/real-budget-2004-2025-import-report.json",
  );

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Validated taxonomy rows: ${taxonomy.length}`);
  console.log(`Validated glossary rows: ${glossary.size}`);
  console.log(`Validated source rows: ${sources.length}`);
  console.log(`Validated mapping rows: ${mappings.length}`);
  console.log(`Validated fact rows: ${facts.length}`);
  console.log(`Validated admin spending fact rows: ${adminSpendingFacts.length}`);
  console.log(`Report written: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
