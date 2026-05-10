import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadGlossary } from "../lib/data/glossary";
import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";
import { loadSpendingMappings } from "../lib/data/mappings";
import { loadTaxonomyFiles } from "../lib/data/taxonomy";

async function main() {
  const taxonomy = await loadTaxonomyFiles("../../data/taxonomy");
  const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
  const mappings = await loadSpendingMappings("../../data/mappings/spending-field-mapping.csv");
  const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
  const report = buildImportReport("sample-budget-facts", facts);
  const missingGlossary = taxonomy.filter((item) => !glossary.has(item.id));

  if (missingGlossary.length > 0) {
    throw new Error(`Missing glossary rows: ${missingGlossary.map((item) => item.id).join(", ")}`);
  }

  const reportPath = path.resolve(
    process.cwd(),
    "../../data/reports/sample-budget-facts-report.json",
  );

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Validated taxonomy rows: ${taxonomy.length}`);
  console.log(`Validated glossary rows: ${glossary.size}`);
  console.log(`Validated mapping rows: ${mappings.length}`);
  console.log(`Validated fact rows: ${facts.length}`);
  console.log(`Report written: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
