import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";

const glossary = new Map<string, GlossaryEntry>([
  ["spending.health", { id: "spending.health", kaLabel: "ჯანმრთელობა", enLabel: "Health", description: "", notes: "" }],
  ["spending.education", { id: "spending.education", kaLabel: "განათლება", enLabel: "Education", description: "", notes: "" }],
  ["spending.defense", { id: "spending.defense", kaLabel: "თავდაცვა", enLabel: "Defense", description: "", notes: "" }],
  ["revenue.vat", { id: "revenue.vat", kaLabel: "დღგ", enLabel: "VAT", description: "", notes: "" }],
]);

function fact(row: Partial<BudgetFactImportRow> & Pick<BudgetFactImportRow, "year" | "side" | "itemId" | "amountGel">): BudgetFactImportRow {
  return {
    basis: "actual",
    sourceId: "source.execution",
    officialInstitution: null,
    officialProgram: null,
    officialSubprogram: null,
    publicSpendingFieldId: row.side === "expenditure" ? row.itemId : null,
    mappingConfidence: row.side === "expenditure" ? "high" : null,
    mappingNotes: "",
    ...row,
  };
}

const facts: BudgetFactImportRow[] = [
  fact({ year: 2023, side: "expenditure", itemId: "spending.health", amountGel: 250 }),
  fact({ year: 2024, side: "expenditure", itemId: "spending.health", amountGel: 400 }),
  fact({ year: 2024, side: "expenditure", itemId: "spending.education", amountGel: 200 }),
  fact({ year: 2024, side: "expenditure", itemId: "spending.defense", amountGel: 100 }),
  fact({ year: 2025, side: "expenditure", itemId: "spending.health", amountGel: 500 }),
  fact({ year: 2025, side: "expenditure", itemId: "spending.education", amountGel: 350, sourceId: "source.audit" }),
  fact({ year: 2025, side: "expenditure", itemId: "spending.defense", amountGel: 200 }),
  fact({ year: 2025, side: "revenue", itemId: "revenue.vat", amountGel: 900 }),
];

