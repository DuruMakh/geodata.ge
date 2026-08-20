import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { REVENUE_DETAILED_YEARS, REVENUE_YEARS } from "../lib/data/coverage";
import { budgetFactsToCsv } from "../lib/data/factCsv";
import { TOTAL_ONLY_BUDGET_FACTS, TOTAL_ONLY_BUDGET_FACT_REPORT } from "../lib/data/totalOnlyBudgetFacts";
import { extractOfficialRevenueRows, extractOfficialWorkbookRevenueRows } from "../lib/data/realRevenue/extractWorkbooks";
import { generateLegacyAggregateRevenueFacts, generateRevenueFacts, type RealRevenueFactCsvRow } from "../lib/data/realRevenue/generateFacts";
import { validateRealRevenueFacts } from "../lib/data/realRevenue/validateRealRevenue";
import { YEAR_2004_REVENUE_FACTS } from "../lib/data/realRevenue/year2004Revenue";

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
  const detailedOfficialRows = officialRows.filter((row) => REVENUE_DETAILED_YEARS.includes(row.year));
  const facts = [
    ...YEAR_2004_REVENUE_FACTS,
    ...TOTAL_ONLY_BUDGET_FACTS.filter((row) => row.side === "revenue" && !REVENUE_DETAILED_YEARS.includes(row.year)),
    ...generateRevenueFacts(detailedOfficialRows),
  ];
  const report = {
    ...validateRealRevenueFacts(
      detailedOfficialRows,
      facts.filter((row) => REVENUE_DETAILED_YEARS.includes(row.year)) as RealRevenueFactCsvRow[],
      REVENUE_DETAILED_YEARS,
    ),
    importLabel: "real-revenue-2004-2025",
    years: REVENUE_YEARS,
    partialRows: YEAR_2004_REVENUE_FACTS,
    totalOnlyRows: TOTAL_ONLY_BUDGET_FACT_REPORT.rows.filter(
      (row) => row.side === "revenue" && !REVENUE_DETAILED_YEARS.includes(row.year),
    ),
  };
  const parserWarnings: string[] = [];
  const workbookRows = extractOfficialWorkbookRevenueRows(parserWarnings);
  const workbookYears = new Set(workbookRows.map((row) => row.year));
  const comparisonOfficialRows = detailedOfficialRows.filter((row) => workbookYears.has(row.year));
  const comparisonReport = {
    importLabel: "real-revenue-pdf-vs-workbook-2005-2025",
    basis: "state_budget_actual_gel",
    rows: compareAggregateFacts(generateLegacyAggregateRevenueFacts(workbookRows), generateLegacyAggregateRevenueFacts(comparisonOfficialRows)),
  };
  const importsDir = path.resolve(process.cwd(), "../../data/imports");
  const reportsDir = path.resolve(process.cwd(), "../../data/reports");

  await mkdir(importsDir, { recursive: true });
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(importsDir, "revenue-facts-2004-2025.csv"), budgetFactsToCsv(facts), "utf8");
  await writeFile(path.join(reportsDir, "real-revenue-2004-2025-report.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(path.join(reportsDir, "revenue-pdf-vs-workbook-2005-2025-report.json"), JSON.stringify(comparisonReport, null, 2), "utf8");

  console.error(`Parser warnings: ${parserWarnings.length}`);
  for (const warning of parserWarnings) console.error(`  - ${warning}`);

  if (Object.values(report.reconciliationStatusByYear).some((status) => status === "failed")) {
    throw new Error("Real revenue reconciliation failed. See data/reports/real-revenue-2004-2025-report.json");
  }

  console.log(`Generated revenue fact rows: ${facts.length}`);
  console.log("Report written: data/reports/real-revenue-2004-2025-report.json");
  console.log("Comparison written: data/reports/revenue-pdf-vs-workbook-2005-2025-report.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

