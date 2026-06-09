import { describe, expect, it } from "vitest";
import { loadGlossary } from "../../lib/data/glossary";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { loadSourceDocuments } from "../../lib/data/sources";
import { buildExplorerModel, getDefaultSelection, getDefaultStackedSelection } from "../../lib/explorer/explorerData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";

const REAL_BUDGET_FACTS_PATH = "../../data/imports/budget-facts-2017-2025.csv";

describe("explorer integration with real CSV data", () => {
  it("loads sample facts and produces the expected year range", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    expect(facts.length).toBeGreaterThan(0);

    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);
    expect(years).toEqual([2024, 2025]);
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

  it("builds a non-empty revenue model from real facts", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
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

    expect(model.unavailableReason).toBeNull();
    expect(model.totalRow?.valuesByYear[2025]).toBeGreaterThan(0);
    expect(model.comparisonRows.map((row) => row.itemId)).toEqual(
      expect.arrayContaining(["revenue.vat", "revenue.income_tax", "revenue.grants", "revenue.other_revenue"]),
    );
  });

  it("loads real app facts with 2017-2025 expenditure and current revenue coverage", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
    const yearsBySide = (side: "expenditure" | "revenue") =>
      [...new Set(facts.filter((fact) => fact.side === side).map((fact) => fact.year))].sort((a, b) => a - b);

    expect(yearsBySide("expenditure")).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(yearsBySide("revenue")).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  });

  it("keeps real revenue facts reconciled by year", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
    const revenueFacts = facts.filter((fact) => fact.side === "revenue");
    const expectedReceiptsByYear = new Map([
      [2017, 12868042205],
      [2018, 13962006896],
      [2019, 15533377928],
      [2020, 20041345314],
      [2021, 20824134853],
      [2022, 23610558719],
      [2023, 26185892957],
      [2024, 29744320017],
      [2025, 32368880408],
    ]);
    const expectedNetRevenueByYear = new Map([
      [2017, 10858369148],
      [2018, 11757729002],
      [2019, 12838287984],
      [2020, 12358835798],
      [2021, 14992015564],
      [2022, 19276483160],
      [2023, 21992545306],
      [2024, 25571944242],
      [2025, 28305494244],
    ]);

    for (const [year, expectedReceiptsGel] of expectedReceiptsByYear) {
      const yearFacts = revenueFacts.filter((fact) => fact.year === year);
      const netRevenueFacts = yearFacts.filter((fact) => !["revenue.asset_decrease", "revenue.increase_liabilities"].includes(fact.itemId));

      expect(yearFacts).toHaveLength(11);
      expect(yearFacts.reduce((sum, fact) => sum + fact.amountGel, 0)).toBe(expectedReceiptsGel);
      expect(netRevenueFacts.reduce((sum, fact) => sum + fact.amountGel, 0)).toBe(expectedNetRevenueByYear.get(year));
    }
  });

  it("has glossary entries for every sample fact item", async () => {
    const facts = await loadBudgetFactRows("../../data/imports/sample-budget-facts.csv");
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");

    const itemIds = [...new Set(facts.map((fact) => fact.itemId))];
    const missingGlossary = itemIds.filter((itemId) => !glossary.has(itemId));
    expect(missingGlossary).toEqual([]);
  });

  it("builds a stacked expenditure composition model from real facts", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
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
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
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

  it("keeps single-year revenue source-backed with public tax categories", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");

    const model = buildSingleYearSnapshotModel({
      facts,
      glossary,
      sourceDocuments,
      side: "revenue",
      year: 2025,
    });

    expect(model.emptyReason).toBeNull();
    expect(model.items.map((item) => item.itemId)).toEqual(
      expect.arrayContaining(["revenue.vat", "revenue.income_tax", "revenue.grants", "revenue.other_revenue"]),
    );
  });
});
