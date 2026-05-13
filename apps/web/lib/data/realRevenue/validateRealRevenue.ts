import type { RealRevenueFactCsvRow } from "./generateFacts";
import type { OfficialRevenueRow, RealRevenueValidationReport } from "./types";

const requiredRevenueFactIds = [
  "revenue.taxes_total",
  "revenue.grants",
  "revenue.other_revenue",
] as const;

function officialRevenueTotalGelByYear(rows: OfficialRevenueRow[]): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const row of rows.filter((candidate) => candidate.section === "revenues" && candidate.labelKa === "შემოსავლები")) {
    totals[row.year] = Math.round(row.actualThousandGel * 1000);
  }

  return totals;
}

function generatedTotalGelByYear(rows: RealRevenueFactCsvRow[]): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const row of rows) {
    totals[row.year] = (totals[row.year] ?? 0) + Number(row.amount_gel);
  }

  return totals;
}

export function validateRealRevenueFacts(
  officialRows: OfficialRevenueRow[],
  facts: RealRevenueFactCsvRow[],
  expectedYears?: number[],
): RealRevenueValidationReport {
  const years = Array.from(new Set(expectedYears ?? officialRows.map((row) => row.year))).sort((a, b) => a - b);
  const officialTotals = officialRevenueTotalGelByYear(officialRows);
  const generatedTotals = generatedTotalGelByYear(facts);
  const reconciliationStatusByYear: Record<number, "passed" | "failed"> = {};
  const warnings = ["tax_breakdown_missing_from_current_workbooks"];

  for (const year of years) {
    const officialTotal = officialTotals[year] ?? 0;
    const generatedTotal = generatedTotals[year] ?? 0;
    const missingRequirements: string[] = [];

    if (officialTotals[year] === undefined) {
      missingRequirements.push(`${year} missing official revenue total row`);
    }

    for (const itemId of requiredRevenueFactIds) {
      if (!facts.some((fact) => fact.year === year && fact.item_id === itemId)) {
        missingRequirements.push(`${year} missing generated revenue fact: ${itemId}`);
      }
    }

    if (missingRequirements.length === 0 && officialTotal === generatedTotal) {
      reconciliationStatusByYear[year] = "passed";
      continue;
    }

    reconciliationStatusByYear[year] = "failed";
    warnings.unshift(...missingRequirements);
    if (officialTotal !== generatedTotal) {
      warnings.unshift(`${year} revenue reconciliation mismatch: official ${officialTotal}, generated ${generatedTotal}`);
    }
  }

  return {
    importLabel: "real-revenue-2023-2025",
    years,
    sourceRows: officialRows.length,
    generatedFactRows: facts.length,
    officialRevenueTotalGelByYear: officialTotals,
    generatedRevenueTotalGelByYear: generatedTotals,
    reconciliationStatusByYear,
    warnings,
  };
}
