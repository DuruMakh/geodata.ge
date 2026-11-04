import { beforeAll, describe, expect, it } from "vitest";
import { loadServedExplorerData, loadServedGeneralGovernmentBalanceData, loadServedGovernmentDebtData, loadServedMunicipalData, SERVED_DATA_FILES } from "../../lib/data/servedData";
import { publicGlossaryEntry } from "../../lib/data/glossary";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { loadTaxBreaksRefundsFacts, toClientTaxBreaksRefundsFact } from "../../lib/data/taxBreaksRefunds/importTaxBreaksRefunds";
import {
  projectAdminFact, projectBalanceFact, projectBudgetFact, projectDebtFact, projectGdpFact, projectMunicipalFunctionFact, projectMunicipalTotalFact,
  type ClientAdminFact, type ClientBudgetFact, type ClientNationalGdpFact,
} from "../../lib/explorer/clientData";
import { budgetCrawlStates, buildExplorerModel, type BudgetCrawlState } from "../../lib/explorer/explorerData";
import { buildBudgetWorkbookInput } from "../../lib/explorer/budgetWorkbook";
import { crawlTables } from "../../lib/explorer/crawlTables";
import { buildDebtExplorerModel, debtCrawlStates } from "../../lib/explorer/debtExplorer";
import { buildDebtWorkbookExportModel } from "../../lib/explorer/debtWorkbook";
import { deficitCrawlStates } from "../../lib/explorer/deficitExplorer";
import { buildDeficitWorkbookExportModel } from "../../lib/explorer/deficitWorkbook";
import {
  buildMunicipalEntityModel, buildMunicipalWorkbookInput, municipalCrawlStates, regionOwnFacts, type MunicipalEntityModel,
} from "../../lib/explorer/municipalData";
import { TAX_BREAKS_REFUNDS_SERIES, taxBreaksRefundsCrawlStates } from "../../lib/explorer/taxBreaksRefunds";
import { buildTaxBreaksRefundsWorkbookExportModel } from "../../lib/explorer/taxBreaksRefundsWorkbook";
import { buildWorkbookExportModel, type WorkbookExportModel } from "../../lib/explorer/workbookModel";
import type { ExplorerSide } from "../../lib/explorer/types";
import type { ClientGovernmentDebtFact } from "../../lib/servedRows";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import { workbookMessage } from "../../lib/i18n/workbook";

const ORIGIN = "https://fiscal.ge";
const NO_SOURCES = { budget: [], admin: [], gdp: [] };
const ids = (states: readonly { selectedIds: readonly string[] }[]) => new Set(states.flatMap((state) => state.selectedIds));
const rowsOf = (model: WorkbookExportModel) => model.readable.rows.length;

