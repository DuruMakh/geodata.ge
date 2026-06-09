import { describe, expect, it } from "vitest";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { buildImportReport } from "../../lib/data/importReport";

describe("import validation report", () => {
  it("summarizes rows, basis counts, and totals", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const report = buildImportReport("sample import", rows);

    expect(report.rowsRead).toBe(6);
    expect(report.rowsImported).toBe(6);
    expect(report.actualRows).toBe(6);
    expect(report.plannedRows).toBe(0);
    expect(report.totalRevenueGel).toBe(22500000000);
    expect(report.totalExpenditureGel).toBe(17800000000);
  });

  it("surfaces negative revenue correction rows as report warnings", async () => {
    const rows = await loadBudgetFactRows("tests/fixtures/negative-revenue-facts.csv");
    const report = buildImportReport("negative revenue fixture", rows);

    expect(report.reconciliationStatus).toBe("warning");
    expect(report.warnings).toContain("1 negative revenue correction row(s) retained");
  });
});
