import type { RealRevenueFactCsvRow } from "./generateFacts";
import type { OfficialRevenueRow, RealRevenueValidationReport } from "./types";

const roundingToleranceGel = 10;
const internalGrantCode = "1.3.3";
const internalOtherRevenueCode = "1.4.1.1.3";
const internalRevenueFlowCodes = [internalGrantCode, internalOtherRevenueCode] as const;
const receiptSourceCodes = ["31", "32", "33"] as const;
const oldRevenueCodes = {
  taxTotal: "010000000000",
  otherRevenue: "020000000000",
  assetDecrease: "030000000000",
  grants: "040000000000",
  increaseLiabilities: "050000000000",
} as const;
const sourceCodeFallbacks: Record<string, string[]> = {
  "1.3.3": ["133"],
  "1.4.1.1.3": ["14111"],
};
const netRevenueFactIds = [
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

const requiredRevenueFactIds = [
  ...netRevenueFactIds,
  "revenue.asset_decrease",
  "revenue.increase_liabilities",
] as const;

function consolidatedGel(row: OfficialRevenueRow | undefined): number {
  return row?.consolidatedActualGel ?? (row?.actualThousandGel ?? 0) * 1000;
}

function rowBySourceCode(rows: OfficialRevenueRow[], year: number, sourceCode: string): OfficialRevenueRow | undefined {
  const sourceCodes = [sourceCode, ...(sourceCodeFallbacks[sourceCode] ?? [])];
  return rows.find((row) => row.year === year && sourceCodes.includes(row.sourceCode ?? ""));
}

function roundedRowAmount(rows: OfficialRevenueRow[], year: number, sourceCode: string): number {
  return Math.round(consolidatedGel(rowBySourceCode(rows, year, sourceCode)));
}

function isOldRevenueYear(rows: OfficialRevenueRow[], year: number): boolean {
  return Boolean(rowBySourceCode(rows, year, oldRevenueCodes.taxTotal));
}

function grossOfficialRevenueTotalGelByYear(rows: OfficialRevenueRow[]): Record<number, number> {
  const totals: Record<number, number> = {};
  const years = Array.from(new Set(rows.map((row) => row.year)));

  for (const year of years) {
    if (isOldRevenueYear(rows, year)) {
      totals[year] = Math.round(
        roundedRowAmount(rows, year, oldRevenueCodes.taxTotal)
          + roundedRowAmount(rows, year, oldRevenueCodes.otherRevenue)
          + roundedRowAmount(rows, year, oldRevenueCodes.grants),
      );
      continue;
    }

    const row = rowBySourceCode(rows, year, "1");
    if (row) totals[year] = Math.round(consolidatedGel(row));
  }

  return totals;
}

function amountByYear(years: number[], amountForYear: (year: number) => number): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const year of years) {
    totals[year] = amountForYear(year);
  }

  return totals;
}

