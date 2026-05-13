import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { budgetFactsToCsv } from "../lib/data/factCsv";
import { extractOfficialExpenditureRows } from "../lib/data/realExpenditure/extractWorkbooks";
import { generateBudgetFactsFromReviewedMappings } from "../lib/data/realExpenditure/generateFacts";
import { loadCandidateMappingReviewRows } from "../lib/data/realExpenditure/reviewMappings";
import { validateRealExpenditureFacts } from "../lib/data/realExpenditure/validateRealExpenditure";

async function main() {
  const officialRows = extractOfficialExpenditureRows();
  const mappings = await loadCandidateMappingReviewRows("../../data/mappings/review/spending-field-mapping-review-2023-2025.csv");
  const facts = generateBudgetFactsFromReviewedMappings(officialRows, mappings);
  const report = validateRealExpenditureFacts(officialRows, facts);
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(importsDir, "expenditure-facts-2023-2025.csv"), budgetFactsToCsv(facts), "utf8");
  await writeFile(path.join(reportsDir, "real-expenditure-2023-2025-report.json"), JSON.stringify(report, null, 2), "utf8");

  if (Object.values(report.reconciliationStatusByYear).some((status) => status === "failed")) {
    throw new Error("Real expenditure reconciliation failed. See data/reports/real-expenditure-2023-2025-report.json");
  }

  console.log(`Generated fact rows: ${facts.length}`);
  console.log("Report written: data/reports/real-expenditure-2023-2025-report.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
