import { loadBudgetFactRows } from "../lib/data/importBudgetFacts";
import { buildImportReport } from "../lib/data/importReport";

async function main() {
  const rows = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
  const report = buildImportReport("real-expenditure-2023-2025", rows);

  console.log(JSON.stringify(report, null, 2));
  console.log("Database insert is intentionally deferred until Supabase DATABASE_URL is configured.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
