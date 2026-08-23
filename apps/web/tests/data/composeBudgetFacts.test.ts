import { describe, expect, it } from "vitest";
import { budgetRowsToCsvRows } from "../../scripts/compose-budget-facts";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";

function importRow(year: number, itemId: string): BudgetFactImportRow {
  return {
    year,
    side: "expenditure",
    itemId,
    amountGel: 1,
    basis: "actual",
    sourceId: "source.test_fixture",
    officialInstitution: null,
    officialProgram: null,
    officialSubprogram: null,
    publicSpendingFieldId: null,
    mappingConfidence: null,
    mappingNotes: "",
  };
}

describe("budgetRowsToCsvRows", () => {
  it("sorts by year, then side, then item id", () => {
    const sorted = budgetRowsToCsvRows([
      importRow(2025, "spending.health"),
      importRow(2004, "spending.defense"),
      importRow(2004, "spending.agriculture"),
    ]);

    expect(sorted.map((row) => `${row.year}:${row.item_id}`)).toEqual([
      "2004:spending.agriculture",
      "2004:spending.defense",
      "2025:spending.health",
    ]);
  });

  it("does not reorder the caller's array", () => {
    const rows = [
      importRow(2025, "spending.health"),
      importRow(2004, "spending.defense"),
      importRow(2004, "spending.agriculture"),
    ];

    budgetRowsToCsvRows(rows);

    expect(rows.map((row) => `${row.year}:${row.itemId}`)).toEqual([
      "2025:spending.health",
      "2004:spending.defense",
      "2004:spending.agriculture",
    ]);
  });
});
