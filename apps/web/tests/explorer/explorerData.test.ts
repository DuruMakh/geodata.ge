import { describe, expect, it } from "vitest";
import { buildExplorerModel, getDefaultSelection } from "../../lib/explorer/explorerData";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { BudgetFactImportRow } from "../../lib/data/importBudgetFacts";
import type { SourceDocumentRow } from "../../lib/data/sources";

const glossary = new Map<string, GlossaryEntry>([
  ["spending.health", { id: "spending.health", kaLabel: "ჯანმრთელობა", enLabel: "Health", description: "", notes: "" }],
  ["spending.education", { id: "spending.education", kaLabel: "განათლება", enLabel: "Education", description: "", notes: "" }],
  ["revenue.vat", { id: "revenue.vat", kaLabel: "დღგ", enLabel: "VAT", description: "", notes: "" }],
]);

const facts: BudgetFactImportRow[] = [
  { year: 2025, side: "expenditure", itemId: "spending.health", amountGel: 100, basis: "actual", sourceId: "source.one", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
  { year: 2026, side: "expenditure", itemId: "spending.health", amountGel: 150, basis: "planned", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.health", mappingConfidence: "high", mappingNotes: "" },
  { year: 2025, side: "expenditure", itemId: "spending.education", amountGel: 300, basis: "actual", sourceId: "source.one", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.education", mappingConfidence: "high", mappingNotes: "" },
  { year: 2026, side: "expenditure", itemId: "spending.education", amountGel: 300, basis: "actual", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: "spending.education", mappingConfidence: "high", mappingNotes: "" },
  { year: 2026, side: "revenue", itemId: "revenue.vat", amountGel: 500, basis: "planned", sourceId: "source.two", officialInstitution: null, officialProgram: null, officialSubprogram: null, publicSpendingFieldId: null, mappingConfidence: null, mappingNotes: "" },
];

const sourceDocuments: SourceDocumentRow[] = [
  {
    sourceId: "source.one",
    sourceName: "Reviewed 2025 execution",
    sourceUrlOrFile: "docs/source-2025",
    lastReviewedAt: "2026-05-10",
  },
  {
    sourceId: "source.two",
    sourceName: "Reviewed 2026 planned budget",
    sourceUrlOrFile: "docs/source-2026",
    lastReviewedAt: "2026-05-11",
  },
];

describe("main explorer data model", () => {
  it("returns side-specific default selections", () => {
    expect(getDefaultSelection("expenditure", facts)).toEqual(["expenditure.total"]);
    expect(getDefaultSelection("revenue", facts)).toEqual(["revenue.total"]);
  });

  it("builds derived total points and planned-year metadata", () => {
    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["expenditure.total"],
      startYear: 2025,
      endYear: 2026,
      measure: "nominal",
    });

    expect(model.years).toEqual([2025, 2026]);
    expect(model.points).toEqual([
      expect.objectContaining({ year: 2025, value: 400, basis: "actual" }),
      expect.objectContaining({ year: 2026, value: 450, basis: "planned" }),
    ]);
    expect(model.hasPlannedValues).toBe(true);
    expect(model.tableRows.find((row) => row.itemId === "expenditure.total")?.sourceByYear[2026]).toEqual({
      sourceName: "Multiple reviewed official sources",
      sourceUrlOrFile: "docs/source-2026",
      lastReviewedAt: "2026-05-11",
    });
    expect(model.summary.biggestShareChange).not.toBeNull();
  });

  it("keeps the active side total available when the total series is not selected", () => {
    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["spending.health"],
      startYear: 2025,
      endYear: 2026,
      measure: "nominal",
    });

    expect(model.tableRows.map((row) => row.itemId)).toEqual(["spending.health"]);
    expect(model.totalRow?.itemId).toBe("expenditure.total");
    expect(model.totalRow?.valuesByYear[2026]).toBe(450);
  });

  it("treats the biggest share-of-total change as the largest movement in either direction", () => {
    const localFacts: BudgetFactImportRow[] = [
      { ...facts[0], itemId: "spending.health", amountGel: 900 },
      { ...facts[1], itemId: "spending.health", amountGel: 100 },
      { ...facts[2], itemId: "spending.education", amountGel: 100 },
      { ...facts[3], itemId: "spending.education", amountGel: 250 },
      { ...facts[2], itemId: "spending.social", amountGel: 100 },
      { ...facts[3], itemId: "spending.social", amountGel: 150 },
    ];

    const model = buildExplorerModel({
      facts: localFacts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["expenditure.total"],
      startYear: 2025,
      endYear: 2026,
      measure: "nominal",
    });

    expect(model.summary.biggestShareChange?.itemId).toBe("spending.health");
  });

  it("calculates percent change and share of total", () => {
    const percentModel = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["spending.health"],
      startYear: 2025,
      endYear: 2026,
      measure: "percent_change",
    });
    const shareModel = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: ["spending.health"],
      startYear: 2025,
      endYear: 2026,
      measure: "share_of_total",
    });

    expect(percentModel.points[0]?.value).toBeNull();
    expect(percentModel.points[1]?.value).toBe(0.5);
    expect(shareModel.points[1]?.value).toBeCloseTo(0.3333, 4);
  });

  it("returns an unavailable message for share of GDP", () => {
    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "revenue",
      selectedItemIds: ["revenue.vat"],
      startYear: 2026,
      endYear: 2026,
      measure: "share_of_gdp",
    });

    expect(model.unavailableReason).toBe("მშპ-სთან წილის საჩვენებლად საჭიროა სანდო მშპ მონაცემები.");
  });
});
