import { describe, expect, it } from "vitest";
import { loadAdminSpendingFacts } from "../../lib/data/adminSpending/importAdminSpendingFacts";
import { loadGlossary } from "../../lib/data/glossary";
import { loadBudgetFactRows } from "../../lib/data/importBudgetFacts";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { loadSourceDocuments } from "../../lib/data/sources";
import { ADMIN_SPENDING_YEARS, EXPENDITURE_DETAILED_YEARS, EXPENDITURE_YEARS, REVENUE_TOTAL_ONLY_YEARS, REVENUE_YEARS } from "../../lib/data/coverage";
import { buildExplorerModel, getDefaultSelection } from "../../lib/explorer/explorerData";
import { buildSingleYearSnapshotModel } from "../../lib/explorer/singleYear";

const REAL_BUDGET_FACTS_PATH = "../../data/imports/budget-facts-2004-2025.csv";
const REAL_ADMIN_FACTS_PATH = "../../data/imports/admin-spending-facts-2004-2025.csv";
const REAL_GDP_FACTS_PATH = "../../data/imports/national-gdp-annual-1996-2025.csv";

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

  it("selects only the expenditure total from real facts", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);

    const selectedItemIds = getDefaultSelection("expenditure", facts);

    expect(selectedItemIds).toEqual(["expenditure.total"]);
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

    expect(model.totalRow?.valuesByYear[2025]).toBeGreaterThan(0);
    expect(model.comparisonRows.map((row) => row.itemId)).toEqual(
      expect.arrayContaining(["revenue.vat", "revenue.income_tax", "revenue.grants", "revenue.other_revenue"]),
    );
  });

  it("loads real app facts with current expenditure and revenue coverage", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
    const yearsBySide = (side: "expenditure" | "revenue") =>
      [...new Set(facts.filter((fact) => fact.side === side).map((fact) => fact.year))].sort((a, b) => a - b);

    expect(yearsBySide("expenditure")).toEqual(EXPENDITURE_YEARS);
    expect(yearsBySide("revenue")).toEqual(REVENUE_YEARS);
  });

  it("keeps real revenue facts reconciled by year", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
    const revenueFacts = facts.filter((fact) => fact.side === "revenue");
    const expectedReceiptsByYear = new Map([
      [2004, 2283035800],
      [2005, 3289223828],
      [2006, 4537916326],
      [2007, 6356421171],
      [2008, 7418098313],
      [2009, 6434328573],
      [2010, 7050180952],
      [2011, 7575052376],
      [2012, 8118927350],
      [2013, 8319395319],
      [2014, 9464155184],
      [2015, 10761618164],
      [2016, 11595009761],
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
      [2004, 2210296000],
      [2005, 2784499174],
      [2006, 3802956630],
      [2007, 5424512208],
      [2008, 5726890036],
      [2009, 5017477013],
      [2010, 5557913105],
      [2011, 6775045250],
      [2012, 7515896465],
      [2013, 7292336359],
      [2014, 7874817875],
      [2015, 8954376865],
      [2016, 9675743059],
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

    const totalOnlyRevenueByYear = new Map<number, number>();

    expect([...expectedReceiptsByYear.keys()]).toEqual(REVENUE_YEARS);
    expect([...totalOnlyRevenueByYear.keys()]).toEqual(REVENUE_TOTAL_ONLY_YEARS);

    for (const [year, expectedReceiptsGel] of totalOnlyRevenueByYear) {
      const yearFacts = revenueFacts.filter((fact) => fact.year === year);

      expect(yearFacts).toHaveLength(1);
      expect(yearFacts[0]?.itemId).toBe("revenue.total");
      expect(yearFacts[0]?.amountGel).toBe(expectedReceiptsGel);
    }

    for (const [year, expectedReceiptsGel] of expectedReceiptsByYear) {
      const yearFacts = revenueFacts.filter((fact) => fact.year === year);
      const netRevenueFacts = yearFacts.filter((fact) => !["revenue.asset_decrease", "revenue.increase_liabilities"].includes(fact.itemId));

      expect(yearFacts).toHaveLength(year === 2004 ? 10 : 11);
      expect(yearFacts.some((fact) => fact.itemId === "revenue.increase_liabilities")).toBe(year !== 2004);
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

  it("calculates real expenditure values against same-year nominal GDP", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
    const gdpFacts = await loadNationalGdpFacts(REAL_GDP_FACTS_PATH);
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");
    const allItemIds = [
      ...new Set(facts.filter((fact) => fact.side === "expenditure").map((fact) => fact.itemId).filter((itemId) => itemId !== "expenditure.total")),
    ].sort();

    const model = buildExplorerModel({
      facts,
      gdpFacts,
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds: allItemIds,
      startYear: EXPENDITURE_DETAILED_YEARS[0],
      endYear: EXPENDITURE_DETAILED_YEARS[EXPENDITURE_DETAILED_YEARS.length - 1],
      measure: "share_of_gdp",
    });

    expect(model.points.length).toBeGreaterThan(allItemIds.length);
    expect(model.points.every((point) => point.value === null || (point.value >= 0 && point.value <= 1))).toBe(true);

    const gdpByYear = new Map(gdpFacts.map((fact) => [fact.year, fact.gdpCurrentPricesGel]));
    for (const point of model.points) {
      expect(point.value).toBeCloseTo(point.amountGel / (gdpByYear.get(point.year) ?? 1), 12);
    }
    expect(model.totalRow?.shareEndYear).toBeCloseTo(
      27_723_319_039 / 104_598_100_000,
      12,
    );
  });

  it("builds a ministry expenditure model from real admin spending facts", async () => {
    const facts = await loadBudgetFactRows(REAL_BUDGET_FACTS_PATH);
    const adminFacts = await loadAdminSpendingFacts(REAL_ADMIN_FACTS_PATH);
    const glossary = await loadGlossary("../../data/glossary/category-glossary.csv");
    const sourceDocuments = await loadSourceDocuments("../../data/sources/source-documents.csv");

    const selectedItemIds = getDefaultSelection("expenditure", facts, "ministries", adminFacts);
    expect(selectedItemIds).toEqual(["admin_spending.total"]);

    const model = buildExplorerModel({
      facts,
      adminFacts,
      adminCategories: new Map(),
      expenditureGrouping: "ministries",
      glossary,
      sourceDocuments,
      side: "expenditure",
      selectedItemIds,
      startYear: ADMIN_SPENDING_YEARS[0],
      endYear: ADMIN_SPENDING_YEARS[ADMIN_SPENDING_YEARS.length - 1],
      measure: "nominal",
    });
    const programItems = model.items.filter((item) => item.level === "major_program");

    expect(model.totalRow?.valuesByYear[2025]).toBeGreaterThan(0);
    expect(model.items.some((item) => item.id.startsWith("spending."))).toBe(false);
    expect(programItems.length).toBeGreaterThan(0);
    expect(programItems.every((item) => item.parentItemId?.startsWith("admin_spending") ?? false)).toBe(true);
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
