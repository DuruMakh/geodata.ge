import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";

async function main() {
  const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
  const report = buildImportReport("sample-budget-facts", rows);

  console.log(JSON.stringify(report, null, 2));
  console.log("Database insert is intentionally deferred until Supabase DATABASE_URL is configured.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
