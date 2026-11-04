import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { TradeComposition } from "../../components/trade/trade-composition";
import { loadCurrentAccountFacts, toClientCurrentAccountFacts } from "../../lib/data/externalFlows/importCurrentAccount";
import { loadForeignInvestmentData, toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import { loadMoneyTransfersData, toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { CURRENT_ACCOUNT_SERIES, FOREIGN_INVESTMENT_DIMENSIONS, MONEY_TRANSFER_MEASURES } from "../../lib/data/externalFlows/types";
import { loadExternalPositionFacts, toClientExternalPositionFact } from "../../lib/data/externalPosition/importExternalPosition";
import { loadServedGdpOverviewData } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadTradeCompositionData, toClientTradeCompositionData } from "../../lib/data/tradeComposition/importTradeComposition";
import { loadTradeDomesticData, toClientTradeDomesticData } from "../../lib/data/tradeDomestic/importTradeDomestic";
import { loadTradeOverviewFacts, toClientTradeOverviewFact } from "../../lib/data/tradeOverview/importTradeOverview";
import { TRADE_CHART_INDICATORS, TRADE_DOMESTIC_OVERVIEW_INDICATORS, TRADE_OVERVIEW_INDICATORS, type TradeOverviewFact } from "../../lib/data/tradeOverview/types";
import { loadTradePartnersData, toClientTradePartnersData, type ClientTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { loadTradeProductsData, toClientTradeProductsData, type ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { PRODUCT_SOURCE_BLOCK, TRADE_PRODUCT_MEASURES } from "../../lib/data/tradeProducts/types";
import { loadTradeServicesData, toClientTradeServicesData } from "../../lib/data/tradeServices/importTradeServices";
import { buildCurrentAccountModel, currentAccountCrawlStates, type CurrentAccountGdp } from "../../lib/explorer/currentAccount";
import { buildCurrentAccountWorkbookModel } from "../../lib/explorer/currentAccountWorkbook";
import { EXTERNAL_POSITION_SECTIONS, externalPositionCrawlStates, externalPositionSeries } from "../../lib/explorer/externalPosition";
import { buildExternalPositionWorkbookExportModel } from "../../lib/explorer/externalPositionWorkbook";
import { buildForeignInvestmentModel } from "../../lib/explorer/foreignInvestment";
import { foreignInvestmentCrawlStates } from "../../lib/explorer/foreignInvestmentState";
import { buildForeignInvestmentWorkbookModel } from "../../lib/explorer/foreignInvestmentWorkbook";
import { buildMoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { moneyTransfersCrawlStates } from "../../lib/explorer/moneyTransfersState";
import { buildMoneyTransfersWorkbookModel } from "../../lib/explorer/moneyTransfersWorkbook";
import { tradeOverviewCrawlStates } from "../../lib/explorer/tradeOverviewState";
import { buildTradeOverviewWorkbookExportModel } from "../../lib/explorer/tradeOverviewWorkbook";
import { buildTradePartnersModel } from "../../lib/explorer/tradePartners";
import { tradePartnersBulkSelection, tradePartnersCrawlStates, tradePartnersTotalId } from "../../lib/explorer/tradePartnersState";
import { buildTradePartnersWorkbookModel } from "../../lib/explorer/tradePartnersWorkbook";
import { tradeProductsBulkSelection, tradeProductsCrawlStates } from "../../lib/explorer/tradeProductsState";
import { buildTradeProductsWorkbookModel } from "../../lib/explorer/tradeProductsWorkbook";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { I18nProvider } from "../../lib/i18n/provider";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import { compositionFixture, compositionPresentation } from "./tradeCompositionFixtures";

const ORIGIN = "https://fiscal.ge";
const rowsOf = (model: WorkbookExportModel) => model.readable.rows.length;

let ka: Presentation, national: TradeOverviewFact[], gdp: CurrentAccountGdp[];
beforeAll(async () => {
  [ka, national, gdp] = await Promise.all([
    getPresentation("ka", ["trade", "external", "main", "format", "workbook"], []),
    loadTradeOverviewFacts(),
    loadServedGdpOverviewData().then(({ facts }) => facts.filter(fact => fact.seriesId === "nominal_usd").map(fact => ({ year: fact.year, valueUsd: fact.value, preliminary: fact.status === "preliminary" }))),
  ]);
});

/** A partners-shaped list (partners, the domestic countries, services, composition): one state per measure, each with every series the bulk action ticks. */
function expectPartnerStates(data: ClientTradePartnersData, measures: readonly string[]) {
  const states = tradePartnersCrawlStates(data);
  expect(states.map(state => state.measure)).toEqual(measures);
  const bulk = tradePartnersBulkSelection(data);
  for (const state of states) {
    expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
    expect(state.selectedIds).toEqual(bulk);
    // The list of each tab the page offers is inside the selection (the total, then the tab's own entities).
    for (const tab of new Set(["countries", "groups", state.tab] as const)) {
      const listed = buildTradePartnersModel(data, { ...state, tab }, ka).activeEntities.map(entity => entity.id);
      expect(bulk).toEqual(expect.arrayContaining([tradePartnersTotalId(data), ...listed]));
    }
    expect(rowsOf(buildTradePartnersWorkbookModel({ data, state, sources: [], siteOrigin: ORIGIN }, ka))).toBe(bulk.length);
  }
  // A measure without a published value gets no state.
  const dropped = measures.at(-1)!, index = TRADE_CHART_INDICATORS.indexOf(dropped as never);
  expect(tradePartnersCrawlStates({ ...data, facts: data.facts.filter(fact => fact[2] !== index) }).map(state => state.measure)).toEqual(measures.slice(0, -1));
  return states;
}

function expectProductStates(data: ClientTradeProductsData, measures: readonly string[]) {
  const states = tradeProductsCrawlStates(data);
  expect(states.map(state => state.measure)).toEqual(measures);
  for (const state of states) {
    expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
    expect(state.selectedIds).toEqual(tradeProductsBulkSelection(data));
    expect(rowsOf(buildTradeProductsWorkbookModel({ data, state, sources: [], siteOrigin: ORIGIN }, ka))).toBe(tradeProductsBulkSelection(data).length);
  }
  expect(tradeProductsCrawlStates({ ...data, facts: data.facts.filter(fact => fact[2] !== 1) }).map(state => state.measure)).toEqual(measures.slice(0, 1));
}

describe("Trade overview", () => {
  it("one state with every indicator of the list", () => {
    const facts = national.map(toClientTradeOverviewFact);
    const states = tradeOverviewCrawlStates(facts);
    expect(states).toEqual([{ mode: "line", range: { kind: "all" }, selectedIds: [...TRADE_OVERVIEW_INDICATORS] }]);
    expect(rowsOf(buildTradeOverviewWorkbookExportModel({ facts, state: states[0], sources: [], siteOrigin: ORIGIN }, ka))).toBe(4);
    expect(tradeOverviewCrawlStates([])).toEqual([]);
  });
});

describe("Trading partners", () => {
  it("each measure, every country and group (the tabs only change the ranking)", async () => {
    const data = toClientTradePartnersData(await loadTradePartnersData(), national);
    expect(data.entities.some(entity => entity.kind === "group")).toBe(true);
    expectPartnerStates(data, TRADE_OVERVIEW_INDICATORS);
  });
});

describe("Trade products", () => {
  it("exports and imports, every product of the current block", async () => {
    const data = toClientTradeProductsData(await loadTradeProductsData(), national, "", PRODUCT_SOURCE_BLOCK);
    expectProductStates(data, TRADE_PRODUCT_MEASURES);
  });
});

describe("Domestic exports: overview, countries and products", () => {
  it("each section's states, every series of each measure", async () => {
    const data = toClientTradeDomesticData(await loadTradeDomesticData(), national);
    expect(tradeOverviewCrawlStates(data.national)).toEqual([{ mode: "line", range: { kind: "all" }, selectedIds: [...TRADE_DOMESTIC_OVERVIEW_INDICATORS] }]);
    expect(rowsOf(buildTradeOverviewWorkbookExportModel({ facts: data.national, state: tradeOverviewCrawlStates(data.national)[0], sources: [], siteOrigin: ORIGIN }, ka))).toBe(3);
    expectPartnerStates(data.countries, data.countries.measures!);
    expectProductStates(data.products, data.products.measures!);
  });
});

describe("Services: overview, types and countries", () => {
  it("each section's states, every series of each measure", async () => {
    const data = toClientTradeServicesData(await loadTradeServicesData());
    const overview = tradeOverviewCrawlStates(data.national);
    expect(overview).toEqual([{ mode: "line", range: { kind: "all" }, selectedIds: [...TRADE_OVERVIEW_INDICATORS] }]);
    expect(rowsOf(buildTradeOverviewWorkbookExportModel({ dataset: "services", facts: data.national, state: overview[0], sources: [], siteOrigin: ORIGIN }, ka))).toBe(4);
    expectPartnerStates(data.types, data.types.measures ?? TRADE_OVERVIEW_INDICATORS);
    expectPartnerStates(data.countries, data.countries.measures ?? TRADE_OVERVIEW_INDICATORS);
  });
});

describe("Composition: SITC and BEC", () => {
  it("each classification's states, every category of each measure", async () => {
    const data = toClientTradeCompositionData(await loadTradeCompositionData(), national);
    for (const classification of ["sitc", "bec"] as const) expectPartnerStates(data[classification], data[classification].measures!);
  });

  it("the page carries both classifications' tables in one hidden block, whichever is open", async () => {
    const sitc = compositionFixture("sitc"), bec = compositionFixture("bec"), p = await compositionPresentation("en", { ...sitc, entities: [...sitc.entities, ...bec.entities] });
    const html = renderToStaticMarkup(<I18nProvider {...p}><TradeComposition data={{ sitc, bec }} sources={[]} lastReviewedAt="2026-10-14" siteOrigin={ORIGIN} /></I18nProvider>);
    expect(html.match(/data-testid="crawl-tables"/g)).toHaveLength(1);
    const crawl = html.slice(html.indexOf('data-testid="crawl-tables"'));
    expect(crawl.match(/<table>/g)).toHaveLength(4);
    expect(crawl).toContain("Group 0");
    expect(crawl).toContain("Group 7");
  });
});

describe("Current account", () => {
  it("each tab in US dollars and as % of GDP (the page lists no GDP), every part", async () => {
    const facts = toClientCurrentAccountFacts(await loadCurrentAccountFacts());
    const states = currentAccountCrawlStates(facts, gdp);
    expect(states.map(state => `${state.tab}:${state.unit}`)).toEqual(["balance:usd", "balance:gdp", "in:usd", "in:gdp", "out:usd", "out:gdp"]);
    for (const state of states) {
      expect(state).toMatchObject({ mode: "line", range: { kind: "all" }, selectedIds: [...CURRENT_ACCOUNT_SERIES] });
      expect(buildCurrentAccountModel(facts, gdp, state, ka).selectedIds).toEqual([...CURRENT_ACCOUNT_SERIES]);
      expect(rowsOf(buildCurrentAccountWorkbookModel({ facts, gdp, state, sources: [], siteOrigin: ORIGIN }, ka))).toBe(CURRENT_ACCOUNT_SERIES.length);
    }
    expect(currentAccountCrawlStates(facts, []).map(state => `${state.tab}:${state.unit}`)).toEqual(["balance:usd", "in:usd", "out:usd"]);
    expect(currentAccountCrawlStates(facts.filter(fact => fact.flow !== "debit"), gdp).map(state => state.tab)).not.toContain("out");
  });
});

describe("Foreign investment", () => {
  it("each tab, every row its list offers (the country tab's top 10 and Other countries)", async () => {
    const data = toClientForeignInvestmentData(await loadForeignInvestmentData());
    const states = foreignInvestmentCrawlStates(data);
    expect(states.map(state => state.dimension)).toEqual([...FOREIGN_INVESTMENT_DIMENSIONS]);
    for (const state of states) {
      expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
      const model = buildForeignInvestmentModel(data, state, ka);
      expect(model.selectedIds).toEqual(model.series.map(series => series.id));
      expect(rowsOf(buildForeignInvestmentWorkbookModel({ data, state, sources: [], siteOrigin: ORIGIN }, ka))).toBe(model.series.length);
    }
    expect(buildForeignInvestmentModel(data, states[0], ka).selectedIds).toContain("fdi.others");
    const regions = new Set(data.entities.filter(entity => entity.dimension === "region").map(entity => entity.id));
    expect(foreignInvestmentCrawlStates({ ...data, facts: data.facts.filter(fact => !regions.has(fact.entityId)) }).map(state => state.dimension)).toEqual(["country", "sector"]);
  });
});

describe("Money from abroad", () => {
  it("received and sent, every row its list offers (the top 10 and Other countries)", async () => {
    const data = toClientMoneyTransfersData(await loadMoneyTransfersData());
    const states = moneyTransfersCrawlStates(data);
    expect(states.map(state => state.measure)).toEqual([...MONEY_TRANSFER_MEASURES]);
    for (const state of states) {
      expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
      const model = buildMoneyTransfersModel(data, state, ka);
      expect(model.selectedIds).toEqual(model.series.map(series => series.id));
      expect(model.selectedIds).toHaveLength(12);
      expect(rowsOf(buildMoneyTransfersWorkbookModel({ data, state, sources: [], siteOrigin: ORIGIN }, ka))).toBe(12);
    }
    expect(moneyTransfersCrawlStates({ ...data, facts: data.facts.filter(fact => fact.measure !== "sent") }).map(state => state.measure)).toEqual(["received"]);
  });
});

describe("Foreign debt and Reserves", () => {
  it("amounts and % of GDP (the page lists no GDP), every series", async () => {
    const all = (await loadExternalPositionFacts()).map(toClientExternalPositionFact);
    for (const { id: section } of EXTERNAL_POSITION_SECTIONS) {
      const ids = externalPositionSeries(section).map(series => series.id);
      const facts = all.filter(fact => (ids as string[]).includes(fact.indicatorId));
      const labels = Object.fromEntries(ids.map(id => [id, id]));
      const states = externalPositionCrawlStates(section, facts, gdp);
      expect(states.map(state => state.view)).toEqual(["amount", "gdp"]);
      for (const state of states) {
        expect(state).toMatchObject({ mode: "line", range: { kind: "all" }, selectedIds: ids });
        expect(rowsOf(buildExternalPositionWorkbookExportModel({ section, facts, state, labels, sources: [], siteOrigin: ORIGIN, gdp }, ka))).toBe(ids.length);
      }
      expect(externalPositionCrawlStates(section, facts, []).map(state => state.view)).toEqual(["amount"]);
      expect(externalPositionCrawlStates(section, [], gdp)).toEqual([]);
    }
  });
});
