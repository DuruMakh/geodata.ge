import type { BudgetFactImportRow } from "./importBudgetFacts";

export type ImportReport = {
  importLabel: string;
  rowsRead: number;
  rowsImported: number;
  totalRevenueGel: number;
  totalExpenditureGel: number;
  unclassifiedAmountGel: number;
  unclassifiedShare: number;
  plannedRows: number;
  actualRows: number;
  reconciliationStatus: "passed" | "warning";
  warnings: string[];
};

function totalForSide(rows: BudgetFactImportRow[], side: "revenue" | "expenditure"): number {
  const totalItemId = side === "revenue" ? "revenue.total" : "expenditure.total";
  const explicitTotals = rows.filter((row) => row.side === side && row.itemId === totalItemId);
  if (explicitTotals.length > 0) return explicitTotals.reduce((sum, row) => sum + row.amountGel, 0);

  return rows
    .filter((row) => row.side === side && row.itemId !== totalItemId)
    .reduce((sum, row) => sum + row.amountGel, 0);
}

export function buildImportReport(
  importLabel: string,
  rows: BudgetFactImportRow[],
): ImportReport {
  const totalRevenueGel = totalForSide(rows, "revenue");
  const totalExpenditureGel = totalForSide(rows, "expenditure");
  const unclassifiedAmountGel = rows
    .filter((row) => row.publicSpendingFieldId === "spending.other_unclassified")
    .reduce((sum, row) => sum + row.amountGel, 0);
  const plannedRows = rows.filter((row) => row.basis === "planned").length;
  const actualRows = rows.filter((row) => row.basis === "actual").length;
  const negativeRevenueRows = rows.filter((row) => row.side === "revenue" && row.amountGel < 0);
  const warnings: string[] = [];

  if (unclassifiedAmountGel > 0) {
    warnings.push(`${unclassifiedAmountGel} GEL assigned to Other / unclassified`);
  }

  if (negativeRevenueRows.length > 0) {
    warnings.push(`${negativeRevenueRows.length} negative revenue correction row(s) retained`);
  }

  return {
    importLabel,
    rowsRead: rows.length,
    rowsImported: rows.length,
    totalRevenueGel,
    totalExpenditureGel,
    unclassifiedAmountGel,
    unclassifiedShare:
      totalExpenditureGel === 0 ? 0 : unclassifiedAmountGel / totalExpenditureGel,
    plannedRows,
    actualRows,
    reconciliationStatus: warnings.length === 0 ? "passed" : "warning",
    warnings,
  };
}

