import { describe, expect, it } from "vitest";
import { budgetFactsToCsv } from "../../lib/data/factCsv";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import { budgetRowsToCsvRows } from "../../scripts/compose-budget-facts";

function row(year: number, side: "revenue" | "expenditure", itemId: string): BudgetFactImportRow {
  return {
    year,
    side,
    itemId,
    amountGel: 100,
    basis: "actual",
    sourceId: side === "revenue" ? "source.mof_2025_tavi1_actual" : "source.mof_2025_tavi6_actual",
    officialInstitution: side === "revenue" ? null : "Multiple official rows",
    officialProgram: null,
    officialSubprogram: null,
    publicSpendingFieldId: side === "revenue" ? null : itemId,
    mappingConfidence: side === "revenue" ? null : "high",
    mappingNotes: "Source row",
  };
}

describe("budget fact CSV composition", () => {
  it("serializes composed side files with the same canonical writer", () => {
    const csvRows = budgetRowsToCsvRows([
      row(2025, "expenditure", "spending.health"),
      row(2025, "revenue", "revenue.grants"),
    ]);

    expect(budgetFactsToCsv(csvRows)).toContain("revenue,revenue.grants");
    expect(budgetFactsToCsv(csvRows)).toContain("expenditure,spending.health");
  });
});
