import { beforeAll, describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { makePeriod, periodFromKey, periodYear } from "../../lib/data/inflation/periods";
import { CPI_CITY_IDS, cityFactInput, type CityFactInput, type CpiCityMeasure } from "../../lib/data/inflation/types";
import { loadMoneyBanksFacts, toClientMoneyBanksFact } from "../../lib/data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_LOAN_AREAS, type ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { SERVED_DATA_FILES } from "../../lib/data/servedData";
import { projectGdpFact, sourceIdBySeriesMeasure, type ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { CRAWL_CELL_CAP, crawlTables } from "../../lib/explorer/crawlTables";
import { DIVISION_IDS, buildCategoryIndex, categoryCrawlStates, resolveCategoryRange, type CategoryIndex } from "../../lib/explorer/inflationCategories";
import { buildInflationCategoryWorkbookExportModel } from "../../lib/explorer/inflationCategoryWorkbook";
import { GEORGIA_LINE_ID, buildCityIndex, cityCrawlStates, cityViewLineIds, resolveCityRange } from "../../lib/explorer/inflationCities";
import { GEORGIA_VIEW, type CityView } from "../../lib/explorer/inflationCityRoutes";
import { buildInflationCityWorkbookExportModel } from "../../lib/explorer/inflationCityWorkbook";
import { drawableKeys, indexInflationFacts, inflationCrawlStates, resolveInflationRange, type InflationIndex } from "../../lib/explorer/inflationOverview";
import { buildInflationWorkbookExportModel } from "../../lib/explorer/inflationWorkbook";
import { MONEY_BANKS_SECTIONS, moneyBanksCrawlStates, moneyBanksViewSeries, type MoneyBanksTopicId } from "../../lib/explorer/moneyBanks";
import { moneyBanksAreaCrawlStates, moneyBanksAreaSeries } from "../../lib/explorer/moneyBanksAreas";
import { buildMoneyBanksWorkbookExportModel } from "../../lib/explorer/moneyBanksWorkbook";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";

const ORIGIN = "https://fiscal.ge";
const ids = <K extends string>(states: readonly { selected?: readonly K[]; selectedIds?: readonly K[] }[]) => new Set(states.flatMap((state) => state.selected ?? state.selectedIds ?? []));
const rowsOf = (model: WorkbookExportModel) => model.readable.rows.length;
/** A monthly crawl state covers whole calendar years: January of (latest year − 2) through the view's last month, 25–36 months. */
const lastThirtySix = (range: { start: number; end: number; max: number; min: number }) => {
  expect(range.end).toBe(range.max);
  expect(range.start).toBe(Math.max(range.min, makePeriod(periodYear(range.max) - 2, 1)));
  expect(range.end - range.start + 1).toBeLessThanOrEqual(36);
};

let en: Presentation;
let data: Awaited<ReturnType<typeof loadServedInflationData>>;
beforeAll(async () => {
  en = await getPresentation("en", ["format", "main", "workbook", "inflation", "moneyBanks"], []);
  data = await loadServedInflationData();
});

describe("inflation overview", () => {
  let index: InflationIndex;
  beforeAll(() => { index = indexInflationFacts(data.facts, sourceIdBySeriesMeasure(data.facts)); });
  const build = (built: InflationIndex) => inflationCrawlStates(built).map((state) =>
    buildInflationWorkbookExportModel({ index: built, targets: data.targets, state, range: resolveInflationRange(state, built), presentation: en, sources: [], siteOrigin: ORIGIN }));

  it("each tab with every row it draws, over its last three calendar years", () => {
    const states = inflationCrawlStates(index);
    expect(states.map((state) => state.tab)).toEqual(["yoy", "mom", "index"]);
    for (const state of states) {
      expect(state.mode).toBe("line");
      expect(state.selected).toEqual(drawableKeys(index, state.tab));
      lastThirtySix(resolveInflationRange(state, index));
    }
    expect(ids(states)).toEqual(new Set(["cpi", "core", "core_ex_tobacco", "target"]));
    for (const model of build(index)) expect(rowsOf(model)).toBeGreaterThanOrEqual(1);
  });

  it("names each year row after its series, so the crawl table reads which line a year belongs to", () => {
    const tables = crawlTables(build(index), en.messages);
    expect(tables[0]!.rows.every((row) => /^.+ — \d{4}$/.test(row.label))).toBe(true);
    const latestYear = periodYear(resolveInflationRange(inflationCrawlStates(index)[0]!, index).end);
    expect(tables[0]!.rows.map((row) => row.label)).toContain(`Headline inflation — ${latestYear}`);
    // A year row of the window shows every published month: the first year starts in January.
    expect(tables[0]!.rows.map((row) => row.label)).toContain(`Headline inflation — ${latestYear - 2}`);
    expect(tables[0]!.rows.find((row) => row.label === `Headline inflation — ${latestYear - 2}`)!.cells.slice(0, 12)).not.toContain("—");
    // Three tabs over three calendar years fit the page's cap whole: no table is cut.
    expect(tables.flatMap((table) => table.rows.map((row) => row.cells.length)).reduce((sum, cells) => sum + cells, 0)).toBeLessThanOrEqual(CRAWL_CELL_CAP);
    expect(tables.flatMap((table) => table.rows.map((row) => row.label))).toEqual(build(index).flatMap((model) => model.readable.rows.map((row) => `${row.parentLabel} — ${row.label}`)));
  });

  it("leaves out a tab with no data", () => {
    const withoutIndex = data.facts.filter((fact) => fact.measure !== "index_2010");
    const built = indexInflationFacts(withoutIndex, sourceIdBySeriesMeasure(withoutIndex));
    expect(inflationCrawlStates(built).map((state) => state.tab)).toEqual(["yoy", "mom"]);
  });
});

describe("inflation categories", () => {
  const headline = () => new Map(data.facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct").map((fact) => [periodFromKey(fact.period), fact.value]));
  const indexOf = (measures: readonly string[]) => buildCategoryIndex(data.categories.filter((fact) => measures.includes(fact.measure)), data.weights);
  const build = (index: CategoryIndex) => categoryCrawlStates(index).map((state) =>
    buildInflationCategoryWorkbookExportModel({ index, state, range: resolveCategoryRange(state, index), headline: headline(), presentation: en, sources: [], siteOrigin: ORIGIN }));

  it("as the page loads (annual changes only): the contributions of every division, then every category's annual change", () => {
    const index = indexOf(["yoy_pct"]);
    const states = categoryCrawlStates(index);
    expect(states.map((state) => state.tab)).toEqual(["contrib", "yoy"]);
    expect(states[0]!.selected).toEqual(DIVISION_IDS);
    expect(new Set(states[1]!.selected)).toEqual(new Set(index.order));
    expect(ids(states)).toEqual(new Set(index.order));
    expect(index.order.length).toBeGreaterThan(DIVISION_IDS.length);
    for (const state of states) {
      expect(state.mode).toBe("chart");
      lastThirtySix(resolveCategoryRange(state, index));
    }
    const models = build(index);
    for (const model of models) expect(rowsOf(model)).toBeGreaterThanOrEqual(1);
    // The contribution table closes on the headline with the residual row.
    expect(crawlTables(models, en.messages)[0]!.rows.some((row) => row.label.startsWith("The rest — "))).toBe(true);
  });

  it("adds no monthly-change table once its runs, fetched after load, have arrived", () => {
    expect(categoryCrawlStates(indexOf(["yoy_pct", "mom_pct"])).map((state) => state.tab)).toEqual(["contrib", "yoy"]);
  });
});

describe("inflation cities", () => {
  const isPageFact = (fact: { measure: string; period: string }) => fact.measure === "yoy_pct" || (fact.measure === "avg12_pct" && fact.period.endsWith("-12"));
  const build = (facts: CityFactInput[], view: CityView) => {
    const index = buildCityIndex(facts);
    return cityCrawlStates(index, view).map((state) =>
      buildInflationCityWorkbookExportModel({ index, view, state, range: resolveCityRange(state, index, view), presentation: en, sources: [], siteOrigin: ORIGIN }));
  };

  it("the Georgia page: every place on the total, over the last three calendar years", () => {
    const georgia: CityFactInput[] = data.facts.filter((fact) => fact.seriesId === "cpi.headline" && isPageFact(fact) && fact.period >= "2016-12")
      .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: "cpi.headline", measure: fact.measure as CpiCityMeasure, period: fact.period, value: fact.value }));
    const facts = [...georgia, ...data.cities.filter((fact) => fact.seriesId === "cpi.headline" && isPageFact(fact)).map(cityFactInput)];
    const index = buildCityIndex(facts);
    const states = cityCrawlStates(index, GEORGIA_VIEW);
    expect(states).toHaveLength(1);
    expect(states[0]!.selected).toEqual([...cityViewLineIds(GEORGIA_VIEW)]);
    lastThirtySix(resolveCityRange(states[0]!, index, GEORGIA_VIEW));
    expect(rowsOf(build(facts, GEORGIA_VIEW)[0]!)).toBeGreaterThanOrEqual(1);
  });

  for (const cityId of CPI_CITY_IDS) {
    it(`${cityId}: the total and every division`, () => {
      const view: CityView = { kind: "city", cityId };
      const facts = data.cities.filter((fact) => fact.cityId === cityId && isPageFact(fact)).map(cityFactInput);
      const states = cityCrawlStates(buildCityIndex(facts), view);
      expect(states).toHaveLength(1);
      expect(states[0]!.selected).toEqual([...cityViewLineIds(view)]);
      expect(rowsOf(build(facts, view)[0]!)).toBeGreaterThanOrEqual(1);
    });
  }

  it("a city with no published division leaves it out; a city with no data has no state", () => {
    const view: CityView = { kind: "city", cityId: "city.batumi" };
    const facts = data.cities.filter((fact) => fact.cityId === "city.batumi" && isPageFact(fact) && fact.seriesId !== "cpi.cat.02").map(cityFactInput);
    expect(cityCrawlStates(buildCityIndex(facts), view)[0]!.selected).not.toContain("cpi.cat.02");
    const others = data.cities.filter((fact) => fact.cityId !== "city.batumi" && isPageFact(fact)).map(cityFactInput);
    expect(cityCrawlStates(buildCityIndex(others), view)).toEqual([]);
  });
});

