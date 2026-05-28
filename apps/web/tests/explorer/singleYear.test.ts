import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";

const glossary = new Map<string, GlossaryEntry>([
  ["spending.health", { id: "spending.health", kaLabel: "ჯანმრთელობა", enLabel: "Health", description: "", notes: "" }],
  ["spending.education", { id: "spending.education", kaLabel: "განათლება", enLabel: "Education", description: "", notes: "" }],
  ["spending.defense", { id: "spending.defense", kaLabel: "თავდაცვა", enLabel: "Defense", description: "", notes: "" }],
  ["revenue.vat", { id: "revenue.vat", kaLabel: "დღგ", enLabel: "VAT", description: "", notes: "" }],
]);

const sourceDocuments: SourceDocumentRow[] = [
  {
    sourceId: "source.execution",
    sourceName: "Reviewed execution report",
    sourceUrlOrFile: "docs/execution",
    lastReviewedAt: "2026-05-10",
  },
  {
    sourceId: "source.audit",
    sourceName: "Reviewed audit table",
    sourceUrlOrFile: "docs/audit",
    lastReviewedAt: "2026-05-12",
  },
  {
    sourceId: "source.tail",
    sourceName: "Reviewed tail source",
    sourceUrlOrFile: "docs/tail",
    lastReviewedAt: "2026-05-13",
  },
];

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
      sourceDocuments,
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
    expect(model.source).toEqual({
      sourceName: "Multiple reviewed official sources",
      sourceUrlOrFile: "docs/execution; docs/audit",
      lastReviewedAt: "2026-05-12",
    });
  });

  it("allocates every100 whole GEL so the total is exactly 100", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments,
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

  it("does not create fake every100 allocation for a loaded zero-total year", () => {
    const model = buildSingleYearSnapshotModel({
      facts: [
        fact({ year: 2026, side: "expenditure", itemId: "spending.health", amountGel: 0 }),
        fact({ year: 2026, side: "expenditure", itemId: "spending.education", amountGel: 0 }),
      ],
      glossary,
      sourceDocuments,
      side: "expenditure",
      year: 2026,
    });

    expect(model.items).toHaveLength(2);
    expect(model.every100.map((item) => item.gelFrom100)).toEqual([0, 0]);
  });

  it("keeps a single source label when all facts resolve to the same official source", () => {
    const model = buildSingleYearSnapshotModel({
      facts: [
        fact({ year: 2026, side: "expenditure", itemId: "spending.health", amountGel: 100, sourceId: "source.execution" }),
        fact({ year: 2026, side: "expenditure", itemId: "spending.education", amountGel: 200, sourceId: "source.execution" }),
      ],
      glossary,
      sourceDocuments,
      side: "expenditure",
      year: 2026,
    });

    expect(model.source).toEqual({
      sourceName: "Reviewed execution report",
      sourceUrlOrFile: "docs/execution",
      lastReviewedAt: "2026-05-10",
    });
  });

  it("aggregates snapshot.other source metadata from omitted tail items only", () => {
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
      sourceDocuments,
      side: "expenditure",
      year: 2026,
    });
    const other = model.radarItems.find((item) => item.itemId === "snapshot.other");

    expect(model.radarItems).toHaveLength(8);
    expect(other?.source).toEqual({
      sourceName: "Reviewed tail source",
      sourceUrlOrFile: "docs/tail",
      lastReviewedAt: "2026-05-13",
    });
  });

  it("marks growth unavailable when no previous year exists", () => {
    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments,
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
      sourceDocuments,
      side: "revenue",
      year: 2024,
    });

    expect(model.items).toEqual([]);
    expect(model.source).toBeNull();
    expect(model.emptyReason).toBe("ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული.");
  });
});
