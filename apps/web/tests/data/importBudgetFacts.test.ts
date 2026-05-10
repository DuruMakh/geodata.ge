import { describe, expect, it } from "vitest";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";

describe("budget fact import validation", () => {
  it("loads sample budget facts with actual and planned basis", async () => {
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
          year: 2026,
          side: "revenue",
          itemId: "revenue.vat",
          basis: "planned",
        }),
      ]),
    );
  });

  it("keeps unmapped expenditure visible through explicit public field IDs", async () => {
    const rows = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const expenditureRows = rows.filter((row) => row.side === "expenditure");

    expect(expenditureRows.every((row) => row.publicSpendingFieldId)).toBe(true);
  });
});