describe("money and banks", () => {
  let facts: ClientMoneyBanksFact[];
  let gdpFacts: ClientNationalGdpFact[];
  beforeAll(async () => {
    facts = (await loadMoneyBanksFacts()).map(toClientMoneyBanksFact);
    gdpFacts = (await loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts)).map(projectGdpFact);
  });
  const topics = MONEY_BANKS_SECTIONS.map((section) => section.id).filter((id): id is MoneyBanksTopicId => id !== "regions");
  // The foreign-currency shares are each currency's loans or deposits over the total, both listed on the amounts.
  const views: Record<MoneyBanksTopicId, string[]> = { "supply": ["amount", "gdp"], "loans-deposits": ["amount"], "borrowers": ["main"], "interest-rates": ["main"], "bank-health": ["main"] };

  for (const section of topics) {
    it(`${section}: each kept view with every series it lists`, () => {
      const pageGdp = section === "supply" ? gdpFacts : [];
      const states = moneyBanksCrawlStates(section, facts, pageGdp);
      expect(states.map((state) => state.view)).toEqual(views[section]);
      for (const state of states) {
        expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
        expect(state.selectedIds).toEqual(moneyBanksViewSeries(section, state.view).map((series) => series.id));
        const model = buildMoneyBanksWorkbookExportModel({ section, facts, state, labels: {}, sources: [], siteOrigin: ORIGIN, gdpFacts: pageGdp, gdpSources: [] }, en);
        expect(rowsOf(model)).toBe(state.selectedIds.length);
      }
    });
  }

  it("Money supply without GDP has no % of GDP state", () => {
    expect(moneyBanksCrawlStates("supply", facts, []).map((state) => state.view)).toEqual(["amount"]);
  });

  for (const area of MONEY_BANKS_LOAN_AREAS) {
    it(`Loans by region, ${area}: all loans, in lari and in foreign currency`, () => {
      const states = moneyBanksAreaCrawlStates(area, facts);
      expect(states).toHaveLength(1);
      expect(states[0]!.selectedIds).toEqual(moneyBanksAreaSeries(area).map((series) => series.id));
      expect(rowsOf(buildMoneyBanksWorkbookExportModel({ area, facts, state: states[0]!, labels: {}, sources: [], siteOrigin: ORIGIN }, en))).toBe(3);
    });
  }

  it("an area with no loans has no state", () => {
    const area = MONEY_BANKS_LOAN_AREAS[1];
    const own = new Set(moneyBanksAreaSeries(area).map((series) => series.id));
    expect(moneyBanksAreaCrawlStates(area, facts.filter((fact) => !own.has(fact.indicatorId)))).toEqual([]);
  });
});
