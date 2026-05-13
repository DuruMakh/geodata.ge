import { describe, expect, it } from "vitest";
import { loadGlossary } from "../../lib/data/glossary";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { loadSourceDocuments } from "../../lib/data/sources";
import { buildExplorerModel, getDefaultSelection, getDefaultStackedSelection } from "../../lib/explorer/explorerData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";

describe("explorer integration with real CSV data", () => {
  it("loads sample facts and produces the expected year range", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    expect(facts.length).toBeGreaterThan(0);

    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);
    expect(years.length).toBeGreaterThanOrEqual(2);
    expect(years[0]).toBeLessThanOrEqual(2025);
    expect(years[years.length - 1]).toBeGreaterThanOrEqual(2026);
  });

  it("builds a non-empty expenditure model with the default selection", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);

    const selectedItemIds = getDefaultSelection("expenditure", facts);
    expect(selectedItemIds).toEqual(["expenditure.total"]);

    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds,
      startYear: years[0],
      endYear: years[years.length - 1],
      measure: "nominal",
    });

    expect(model.years.length).toBeGreaterThan(0);
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.tableRows.length).toBeGreaterThan(0);
    expect(model.items.length).toBeGreaterThan(1);
  });

  it("builds a non-empty revenue model with the default selection", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);

    const selectedItemIds = getDefaultSelection("revenue", facts);
    expect(selectedItemIds).toEqual(["revenue.total"]);

    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "revenue",
      selectedItemIds,
      startYear: years[0],
      endYear: years[years.length - 1],
      measure: "nominal",
    });

    expect(model.years.length).toBeGreaterThan(0);
    expect(model.points.length).toBeGreaterThan(0);
    expect(model.items.length).toBeGreaterThan(1);
  });

  it("has glossary entries for every sample fact item", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");

    const itemIds = [...new Set(facts.map((fact) => fact.itemId))];
    const missingGlossary = itemIds.filter((itemId) => !glossary.has(itemId));
    expect(missingGlossary).toEqual([]);
  });

  it("builds a stacked expenditure composition model from real facts", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);
    const selectedItemIds = getDefaultStackedSelection("expenditure", facts);
    const allStackedItemIds = [
      ...new Set(facts.filter((fact) => fact.side === "expenditure").map((fact) => fact.itemId).filter((itemId) => itemId !== "expenditure.total")),
    ].sort();

    expect(selectedItemIds.length).toBeGreaterThan(1);
    expect(selectedItemIds).not.toContain("expenditure.total");
    expect(allStackedItemIds.length).toBeGreaterThan(selectedItemIds.length);

    const model = buildExplorerModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: allStackedItemIds,
      startYear: years[0],
      endYear: years[years.length - 1],
      measure: "share_of_total",
    });

    expect(model.points.length).toBeGreaterThan(allStackedItemIds.length);
    expect(model.points.every((point) => point.value === null || (point.value >= 0 && point.value <= 1))).toBe(true);

    for (const year of model.years) {
      const values = model.points
        .filter((point) => point.year === year)
        .map((point) => point.value)
        .filter((value): value is number => value !== null);

      expect(values.length).toBeGreaterThan(1);
      expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
    }
  });

  it("builds a non-empty single-year expenditure snapshot from real facts", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");

    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      year: 2025,
    });

    expect(model.emptyReason).toBeNull();
    expect(model.totalGel).toBeGreaterThan(0);
    expect(model.items.length).toBeGreaterThan(5);
    expect(model.every100.reduce((sum, item) => sum + item.gelFrom100, 0)).toBe(100);
    expect(model.rankingRows.length).toBeGreaterThan(1);
    const first = model.rankingRows[0];
    const second = model.rankingRows[1];
    expect(first?.amountGel).toBeGreaterThanOrEqual(second?.amountGel ?? 0);
  });

  it("returns a revenue empty state for current real facts", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/budget-facts-2023-2025.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");

    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments,
      side: "revenue",
      year: 2025,
    });

    expect(model.items).toEqual([]);
    expect(model.emptyReason).toBe("ამ წლისთვის შემოსავლების მონაცემები ჯერ არ არის ჩატვირთული.");
  });
});
