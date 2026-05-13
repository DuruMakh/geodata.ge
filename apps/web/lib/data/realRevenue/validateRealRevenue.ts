import type { RealRevenueFactCsvRow } from "./generateFacts";
import type { OfficialRevenueRow, RealRevenueValidationReport } from "./types";

const roundingToleranceGel = 10;
const internalRevenueFlowCodes = ["1.3.3", "1.4.1.1.3"] as const;

const requiredRevenueFactIds = [
  "revenue.vat",
  "revenue.income_tax",
  "revenue.profit_tax",
  "revenue.excise_tax",
  "revenue.import_tax",
  "revenue.property_tax",
  "revenue.other_taxes",
  "revenue.grants",
  "revenue.other_revenue",
] as const;

function officialRevenueTotalGelByYear(rows: OfficialRevenueRow[]): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const row of rows.filter((candidate) => candidate.section === "revenues" && (candidate.sourceCode === "1" || candidate.labelKa === "შემოსავლები"))) {
    totals[row.year] = Math.round((row.consolidatedActualGel ?? row.actualThousandGel * 1000) - internalRevenueFlowGelForYear(rows, row.year));
  }

  return totals;
}

function grossOfficialRevenueTotalGelByYear(rows: OfficialRevenueRow[]): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const row of rows.filter((candidate) => candidate.section === "revenues" && (candidate.sourceCode === "1" || candidate.labelKa === "შემოსავლები"))) {
    totals[row.year] = Math.round(row.consolidatedActualGel ?? row.actualThousandGel * 1000);
  }

  return totals;
}

function internalRevenueFlowGelByYear(rows: OfficialRevenueRow[], years: number[]): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const year of years) {
    totals[year] = Math.round(internalRevenueFlowGelForYear(rows, year));
  }

  return totals;
}

function internalRevenueFlowGelForYear(rows: OfficialRevenueRow[], year: number): number {
  return internalRevenueFlowCodes.reduce((sum, sourceCode) => {
    const row = rows.find((candidate) => candidate.year === year && candidate.sourceCode === sourceCode);
    return sum + (row?.consolidatedActualGel ?? (row?.actualThousandGel ?? 0) * 1000);
  }, 0);
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
  const grossOfficialTotals = grossOfficialRevenueTotalGelByYear(officialRows);
  const internalFlowTotals = internalRevenueFlowGelByYear(officialRows, years);
  const generatedTotals = generatedTotalGelByYear(facts);
  const reconciliationStatusByYear: Record<number, "passed" | "failed"> = {};
  const warnings: string[] = [];

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

    for (const sourceCode of internalRevenueFlowCodes) {
      if (!officialRows.some((row) => row.year === year && row.sourceCode === sourceCode)) {
        missingRequirements.push(`${year} missing internal revenue flow row: ${sourceCode}`);
      }
    }

    if (missingRequirements.length === 0 && Math.abs(officialTotal - generatedTotal) <= roundingToleranceGel) {
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
    grossOfficialRevenueTotalGelByYear: grossOfficialTotals,
    internalRevenueFlowGelByYear: internalFlowTotals,
    officialRevenueTotalGelByYear: officialTotals,
    generatedRevenueTotalGelByYear: generatedTotals,
    reconciliationStatusByYear,
    warnings,
  };
}
