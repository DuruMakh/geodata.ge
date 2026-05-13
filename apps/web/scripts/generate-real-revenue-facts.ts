import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { budgetFactsToCsv } from "../lib/data/factCsv";
import { extractOfficialRevenueRows, extractOfficialWorkbookRevenueRows } from "../lib/data/realRevenue/extractWorkbooks";
import { generateLegacyAggregateRevenueFacts, generateRevenueFacts, type RealRevenueFactCsvRow } from "../lib/data/realRevenue/generateFacts";
import { validateRealRevenueFacts } from "../lib/data/realRevenue/validateRealRevenue";

function comparisonKey(row: RealRevenueFactCsvRow): string {
  return `${row.year}:${row.item_id}`;
}

function compareAggregateFacts(workbookFacts: RealRevenueFactCsvRow[], pdfAggregateFacts: RealRevenueFactCsvRow[]) {
  const workbookByKey = new Map(workbookFacts.map((row) => [comparisonKey(row), row]));

  return pdfAggregateFacts.map((pdfRow) => {
    const workbookRow = workbookByKey.get(comparisonKey(pdfRow));
    const pdfAmountGel = Number(pdfRow.amount_gel);
    const workbookAmountGel = workbookRow ? Number(workbookRow.amount_gel) : null;

    return {
      year: pdfRow.year,
      itemId: pdfRow.item_id,
      pdfStateBudgetGel: pdfAmountGel,
      workbookStateBudgetGel: workbookAmountGel,
      deltaGel: workbookAmountGel === null ? null : pdfAmountGel - workbookAmountGel,
      pdfSourceId: pdfRow.source_id,
      workbookSourceId: workbookRow?.source_id ?? null,
    };
  });
}

async function main() {
  const officialRows = await extractOfficialRevenueRows();
  const facts = generateRevenueFacts(officialRows);
  const report = validateRealRevenueFacts(officialRows, facts, [2023, 2024, 2025]);
  const workbookRows = extractOfficialWorkbookRevenueRows();
  const comparisonReport = {
    importLabel: "real-revenue-pdf-vs-workbook-2023-2025",
    basis: "state_budget_actual_gel",
    rows: compareAggregateFacts(generateLegacyAggregateRevenueFacts(workbookRows), generateLegacyAggregateRevenueFacts(officialRows)),
  };
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(importsDir, "revenue-facts-2023-2025.csv"), budgetFactsToCsv(facts), "utf8");
  await writeFile(path.join(reportsDir, "real-revenue-2023-2025-report.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(path.join(reportsDir, "revenue-pdf-vs-workbook-2023-2025-report.json"), JSON.stringify(comparisonReport, null, 2), "utf8");

  if (Object.values(report.reconciliationStatusByYear).some((status) => status === "failed")) {
    throw new Error("Real revenue reconciliation failed. See data/reports/real-revenue-2023-2025-report.json");
  }

  console.log(`Generated revenue fact rows: ${facts.length}`);
  console.log("Report written: data/reports/real-revenue-2023-2025-report.json");
  console.log("Comparison written: data/reports/revenue-pdf-vs-workbook-2023-2025-report.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