describe("single-year snapshot model", () => {
  it("builds 2025 expenditure totals, shares, growth, rankings, and headline cards", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      side: "expenditure",
      year: 2025,
    });

    expect(model.totalGel).toBe(1050);
    expect(model.previousYear).toBe(2024);
    expect(model.basis).toBe("actual");
    expect(model.hasGrowthData).toBe(true);
    expect(model.items.map((item) => item.itemId)).toEqual(["spending.health", "spending.education", "spending.defense"]);
    expect(model.radarItems.map((item) => item.itemId)).toEqual(["spending.health", "spending.education", "spending.defense"]);
    expect(model.rankingRows.map((item) => item.itemId)).toEqual(["spending.health", "spending.education", "spending.defense"]);
    expect(model.items[0]).toEqual(expect.objectContaining({
      itemId: "spending.health",
      amountGel: 500,
      previousAmountGel: 400,
      changeFromPreviousYear: 0.25,
      amountChangeFromPreviousYear: 100,
      shareOfTotal: 500 / 1050,
    }));
    expect(model.items.find((item) => item.itemId === "spending.education")?.amountChangeFromPreviousYear).toBe(150);
    expect(model.items.find((item) => item.itemId === "spending.defense")?.changeFromPreviousYear).toBe(1);
    expect(model.headlineCards.map((card) => card.id)).toEqual(["total", "largest", "fastest_growth", "largest_increase"]);
  });

  it("allocates every100 whole GEL so the total is exactly 100", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      side: "expenditure",
      year: 2025,
    });

    expect(model.every100.map((item) => [item.itemId, item.gelFrom100])).toEqual([
      ["spending.health", 48],
      ["spending.education", 33],
      ["spending.defense", 19],
    ]);
    expect(model.every100.reduce((sum, item) => sum + item.gelFrom100, 0)).toBe(100);
  });

  it("keeps zero rows in the ranking but out of the drawn allocations", () => {
    const model = buildSingleYearSnapshotModel({
      facts: [
        fact({ year: 2026, side: "expenditure", itemId: "spending.health", amountGel: 0 }),
        fact({ year: 2026, side: "expenditure", itemId: "spending.education", amountGel: 0 }),
      ],
      glossary,
      side: "expenditure",
      year: 2026,
    });

    // Every official row stays visible in ranking/counts; geometry sections
    // (every-100, radar) draw only positive rows, so they stay empty here.
    expect(model.emptyReason).toBeNull();
    expect(model.items).toHaveLength(2);
    expect(model.rankingRows).toHaveLength(2);
    expect(model.every100).toEqual([]);
    expect(model.radarItems).toEqual([]);
  });

  it("keeps negative rows in the ranking with true-total shares while cells still sum to 100", () => {
    const model = buildSingleYearSnapshotModel({
      facts: [
        fact({ year: 2026, side: "revenue", itemId: "revenue.vat", amountGel: 900 }),
        fact({ year: 2026, side: "revenue", itemId: "revenue.income_tax", amountGel: 150 }),
        fact({ year: 2026, side: "revenue", itemId: "revenue.other_taxes", amountGel: -50 }),
      ],
      glossary,
      side: "revenue",
      year: 2026,
    });

    expect(model.totalGel).toBe(1000);
    // All official rows are items (count/ranking match the total); negative last.
    expect(model.items.map((item) => item.itemId)).toEqual(["revenue.vat", "revenue.income_tax", "revenue.other_taxes"]);
    // Shares are of the true total, so the visible rows reconcile with "სულ".
    expect(model.items.map((item) => item.shareOfTotal)).toEqual([0.9, 0.15, -0.05]);
    expect(model.items.reduce((sum, item) => sum + item.shareOfTotal, 0)).toBeCloseTo(1);
    // The 100-cell grid draws positive rows only and still allocates exactly 100.
    expect(model.every100.map((item) => item.itemId)).toEqual(["revenue.vat", "revenue.income_tax"]);
    expect(model.every100.reduce((sum, item) => sum + item.gelFrom100, 0)).toBe(100);
  });

  it("collapses the omitted tail into a single snapshot.other radar item", () => {
    const manyFacts = Array.from({ length: 9 }, (_, index) =>
      fact({
        year: 2026,
        side: "expenditure",
        itemId: `spending.item_${index + 1}`,
        amountGel: 90 - index,
        sourceId: index < 7 ? "source.execution" : "source.tail",
      }),
    );

    const model = buildSingleYearSnapshotModel({
      facts: manyFacts,
      glossary,
      side: "expenditure",
      year: 2026,
    });
    const other = model.radarItems.find((item) => item.itemId === "snapshot.other");

    expect(model.radarItems).toHaveLength(8);
    expect(other?.amountGel).toBe(manyFacts.slice(7).reduce((sum, row) => sum + row.amountGel, 0));
  });

  it("marks growth unavailable when no previous year exists", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      side: "expenditure",
      year: 2023,
    });

    expect(model.previousYear).toBeNull();
    expect(model.hasGrowthData).toBe(false);
    expect(model.items.every((item) => item.changeFromPreviousYear === null)).toBe(true);
    expect(model.items.every((item) => item.amountChangeFromPreviousYear === null)).toBe(true);
  });

  it("returns a Georgian empty state when revenue data is missing for the year", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      side: "revenue",
      year: 2024,
    });

    expect(model.items).toEqual([]);
    expect(model.emptyReason).toBe("ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული.");
  });
  it("shows totals-only years without category breakdowns", () => {
    const model = buildSingleYearSnapshotModel({
      facts: [fact({ year: 2005, side: "expenditure", itemId: "expenditure.total", amountGel: 2000, publicSpendingFieldId: null, mappingConfidence: null })],
      glossary,
      side: "expenditure",
      year: 2005,
    });

    expect(model.totalGel).toBe(2000);
    expect(model.items).toEqual([]);
    expect(model.rankingRows).toEqual([]);
    expect(model.every100).toEqual([]);
    expect(model.radarItems).toEqual([]);
  });
});
