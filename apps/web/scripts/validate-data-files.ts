import { writeFile } from "node:fs/promises";
import path from "node:path";
import { validateFoundationReferences } from "../lib/data/foundationValidation";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";
import { loadSpendingMappings } from "../lib/data/mappings";
import { loadSourceDocuments } from "../lib/data/sources";
import { loadTaxonomyFiles } from "../lib/data/taxonomy";
import { budgetRowsToCsvRows } from "./compose-budget-facts";

function composedFactsMatchSideFiles(
  expenditureRows: Awaited<ReturnType<typeof loadBudgetFactRows>>,
  revenueRows: Awaited<ReturnType<typeof loadBudgetFactRows>>,
  facts: Awaited<ReturnType<typeof loadBudgetFactRows>>,
): boolean {
  return JSON.stringify(budgetRowsToCsvRows([...expenditureRows, ...revenueRows])) === JSON.stringify(budgetRowsToCsvRows(facts));
}

async function main() {
  const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
  const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
  const sources = await loadSourceDocuments("../../data/sources/source-documents.csv");
  const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");
  const expenditureRows = await loadBudgetFactRows("../../data/imports/expenditure-facts-2017-2025.csv");
  const revenueRows = await loadBudgetFactRows("../../data/imports/revenue-facts-2023-2025.csv");
  const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2017-2025.csv");
  const report = buildImportReport("real-budget-2017-2025", facts);
  const missingGlossary = taxonomy.filter((item) => !glossary.has(item.id));

  if (missingGlossary.length > 0) {
    throw new Error(`Missing glossary rows: ${missingGlossary.map((item) => item.id).join(", ")}`);
  }

  validateFoundationReferences({ taxonomy, sources, mappings, facts });
  if (!composedFactsMatchSideFiles(expenditureRows, revenueRows, facts)) {
    throw new Error("Combined budget facts are stale. Run npm run data:compose-budget-facts.");
  }

  const reportPath = path.resolve(
    process.cwd(),
    "../../data/reports/real-budget-2017-2025-import-report.json",
  );

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Validated taxonomy rows: ${taxonomy.length}`);
  console.log(`Validated glossary rows: ${glossary.size}`);
  console.log(`Validated source rows: ${sources.length}`);
  console.log(`Validated mapping rows: ${mappings.length}`);
  console.log(`Validated fact rows: ${facts.length}`);
  console.log(`Report written: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