describe("budget explorer (expenditure and revenue)", () => {
  let facts: ClientBudgetFact[], adminFacts: ClientAdminFact[], gdpFacts: ClientNationalGdpFact[];
  let data: Awaited<ReturnType<typeof loadServedExplorerData>>;
  let en: Presentation;
  beforeAll(async () => {
    data = await loadServedExplorerData();
    facts = data.facts.map(projectBudgetFact);
    adminFacts = data.adminFacts.map(projectAdminFact);
    gdpFacts = data.gdpFacts.map(projectGdpFact);
    const labelIds = ["expenditure.total", "revenue.total", "admin_spending.total", ...facts.map((fact) => fact.itemId), ...adminFacts.map((fact) => fact.itemId)];
    en = await getPresentation("en", ["format", "main", "controls"], labelIds);
  });

  const modelFor = (side: ExplorerSide, state: BudgetCrawlState | { grouping: "fields" | "ministries"; selectedIds: string[]; startYear: number; endYear: number }) => buildExplorerModel({
    facts: facts.filter((fact) => fact.side === side), gdpFacts, adminFacts,
    adminCategories: new Map(data.adminCategories.map((category) => [category.id, category])),
    expenditureGrouping: state.grouping, glossary: new Map(Array.from(data.glossary.values(), publicGlossaryEntry).map((entry) => [entry.id, entry])),
    side, selectedItemIds: state.selectedIds, startYear: state.startYear, endYear: state.endYear, measure: "share" in state && state.share ? "share_of_gdp" : "nominal",
  }, en);
  const workbookFor = (side: ExplorerSide, state: BudgetCrawlState) => buildWorkbookExportModel(buildBudgetWorkbookInput({
    model: modelFor(side, state), presentation: en, scope: state.scope, share: state.share, title: "T", sources: NO_SOURCES, siteOrigin: ORIGIN,
  }));
  // Everything the series list offers: the list is the model's items, whatever is ticked.
  const listIds = (side: ExplorerSide, grouping: "fields" | "ministries") =>
    new Set(modelFor(side, { grouping, selectedIds: [], startYear: 0, endYear: 9999 }).items.map((item) => item.id));

  it("expenditure: one state per grouping, each selecting every series its list offers (ministries' programmes included)", () => {
    const states = budgetCrawlStates("expenditure", facts.filter((fact) => fact.side === "expenditure"), adminFacts);
    expect(states.map((state) => state.scope)).toEqual(["fields", "ministries"]);
    expect(new Set(states[0].selectedIds)).toEqual(listIds("expenditure", "fields"));
    expect(new Set(states[1].selectedIds)).toEqual(listIds("expenditure", "ministries"));
    expect(states[1].selectedIds.some((id) => adminFacts.some((fact) => fact.itemId === id && fact.level === "major_program"))).toBe(true);
    for (const state of states) expect(rowsOf(workbookFor("expenditure", state))).toBeGreaterThanOrEqual(1);
  });

  it("revenue: one state, every revenue line; no ministries without the admin corpus", () => {
    const states = budgetCrawlStates("revenue", facts.filter((fact) => fact.side === "revenue"));
    expect(states.map((state) => state.scope)).toEqual(["revenue"]);
    expect(ids(states)).toEqual(listIds("revenue", "fields"));
    expect(rowsOf(workbookFor("revenue", states[0]))).toBeGreaterThanOrEqual(1);
  });

  it("states span every year the scope offers", () => {
    const [fields] = budgetCrawlStates("expenditure", facts.filter((fact) => fact.side === "expenditure"), adminFacts);
    const years = facts.filter((fact) => fact.side === "expenditure").map((fact) => fact.year);
    expect([fields.startYear, fields.endYear]).toEqual([Math.min(...years), Math.max(...years)]);
  });

  it("with GDP, fields and revenue add their % of GDP view after their amounts; ministries keep amounts only", () => {
    const states = budgetCrawlStates("expenditure", facts.filter((fact) => fact.side === "expenditure"), adminFacts, gdpFacts);
    expect(states.map((state) => [state.scope, state.share])).toEqual([["fields", false], ["fields", true], ["ministries", false]]);
    for (const [amounts, shares] of [[states[0]!, states[1]!]]) {
      expect({ ...shares, share: false }).toEqual(amounts);
      const workbook = workbookFor("expenditure", shares);
      expect(workbook.readable.unitLabel).toBe("% of GDP");
      const total = workbook.readable.rows[0]!;
      const year = workbook.readable.years.find((y) => total.valuesByYear[y] !== null)!;
      expect(total.valuesByYear[year]).toBeGreaterThan(0);
      expect(total.valuesByYear[year]).toBeLessThan(1);
    }
    expect(budgetCrawlStates("revenue", facts.filter((fact) => fact.side === "revenue"), [], gdpFacts).map((state) => state.share)).toEqual([false, true]);
  });

  it("a scope without rows yields no state", () => {
    expect(budgetCrawlStates("expenditure", facts.filter((fact) => fact.side === "expenditure"), []).map((state) => state.scope)).toEqual(["fields"]);
    expect(budgetCrawlStates("revenue", [])).toEqual([]);
  });

  // The plan asked for "30.9 (planned)": that is the page's bn GEL. The reused workbook builder reads million GEL
  // (buildBudgetWorkbookInput: readableScale 1,000,000), so the same 30.9 bn reads 30,881.4 in the crawl table.
  it("expenditure's 2026 total reads as a plan in English", () => {
    const [fields] = budgetCrawlStates("expenditure", facts.filter((fact) => fact.side === "expenditure"), adminFacts);
    const [table] = crawlTables([workbookFor("expenditure", fields)], en.messages);
    const total = table.rows[0];
    expect(total.label).toBe("Total expenditure");
    expect(total.cells[table.columns.indexOf("2026")]).toBe("30,881.4 (planned)");
  });
});

describe("municipal explorer (Georgia, a region, a municipality)", () => {
  let data: Awaited<ReturnType<typeof loadServedMunicipalData>>;
  beforeAll(async () => { data = await loadServedMunicipalData(); });

  const modelOf = (functionFacts: typeof data.functionFacts, totalFacts: typeof data.totalFacts): MunicipalEntityModel =>
    buildMunicipalEntityModel({ functions: data.functions, functionFacts: functionFacts.map(projectMunicipalFunctionFact), totalFacts: totalFacts.map(projectMunicipalTotalFact), startYear: 0, endYear: 9999 });
  const places = () => {
    const region = data.regions[0]!;
    const code = data.municipalities.find((row) => row.regionId === region.id)!.code;
    const { own } = regionOwnFacts(region.id, data.municipalities, data.functionFacts, data.totalFacts, data.adjaraBudgetAdjustments);
    return {
      georgia: modelOf(data.countryFunctionFacts, data.countryTotalFacts),
      region: modelOf(own.functionFacts, own.totalFacts),
      municipality: modelOf(data.functionFacts.filter((row) => row.municipalityCode === code), data.totalFacts.filter((row) => row.municipalityCode === code)),
    };
  };

  it("each place: one state with the total and every function, building a workbook with rows", () => {
    for (const model of Object.values(places())) {
      const states = municipalCrawlStates(model);
      expect(states).toHaveLength(1);
      expect(ids(states)).toEqual(new Set([model.totalRow.itemId, ...model.rows.map((row) => row.itemId)]));
      expect(states[0]).toMatchObject({ share: false, range: { start: model.years[0], end: model.years.at(-1) } });
      const workbook = buildWorkbookExportModel(buildMunicipalWorkbookInput(model, states[0], {
        allYears: model.years, title: "T", workbookBasename: "x", workbookSources: [], siteOrigin: ORIGIN,
      }, { locale: "ka", englishLabels: {} }));
      expect(rowsOf(workbook)).toBe(model.rows.length + 1);
    }
  });

  it("a place with no data has no state", () => {
    expect(municipalCrawlStates(modelOf([], []))).toEqual([]);
  });
});

