import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { budgetFactsToCsv } from "../lib/data/factCsv";
import { extractOfficialRevenueRows } from "../lib/data/realRevenue/extractWorkbooks";
import { generateRevenueFacts } from "../lib/data/realRevenue/generateFacts";
import { validateRealRevenueFacts } from "../lib/data/realRevenue/validateRealRevenue";

async function main() {
  const officialRows = extractOfficialRevenueRows();
  const facts = generateRevenueFacts(officialRows);
  const report = validateRealRevenueFacts(officialRows, facts, [2023, 2024, 2025]);
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(importsDir, "revenue-facts-2023-2025.csv"), budgetFactsToCsv(facts), "utf8");
  await writeFile(path.join(reportsDir, "real-revenue-2023-2025-report.json"), JSON.stringify(report, null, 2), "utf8");

  if (Object.values(report.reconciliationStatusByYear).some((status) => status === "failed")) {
    throw new Error("Real revenue reconciliation failed. See data/reports/real-revenue-2023-2025-report.json");
  }

  console.log(`Generated revenue fact rows: ${facts.length}`);
  console.log("Report written: data/reports/real-revenue-2023-2025-report.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
