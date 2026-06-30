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
  it("uses explicit official totals instead of double-counting detail rows", () => {
    const report = buildImportReport("mixed totals", [
      { year: 2005, side: "revenue", itemId: "revenue.total", amountGel: 1000, basis: "actual", sourceId: "source.total", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: null, mappingConfidence: null, mappingNotes: "" },
      { year: 2005, side: "revenue", itemId: "revenue.vat", amountGel: 400, basis: "actual", sourceId: "source.detail", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: null, mappingConfidence: null, mappingNotes: "" },
      { year: 2005, side: "expenditure", itemId: "expenditure.total", amountGel: 2000, basis: "actual", sourceId: "source.total", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: null, mappingConfidence: null, mappingNotes: "" },
      { year: 2005, side: "expenditure", itemId: "spending.health", amountGel: 700, basis: "actual", sourceId: "source.detail", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
    ]);

    expect(report.totalRevenueGel).toBe(1000);
    expect(report.totalExpenditureGel).toBe(2000);
  });
});
