import { describe, expect, it } from "vitest";
import {
  buildParityReport,
  buildTotalsByKey,
  compareTotals,
  formatParityReport,
} from "../../lib/data/parityReport";

describe("parity report", () => {
  it("sums totals exactly by key with sorted keys", () => {
    const totals = buildTotalsByKey([
      { key: "2025:expenditure", amountGel: 100 },
      { key: "2024:expenditure", amountGel: "51441500" },
      { key: "2025:expenditure", amountGel: 23 },
    ]);

    expect(totals).toEqual({
      "2024:expenditure": "51441500.00",
      "2025:expenditure": "123.00",
    });
    expect(Object.keys(totals)).toEqual(["2024:expenditure", "2025:expenditure"]);
  });

  it("reports no mismatches when totals match exactly", () => {
    const csv = { "2025:revenue": "10.00", "2025:expenditure": "20.00" };
    const db = { "2025:expenditure": "20.00", "2025:revenue": "10.00" };

    expect(compareTotals(csv, db)).toEqual([]);
  });

  it("reports mismatched, missing, and extra keys", () => {
    const csv = { "2024:revenue": "10.00", "2025:revenue": "10.00" };
    const db = { "2024:revenue": "10.01", "2026:revenue": "5.00" };

    expect(compareTotals(csv, db)).toEqual([
      { key: "2024:revenue", csvTotal: "10.00", dbTotal: "10.01" },
      { key: "2025:revenue", csvTotal: "10.00", dbTotal: null },
      { key: "2026:revenue", csvTotal: null, dbTotal: "5.00" },
    ]);
  });

  it("passes only when counts and all totals match", () => {
    const matching = buildParityReport({
      counts: [{ table: "BudgetFact", csvRows: 504, dbRows: 504 }],
      budgetTotalsCsv: { "2025:revenue": "10.00" },
      budgetTotalsDb: { "2025:revenue": "10.00" },
      adminTotalsCsv: { "2025:admin_category": "7.00" },
      adminTotalsDb: { "2025:admin_category": "7.00" },
    });

    expect(matching.status).toBe("passed");

    const countBroken = buildParityReport({
      counts: [{ table: "BudgetFact", csvRows: 504, dbRows: 503 }],
      budgetTotalsCsv: {},
      budgetTotalsDb: {},
      adminTotalsCsv: {},
      adminTotalsDb: {},
    });

    expect(countBroken.status).toBe("failed");
    expect(countBroken.countMismatches).toEqual(["BudgetFact: csv=504 db=503"]);

    const totalBroken = buildParityReport({
      counts: [{ table: "BudgetFact", csvRows: 504, dbRows: 504 }],
      budgetTotalsCsv: { "2025:revenue": "10.00" },
      budgetTotalsDb: { "2025:revenue": "11.00" },
      adminTotalsCsv: {},
      adminTotalsDb: {},
    });

    expect(totalBroken.status).toBe("failed");
    expect(totalBroken.budgetTotalsMismatches).toHaveLength(1);
  });

  it("formats a readable report with OK/FAIL markers", () => {
    const report = buildParityReport({
      counts: [{ table: "BudgetFact", csvRows: 2, dbRows: 2 }],
      budgetTotalsCsv: { "2025:revenue": "10.00" },
      budgetTotalsDb: { "2025:revenue": "12.00" },
      adminTotalsCsv: {},
      adminTotalsDb: {},
    });
    const text = formatParityReport(report);

    expect(text).toContain("[OK ] BudgetFact: csv=2 db=2");
    expect(text).toContain("[FAIL] 2025:revenue: csv=10.00 db=12.00");
    expect(text).toContain("Parity status: FAILED");
  });

  it("includes NationalGdpFact row counts in parity output", () => {
    const report = buildParityReport({
      counts: [{ table: "NationalGdpFact", csvRows: 30, dbRows: 29 }],
      budgetTotalsCsv: {},
      budgetTotalsDb: {},
      adminTotalsCsv: {},
      adminTotalsDb: {},
    });

    expect(report.status).toBe("failed");
    expect(formatParityReport(report)).toContain("NationalGdpFact: csv=30 db=29");
  });

  it("prints FAIL lines for keys that exist only on the database side", () => {
    const report = buildParityReport({
      counts: [],
      budgetTotalsCsv: {},
      budgetTotalsDb: { "2026:revenue": "5.00" },
      adminTotalsCsv: {},
      adminTotalsDb: {},
    });
    const text = formatParityReport(report);

    expect(text).toContain("[FAIL] 2026:revenue: csv=(missing) db=5.00");
    expect(text).toContain("Parity status: FAILED");
  });
});