describe("debt explorer", () => {
  let facts: ClientGovernmentDebtFact[], gdpFacts: ClientNationalGdpFact[];
  beforeAll(async () => {
    facts = (await loadServedGovernmentDebtData()).facts.map(projectDebtFact);
    gdpFacts = (await loadServedExplorerData()).gdpFacts.map(projectGdpFact);
  });

  it("one state per family (stock, service, rate), every series of the list; stock also as % of GDP, which the page cannot work out", () => {
    const states = debtCrawlStates(facts, gdpFacts);
    expect(states.map((state) => [state.family, state.shareOfGdp])).toEqual([["stock", false], ["stock", true], ["service", false], ["rate", false]]);
    const listed = buildDebtExplorerModel({ facts, gdpFacts, family: "stock", selectedIds: [], range: { start: 0, end: 9999 }, shareOfGdp: false }).items.map((item) => item.id);
    expect(ids(states)).toEqual(new Set(listed));
    for (const state of states) {
      expect(rowsOf(buildDebtWorkbookExportModel({ facts, gdpFacts, ...state, sources: [], gdpSources: [], siteOrigin: ORIGIN }))).toBe(3);
    }
    const shares = buildDebtWorkbookExportModel({ facts, gdpFacts, ...states[1]!, sources: [], gdpSources: [], siteOrigin: ORIGIN });
    expect(shares.readable.unitLabel).toBe(workbookMessage("ka", "workbook.percentGdp"));
    const total = shares.readable.rows[0]!, year = shares.readable.years.at(-1)!;
    expect(total.valuesByYear[year]).toBeGreaterThan(0);
    expect(total.valuesByYear[year]).toBeLessThan(1);
    expect(debtCrawlStates(facts).map((state) => state.shareOfGdp)).toEqual([false, false, false]);
  });

  it("a family without facts has no state", () => {
    expect(debtCrawlStates(facts.filter((fact) => fact.family !== "rate")).map((state) => state.family)).toEqual(["stock", "service"]);
  });
});

describe("deficit explorer", () => {
  it("the % of GDP view it opens with and the GEL amounts, the one series selected", async () => {
    const facts = (await loadServedGeneralGovernmentBalanceData()).facts.map(projectBalanceFact);
    const states = deficitCrawlStates(facts);
    expect(states.map((state) => state.percentage)).toEqual([true, false]);
    for (const state of states) {
      expect(state.selected).toBe(true);
      expect(rowsOf(buildDeficitWorkbookExportModel({ facts, ...state, sources: [], siteOrigin: ORIGIN }))).toBe(1);
    }
    expect(deficitCrawlStates([])).toEqual([]);
  });
});

describe("tax breaks and refunds explorer", () => {
  it("an amount state and a % of GDP state, each with every series of the list", async () => {
    const facts = (await loadTaxBreaksRefundsFacts()).map(toClientTaxBreaksRefundsFact);
    const gdpFacts = (await loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts)).map(projectGdpFact);
    const states = taxBreaksRefundsCrawlStates(facts, gdpFacts);
    const selectedIds = TAX_BREAKS_REFUNDS_SERIES.map((series) => series.id);
    expect(states).toEqual([{ mode: "line", view: "amount", range: { kind: "all" }, selectedIds }, { mode: "line", view: "gdp", range: { kind: "all" }, selectedIds }]);
    const en = await getPresentation("en", ["taxBreaksRefunds"], []);
    for (const state of states) {
      const workbook = buildTaxBreaksRefundsWorkbookExportModel({ facts, state, labels: {}, sources: [], siteOrigin: ORIGIN, gdpFacts, gdpSources: [] }, en);
      expect(rowsOf(workbook)).toBe(TAX_BREAKS_REFUNDS_SERIES.length);
    }
    // Without GDP the % of GDP view has no values, so no state.
    expect(taxBreaksRefundsCrawlStates(facts).map((state) => state.view)).toEqual(["amount"]);
    expect(taxBreaksRefundsCrawlStates([])).toEqual([]);
  });
});
