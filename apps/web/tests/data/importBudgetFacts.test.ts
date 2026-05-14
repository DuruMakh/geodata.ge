import { describe, expect, it } from "vitest";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";

describe("budget fact import validation", () => {
  it("loads sample budget facts inside the 2024-2025 fixture range", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          year: 2025,
          side: "expenditure",
          itemId: "spending.health",
          basis: "actual",
        }),
        expect.objectContaining({
          year: 2024,
          side: "revenue",
          itemId: "revenue.vat",
          basis: "actual",
        }),
      ]),
    );
  });

  it("keeps unmapped expenditure visible through explicit public field IDs", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const expenditureRows = rows.filter((row) => row.side === "expenditure");

    expect(expenditureRows.every((row) => row.publicSpendingFieldId)).toBe(true);
  });

  it("allows negative revenue correction rows but still rejects negative expenditure", async () => {
    const rows = await loadBudgetFactRows("tests/fixtures/negative-revenue-facts.csv");

    expect(rows.find((row) => row.itemId === "revenue.property_tax")?.amountGel).toBe(-11010);
    await expect(loadBudgetFactRows("tests/fixtures/negative-expenditure-facts.csv")).rejects.toThrow(
      "expenditure amount_gel must not be negative",
    );
  });
});