function generatedTotalGelByYear(
  rows: RealRevenueFactCsvRow[],
  includeRow: (row: RealRevenueFactCsvRow) => boolean,
): Record<number, number> {
  const totals: Record<number, number> = {};

  for (const row of rows.filter(includeRow)) {
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
  const grossOfficialTotals = grossOfficialRevenueTotalGelByYear(officialRows);
  const internalGrantsRemoved = amountByYear(years, (year) => isOldRevenueYear(officialRows, year) ? 0 : roundedRowAmount(officialRows, year, internalGrantCode));
  const internalOtherRevenueRemoved = amountByYear(years, (year) => isOldRevenueYear(officialRows, year) ? 0 : roundedRowAmount(officialRows, year, internalOtherRevenueCode));
  const internalFlowTotals = amountByYear(years, (year) => internalGrantsRemoved[year] + internalOtherRevenueRemoved[year]);
  const officialRevenueTotals = amountByYear(years, (year) => (grossOfficialTotals[year] ?? 0) - internalFlowTotals[year]);
  const assetDecreaseTotals = amountByYear(
    years,
    (year) => isOldRevenueYear(officialRows, year)
      ? roundedRowAmount(officialRows, year, oldRevenueCodes.assetDecrease)
      : roundedRowAmount(officialRows, year, "31") + roundedRowAmount(officialRows, year, "32"),
  );
  const liabilitiesIncreaseTotals = amountByYear(
    years,
    (year) => isOldRevenueYear(officialRows, year)
      ? roundedRowAmount(officialRows, year, oldRevenueCodes.increaseLiabilities)
      : roundedRowAmount(officialRows, year, "33"),
  );
  const finalReceiptsTotals = amountByYear(
    years,
    (year) => officialRevenueTotals[year] + assetDecreaseTotals[year] + liabilitiesIncreaseTotals[year],
  );
  const generatedRevenueTotals = generatedTotalGelByYear(
    facts,
    (row) => netRevenueFactIds.includes(row.item_id as (typeof netRevenueFactIds)[number]),
  );
  const generatedReceiptsTotals = generatedTotalGelByYear(facts, () => true);
  const reconciliationStatusByYear: Record<number, "passed" | "failed"> = {};
  const warnings: string[] = [];

  for (const year of years) {
    const finalReceiptsTotal = finalReceiptsTotals[year] ?? 0;
    const generatedReceiptsTotal = generatedReceiptsTotals[year] ?? 0;
    const missingRequirements: string[] = [];

    if (grossOfficialTotals[year] === undefined) {
      missingRequirements.push(`${year} missing official revenue total row`);
    }

    for (const itemId of requiredRevenueFactIds) {
      if (!facts.some((fact) => fact.year === year && fact.item_id === itemId)) {
        missingRequirements.push(`${year} missing generated revenue fact: ${itemId}`);
      }
    }

    if (!isOldRevenueYear(officialRows, year)) {
      for (const sourceCode of internalRevenueFlowCodes) {
        if (!rowBySourceCode(officialRows, year, sourceCode)) {
          missingRequirements.push(`${year} missing internal revenue flow row: ${sourceCode}`);
        }
      }
    }

    const requiredReceiptSourceCodes = isOldRevenueYear(officialRows, year)
      ? [oldRevenueCodes.assetDecrease, oldRevenueCodes.increaseLiabilities]
      : receiptSourceCodes;
    for (const sourceCode of requiredReceiptSourceCodes) {
      if (!rowBySourceCode(officialRows, year, sourceCode)) {
        missingRequirements.push(`${year} missing receipt source row: ${sourceCode}`);
      }
    }

    if (missingRequirements.length === 0 && Math.abs(finalReceiptsTotal - generatedReceiptsTotal) <= roundingToleranceGel) {
      reconciliationStatusByYear[year] = "passed";
      continue;
    }

    reconciliationStatusByYear[year] = "failed";
    warnings.unshift(...missingRequirements);
    if (finalReceiptsTotal !== generatedReceiptsTotal) {
      warnings.unshift(`${year} receipts reconciliation mismatch: official ${finalReceiptsTotal}, generated ${generatedReceiptsTotal}`);
    }
  }

  return {
    importLabel: "real-revenue-2005-2025",
    years,
    sourceRows: officialRows.length,
    generatedFactRows: facts.length,
    grossOfficialRevenueTotalGelByYear: grossOfficialTotals,
    internalRevenueFlowGelByYear: internalFlowTotals,
    internalGrantsRemovedGelByYear: internalGrantsRemoved,
    internalOtherRevenueRemovedGelByYear: internalOtherRevenueRemoved,
    officialRevenueTotalGelByYear: officialRevenueTotals,
    generatedRevenueTotalGelByYear: generatedRevenueTotals,
    assetDecreaseGelByYear: assetDecreaseTotals,
    liabilitiesIncreaseGelByYear: liabilitiesIncreaseTotals,
    finalReceiptsTotalGelByYear: finalReceiptsTotals,
    generatedReceiptsTotalGelByYear: generatedReceiptsTotals,
    reconciliationStatusByYear,
    warnings,
  };
}
