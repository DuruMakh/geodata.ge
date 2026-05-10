import { describe, expect, it } from "vitest";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { buildImportReport } from "../../lib/data/importReport";

describe("import validation report", () => {
  it("summarizes rows, basis counts, and totals", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const report = buildImportReport("sample import", rows);

    expect(report.rowsRead).toBe(6);
    expect(report.rowsImported).toBe(6);
    expect(report.actualRows).toBe(4);
    expect(report.plannedRows).toBe(2);
    expect(report.totalRevenueGel).toBe(22500000000);
    expect(report.totalExpenditureGel).toBe(17800000000);
  });
});
