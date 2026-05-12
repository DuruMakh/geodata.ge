import { describe, expect, it } from "vitest";
import { loadGlossary } from "../../lib/data/glossary";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { loadSourceDocuments } from "../../lib/data/sources";
import { buildExplorerModel, getDefaultSelection } from "../../lib/explorer/explorerData";

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
});
