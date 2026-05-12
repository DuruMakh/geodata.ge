import type { RealExpenditureFactCsvRow } from "./generateFacts";
import type { OfficialExpenditureRow, RealExpenditureValidationReport } from "./types";

const RECONCILIATION_TOLERANCE_GEL = 1000;

function addToYear(map: Record<number, number>, year: number, amount: number) {
  map[year] = (map[year] ?? 0) + amount;
}

export function validateRealExpenditureFacts(
  officialRows: OfficialExpenditureRow[],
  facts: RealExpenditureFactCsvRow[],
): RealExpenditureValidationReport {
  const years = Array.from(new Set(officialRows.map((row) => row.year))).sort((a, b) => a - b);
  const officialTotalGelByYear: Record<number, number> = {};
  const generatedTotalGelByYear: Record<number, number> = {};
  const unclassifiedAmountGelByYear: Record<number, number> = {};
  const unclassifiedShareByYear: Record<number, number> = {};
  const reconciliationStatusByYear: Record<number, "passed" | "failed"> = {};
  const warnings: string[] = [];

  for (const row of officialRows.filter((candidate) => candidate.isTotal)) {
    officialTotalGelByYear[row.year] = Math.round(row.actualThousandGel * 1000);
  }

  for (const fact of facts) {
    const amount = Number(fact.amount_gel);
    addToYear(generatedTotalGelByYear, fact.year, amount);

    if (fact.public_spending_field_id === "spending.other_unclassified") {
      addToYear(unclassifiedAmountGelByYear, fact.year, amount);
    }
  }

  for (const year of years) {
    const officialTotal = officialTotalGelByYear[year] ?? 0;
    const generatedTotal = generatedTotalGelByYear[year] ?? 0;
    const difference = Math.abs(officialTotal - generatedTotal);
    const unclassifiedAmount = unclassifiedAmountGelByYear[year] ?? 0;

    unclassifiedShareByYear[year] = officialTotal === 0 ? 0 : unclassifiedAmount / officialTotal;
    reconciliationStatusByYear[year] = difference <= RECONCILIATION_TOLERANCE_GEL ? "passed" : "failed";

    if (difference > RECONCILIATION_TOLERANCE_GEL) {
      warnings.push(`${year} reconciliation mismatch: official ${officialTotal}, generated ${generatedTotal}, difference ${difference}`);
    }

    if (unclassifiedAmount > 0) {
      warnings.push(`${year} unclassified expenditure: ${unclassifiedAmount} GEL (${unclassifiedShareByYear[year]})`);
    }
  }

  return {
    importLabel: "real-expenditure-2023-2025",
    years,
    sourceRows: officialRows.length,
    leafRows: officialRows.filter((row) => row.isLeafCode).length,
    generatedFactRows: facts.length,
    officialTotalGelByYear,
    generatedTotalGelByYear,
    unclassifiedAmountGelByYear,
    unclassifiedShareByYear,
    reconciliationStatusByYear,
    warnings,
  };
}
