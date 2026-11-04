import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedHealthData, toClientHealthFact } from "../../lib/data/health/importHealth";
import { HEALTH_AREAS, type ClientHealthFact } from "../../lib/data/health/types";
import { loadServedHouseholdData, toClientHouseholdFact } from "../../lib/data/household/importHousehold";
import type { ClientHouseholdFact } from "../../lib/data/household/types";
import { loadCpiFacts } from "../../lib/data/inflation/importInflation";
import { loadLabourFacts, toClientLabourFact } from "../../lib/data/labour/importLabour";
import type { ClientLabourFact } from "../../lib/data/labour/types";
import { loadNationalGdpFacts } from "../../lib/data/nationalGdp/importNationalGdp";
import { loadPovertyFacts, toClientPovertyFact } from "../../lib/data/poverty/importPoverty";
import type { ClientPovertyFact } from "../../lib/data/poverty/types";
import { SERVED_DATA_FILES } from "../../lib/data/servedData";
import { loadSocialFacts, toClientSocialFact } from "../../lib/data/social/importSocial";
import type { ClientSocialFact } from "../../lib/data/social/types";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS, UNEMPLOYMENT_REGISTRY } from "../../lib/data/unemployment/importUnemployment";
import { unemploymentIndicators, unemploymentIsRate, type ClientUnemploymentObservation } from "../../lib/data/unemployment/types";
import { loadWagesFacts, toClientWagesFact } from "../../lib/data/wages/importWages";
import { WAGES_REGIONS, type ClientWagesFact } from "../../lib/data/wages/types";
import { projectGdpFact, type ClientNationalGdpFact } from "../../lib/explorer/clientData";
import { crawlTables } from "../../lib/explorer/crawlTables";
import { healthCrawlStates, healthDisplay, healthViews, healthViewSeries, type HealthNationalSectionId } from "../../lib/explorer/health";
import { healthDeathsCrawlStates, healthDeathsSeries } from "../../lib/explorer/healthDeaths";
import { buildHealthWorkbookExportModel } from "../../lib/explorer/healthWorkbook";
import { HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_SECTIONS, householdCrawlStates, householdViewSeries, type HouseholdSectionId } from "../../lib/explorer/household";
import { buildHouseholdWorkbookExportModel } from "../../lib/explorer/householdWorkbook";
import { LABOUR_SECTIONS, labourCrawlStates, labourSeries, type LabourSectionId } from "../../lib/explorer/labour";
import { buildLabourWorkbookExportModel } from "../../lib/explorer/labourWorkbook";
import { POVERTY_SECTIONS, povertyCrawlStates, povertyViews, povertyViewSeries, type PovertySectionId } from "../../lib/explorer/poverty";
import { buildPovertyWorkbookExportModel } from "../../lib/explorer/povertyWorkbook";
import { socialAnnualCpi, socialCrawlStates, socialHeadingOf, socialPopulation, socialTopicSeries, socialViews, type SocialHeading, type SocialPlaceSet, type SocialTopicId } from "../../lib/explorer/social";
import { socialPlaceCrawlStates, socialPlaceFacts, socialPlaceSeries, type SocialPlaceExtras } from "../../lib/explorer/socialPlaces";
import { buildSocialWorkbookExportModel } from "../../lib/explorer/socialWorkbook";
import { buildUnemploymentModel } from "../../lib/explorer/unemployment";
import { unemploymentOverviewIndicators } from "../../lib/explorer/unemploymentOverview";
import { UNEMPLOYMENT_SECTIONS, type UnemploymentSectionId } from "../../lib/explorer/unemploymentSections";
import { unemploymentCrawlStates, type UnemploymentState } from "../../lib/explorer/unemploymentState";
import { buildUnemploymentWorkbookExportModel } from "../../lib/explorer/unemploymentWorkbook";
import { WAGES_SECTIONS, wagesCrawlStates, wagesViews, wagesViewSeries, type WagesSectionId } from "../../lib/explorer/wages";
import { buildWagesWorkbookExportModel } from "../../lib/explorer/wagesWorkbook";
import type { WorkbookExportModel, WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";

const ORIGIN = "https://fiscal.ge";
const ids = (states: readonly { selectedIds: readonly string[] }[]) => new Set(states.flatMap(state => state.selectedIds));
const rowsOf = (model: WorkbookExportModel) => model.readable.rows.length;
/** One public source per source id the facts name, over every year: the builders that cite each value require one. */
const sourcesFor = (facts: readonly { sourceId: string; year: number }[]): (WorkbookPublicSource & { sourceId: string })[] =>
  [...new Set(facts.map(f => f.sourceId))].map(sourceId => ({
    sourceId, years: [...new Set(facts.filter(f => f.sourceId === sourceId).map(f => f.year))], title: sourceId, organization: "Geostat",
    downloadHref: `/downloads/methodology/test/files/${sourceId}.xlsx` as const, retrievedAt: "2026-11-01",
  }));
/** A row's cell in a crawl table, by its year column. */
const cell = (table: ReturnType<typeof crawlTables>[number], label: string, year: number) => table.rows.find(row => row.label === label)!.cells[table.columns.indexOf(String(year))];

let en: Presentation, ka: Presentation;
beforeAll(async () => {
  const scopes = ["format", "main", "workbook", "controls", "unemployment", "regionalEconomies", "labour", "wages", "household", "poverty", "health", "social"] as const;
  [en, ka] = await Promise.all([getPresentation("en", scopes, UNEMPLOYMENT_GROUPS.map(group => group.id)), getPresentation("ka", scopes, [])]);
});

describe("unemployment", () => {
  let all: ClientUnemploymentObservation[];
  beforeAll(async () => { all = (await loadServedUnemploymentData()).facts; });
  // The facts a page receives, filtered as lib/pages/unemployment.tsx filters them.
  const pageFacts = (section: UnemploymentSectionId, regionId?: string) => {
    const dimensions = new Set<string>([section === "overview" ? ["national", "settlement", "education", "long_term"] : [UNEMPLOYMENT_SECTIONS.find(item => item.id === section)!.breakdown], "national", ...(section === "overview" ? ["sex"] : [])].flat());
    const main = UNEMPLOYMENT_SECTIONS.find(item => item.id === section)!.breakdown;
    return all.filter(fact => (section !== "age" || fact.dimension === "age" && fact.year >= 2020) && (!regionId || fact.dimension === "region" && fact.groupId === regionId) && dimensions.has(fact.dimension)
      && (section === "overview" ? (fact.dimension === "sex" ? fact.indicatorId === "unemployment_rate" : unemploymentOverviewIndicators(fact.dimension).includes(fact.indicatorId))
        : section === "regions" ? unemploymentOverviewIndicators("region").includes(fact.indicatorId) : unemploymentIndicators(main).includes(fact.indicatorId)));
  };
  const listed = (facts: readonly ClientUnemploymentObservation[], state: UnemploymentState) => buildUnemploymentModel(facts, UNEMPLOYMENT_REGISTRY, state).definitions;
  const shape = (states: readonly UnemploymentState[]) => states.map(state => `${state.breakdown}:${state.breakdown === "education" ? state.educationSex : unemploymentIsRate(state.indicator) ? "rates" : "people"}`);

  it.each([
    ["overview", undefined, ["national:rates", "national:people", "settlement:rates", "settlement:people", "education:total", "education:women", "education:men", "long_term:rates", "long_term:people"]],
    ["regions", undefined, ["region:rates", "region:people"]],
    ["regions", "region.imereti", ["region:rates", "region:people"]],
    ["gender", undefined, ["sex:rates", "sex:people"]],
  ] as const)("%s %s: one state per view and unit, each selecting every series of its unit the list offers", (section, regionId, expected) => {
    const facts = pageFacts(section, regionId);
    const states = unemploymentCrawlStates(facts, UNEMPLOYMENT_REGISTRY, section, regionId);
    expect(shape(states)).toEqual(expected);
    for (const state of states) {
      expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
      const definitions = listed(facts, state);
      const unit = definitions.filter(group => state.breakdown === "education" || unemploymentIsRate(group.indicatorId) === unemploymentIsRate(state.indicator));
      expect(state.selectedIds).toEqual(unit.map(group => group.id));
      expect(rowsOf(buildUnemploymentWorkbookExportModel(facts, UNEMPLOYMENT_REGISTRY, state, en, [], ORIGIN))).toBe(state.selectedIds.length);
    }
    // Together a view's states cover its whole list, rates and people.
    for (const breakdown of new Set(states.map(state => state.breakdown))) {
      const views = states.filter(state => state.breakdown === breakdown);
      expect(ids(views)).toEqual(new Set(views.flatMap(state => listed(facts, state).map(group => group.id))));
    }
  });

  it("the Regions comparison lists the merged historical regions as their own rows", () => {
    const states = unemploymentCrawlStates(pageFacts("regions"), UNEMPLOYMENT_REGISTRY, "regions");
    for (const merged of ["region.imereti_racha_lechkhumi_kvemo_svaneti", "region.samtskhe_javakheti_guria_mtskheta_mtianeti"]) {
      expect(states[0].selectedIds).toContain(`${merged}:unemployment_rate`);
      expect(states[1].selectedIds).toContain(`${merged}:employed`);
    }
  });

  it("the Age page: one state per indicator, every age group", () => {
    const facts = pageFacts("age");
    const states = unemploymentCrawlStates(facts, UNEMPLOYMENT_REGISTRY, "age");
    expect(states.map(state => state.indicator)).toEqual(unemploymentIndicators("age"));
    for (const state of states) {
      expect(state.selectedIds).toEqual(listed(facts, state).map(group => group.id));
      expect(state.selectedIds.length).toBeGreaterThan(1);
      expect(rowsOf(buildUnemploymentWorkbookExportModel(facts, UNEMPLOYMENT_REGISTRY, state, en, [], ORIGIN))).toBe(state.selectedIds.length);
    }
  });

  it("a region without people counts has no people state; an Education sex without facts has none", () => {
    const rates = pageFacts("regions", "region.guria").filter(fact => unemploymentIsRate(fact.indicatorId));
    expect(shape(unemploymentCrawlStates(rates, UNEMPLOYMENT_REGISTRY, "regions", "region.guria"))).toEqual(["region:rates"]);
    const noWomen = pageFacts("overview").filter(fact => !(fact.dimension === "education" && fact.sex === "women"));
    expect(shape(unemploymentCrawlStates(noWomen, UNEMPLOYMENT_REGISTRY, "overview"))).not.toContain("education:women");
  });

  it.each(["en", "ka"] as const)("S2 (%s): Samegrelo-Zemo Svaneti's people table reads employed 118.9 in 2015 and 118.5 in 2025", locale => {
    const presentation = locale === "en" ? en : ka;
    const regionId = "region.samegrelo_zemo_svaneti", facts = pageFacts("regions", regionId);
    const models = unemploymentCrawlStates(facts, UNEMPLOYMENT_REGISTRY, "regions", regionId).map(state => buildUnemploymentWorkbookExportModel(facts, UNEMPLOYMENT_REGISTRY, state, presentation, [], ORIGIN));
    const tables = crawlTables(models, presentation.messages);
    const people = tables.find(table => table.caption.includes(message(presentation.messages, "unemployment.thousandPersons")))!;
    const employed = message(presentation.messages, "unemployment.indicator.employed");
    expect(cell(people, employed, 2015)).toBe("118.9");
    expect(cell(people, employed, 2025)).toBe("118.5");
  });
});

describe("labour", () => {
  let facts: ClientLabourFact[];
  beforeAll(async () => { facts = (await loadLabourFacts()).map(toClientLabourFact); });

  it.each(LABOUR_SECTIONS.map(section => section.id))("%s: one state, every row with a published figure", section => {
    const pageFacts = facts.filter(f => labourSeries(section).some(series => series.id === f.indicatorId));
    const states = labourCrawlStates(section, pageFacts);
    expect(states).toHaveLength(1);
    expect(ids(states)).toEqual(new Set(labourSeries(section).map(series => series.id).filter(id => pageFacts.some(f => f.indicatorId === id))));
    const model = buildLabourWorkbookExportModel({ section, facts: pageFacts, state: states[0], labels: {}, headingLabels: {}, sources: sourcesFor(pageFacts), siteOrigin: ORIGIN, title: section }, en);
    expect(rowsOf(model)).toBe(states[0].selectedIds.length);
  });

  it("a page without facts has no state", () => {
    expect(labourCrawlStates("hours" as LabourSectionId, [])).toEqual([]);
  });
});

describe("wages", () => {
  let facts: ClientWagesFact[];
  beforeAll(async () => { facts = (await loadWagesFacts()).map(toClientWagesFact); });
  const regionFacts = (regionId: string) => facts.filter(f => f.dimension !== "region" || f.groupId === regionId);

  it.each([...WAGES_SECTIONS.filter(section => section.id !== "regions").map(section => [section.id, undefined]), ["regions", WAGES_REGIONS[0]], ["regions", WAGES_REGIONS.at(-1)]] as [WagesSectionId, string | undefined][])("%s %s: one state per view, every series its list offers", (section, regionId) => {
    const pageFacts = regionId ? regionFacts(regionId) : facts;
    const states = wagesCrawlStates(section, pageFacts);
    expect(states.map(state => state.view)).toEqual(wagesViews(section));
    for (const state of states) {
      expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
      expect(state.selectedIds).toEqual(wagesViewSeries(section, state.view, pageFacts).map(series => series.id));
      const model = buildWagesWorkbookExportModel({ section, facts: pageFacts, state, labels: {}, sources: [], siteOrigin: ORIGIN, title: section, regionId }, en);
      expect(rowsOf(model)).toBe(state.selectedIds.length);
    }
  });

  it("an Industries group without facts has no state", () => {
    const states = wagesCrawlStates("industries", facts.filter(f => f.groupId !== "women"));
    expect(states.map(state => state.view)).not.toContain("women");
    expect(states).toHaveLength(wagesViews("industries").length - 1);
  });
});

describe("household", () => {
  let facts: ClientHouseholdFact[];
  beforeAll(async () => { facts = (await loadServedHouseholdData()).facts.map(toClientHouseholdFact); });

  it.each(HOUSEHOLD_SECTIONS.flatMap(section => HOUSEHOLD_PAGE_AREAS.map(area => [section.id, area] as const)))("%s %s: per household and per person, every series the area lists", (section, area) => {
    const pageFacts = facts.filter(f => f.indicatorId.startsWith(`${section}.`));
    const states = householdCrawlStates(section, area, pageFacts);
    expect(states.map(state => state.measure)).toEqual(["per_household", "per_capita"]);
    for (const state of states) {
      expect(state.selectedIds).toEqual(householdViewSeries(section, area).map(series => series.id));
      const model = buildHouseholdWorkbookExportModel({ section, area, facts: pageFacts, state, labels: {}, areaLabel: area, sources: [], siteOrigin: ORIGIN, title: section }, en);
      expect(rowsOf(model)).toBe(state.selectedIds.length);
    }
  });

  it("an area without per-person figures has no per-person state", () => {
    const states = householdCrawlStates("income" as HouseholdSectionId, "region.guria", facts.filter(f => !(f.areaId === "region.guria" && f.measure === "per_capita")));
    expect(states.map(state => state.measure)).toEqual(["per_household"]);
  });
});

describe("poverty", () => {
  let facts: ClientPovertyFact[];
  beforeAll(async () => { facts = (await loadPovertyFacts()).map(toClientPovertyFact); });

  it.each(POVERTY_SECTIONS.map(section => section.id))("%s: one state per tab, every series its list offers", section => {
    const pageFacts = facts.filter(f => f.indicatorId.startsWith(section === "inequality" ? "gini." : "poverty."));
    const states = povertyCrawlStates(section, pageFacts);
    expect(states.map(state => state.view)).toEqual(povertyViews(section));
    for (const state of states) {
      expect(state.selectedIds).toEqual(povertyViewSeries(section, state.view).map(series => series.id));
      const model = buildPovertyWorkbookExportModel({ section, facts: pageFacts, state, labels: {}, sources: [], siteOrigin: ORIGIN, title: section }, en);
      expect(rowsOf(model)).toBe(state.selectedIds.length);
    }
  });

  it("a tab without facts has no state", () => {
    const states = povertyCrawlStates("rates" as PovertySectionId, facts.filter(f => !f.indicatorId.startsWith("poverty.international_")));
    expect(states.map(state => state.view)).toEqual(["absolute", "relative"]);
  });
});

describe("health", () => {
  let facts: ClientHealthFact[];
  beforeAll(async () => { facts = (await loadServedHealthData()).facts.map(toClientHealthFact); });
  const georgia = () => facts.filter(f => f.areaId === "georgia");

  it.each([
    ["doctors-hospitals", ["staff:health.unitPersons", "hospitals:health.unitUnits", "hospitals:health.unitBeds", "hospitals:health.unitMillionVisits"]],
    ["illnesses", ["main:health.unitThousandCases"]],
  ] as [HealthNationalSectionId, string[]][])("%s: one state per view and unit, every row with facts", (section, expected) => {
    const pageFacts = georgia().filter(f => healthViews(section).some(view => healthViewSeries(section, view).some(series => series.id === f.indicatorId)));
    const states = healthCrawlStates(section, pageFacts);
    expect(states.map(state => `${state.view}:${healthDisplay(state.selectedIds[0] as never).unitKey}`)).toEqual(expected);
    for (const view of healthViews(section)) {
      const withFacts = healthViewSeries(section, view).map(series => series.id).filter(id => pageFacts.some(f => f.indicatorId === id));
      expect(ids(states.filter(state => state.view === view))).toEqual(new Set(withFacts));
    }
    for (const state of states) {
      expect(new Set(state.selectedIds.map(id => healthDisplay(id as never).unitKey)).size).toBe(1);
      const model = buildHealthWorkbookExportModel({ section, facts: pageFacts, state, labels: {}, sources: sourcesFor(pageFacts), siteOrigin: ORIGIN, title: section }, en);
      expect(rowsOf(model)).toBe(state.selectedIds.length);
    }
  });

  it.each(HEALTH_AREAS)("causes of death, %s: one state, all deaths and every cause", area => {
    const pageFacts = facts.filter(f => f.areaId === area && healthDeathsSeries().some(series => series.id === f.indicatorId));
    const states = healthDeathsCrawlStates(area, pageFacts);
    expect(states).toHaveLength(1);
    expect(ids(states)).toEqual(new Set(healthDeathsSeries().map(series => series.id).filter(id => pageFacts.some(f => f.indicatorId === id))));
    expect(states[0].selectedIds[0]).toBe("health.deaths.total");
    const model = buildHealthWorkbookExportModel({ section: "causes-of-death", area, facts: pageFacts, state: states[0], labels: {}, sources: sourcesFor(pageFacts), siteOrigin: ORIGIN, title: area }, en);
    expect(rowsOf(model)).toBe(states[0].selectedIds.length);
  });

  it("an area without deaths has no state; a unit without facts has none", () => {
    expect(healthDeathsCrawlStates("region.guria", facts.filter(f => f.areaId !== "region.guria"))).toEqual([]);
    const states = healthCrawlStates("doctors-hospitals", georgia().filter(f => f.indicatorId !== "health.facilities.beds"));
    expect(states.map(state => state.selectedIds[0])).not.toContain("health.facilities.beds");
    expect(states).toHaveLength(3);
  });
});

describe("social protection", () => {
  let facts: ClientSocialFact[], gdpFacts: ClientNationalGdpFact[], extras: SocialPlaceExtras;
  beforeAll(async () => {
    const [served, demography, cpiFacts, gdp] = await Promise.all([loadSocialFacts(), loadServedDemographyData(), loadCpiFacts(), loadNationalGdpFacts(SERVED_DATA_FILES.gdpFacts)]);
    facts = served.map(toClientSocialFact);
    extras = { population: socialPopulation(demography.facts), cpi: socialAnnualCpi(cpiFacts) };
    gdpFacts = gdp.map(projectGdpFact);
  });
  const headingOf = (section: SocialTopicId, id: string) => socialHeadingOf(socialTopicSeries(section))(id) as SocialHeading;

  it.each([
    ["social-payments", ["amount:money", "gdp:money"]],
    ["social-package", ["amount:recipients", "amount:money", "amount:average"]],
    ["funded-pension", ["amount:savings", "amount:flows", "amount:members", "amount:employers", "amount:return", "gdp:savings", "gdp:flows"]],
  ] as [SocialTopicId, string[]][])("%s: one state per view and heading, every row with facts", (section, expected) => {
    const states = socialCrawlStates(section, facts, gdpFacts);
    expect(states.map(state => `${state.view}:${headingOf(section, state.selectedIds[0])}`)).toEqual(expected);
    const withFacts = socialTopicSeries(section).map(series => series.id).filter(id => facts.some(f => f.indicatorId === id && f.geographyId === "country.georgia"));
    expect(ids(states.filter(state => state.view === "amount"))).toEqual(new Set(withFacts));
    for (const state of states) {
      expect(new Set(state.selectedIds.map(id => headingOf(section, id))).size).toBe(1);
      expect(socialViews(section, headingOf(section, state.selectedIds[0]))).toContain(state.view);
      const model = buildSocialWorkbookExportModel({ section, facts, state, gdpFacts, labels: {}, headingLabels: {}, sources: sourcesFor(facts), populationSources: [], cpiSources: [], gdpSources: [], siteOrigin: ORIGIN, title: section }, en);
      expect(rowsOf(model)).toBe(state.selectedIds.length);
    }
  });

  it("without GDP facts the % of GDP view has no state", () => {
    expect(socialCrawlStates("social-payments", facts, []).map(state => state.view)).toEqual(["amount"]);
  });

  it.each([
    ["pensions", "country.georgia"], ["pensions", "region.imereti"], ["pensions", "04"],
    ["subsistence-allowance", "country.georgia"], ["subsistence-allowance", "region.guria"],
  ] as [SocialPlaceSet, string][])("%s %s: one state per heading, every row with facts", (set, placeId) => {
    const shown = socialPlaceFacts(set, placeId, facts, extras);
    const definitions = socialPlaceSeries(set), headingOfRow = socialHeadingOf(definitions);
    const states = socialPlaceCrawlStates(set, shown);
    expect(states.map(state => headingOfRow(state.selectedIds[0]))).toEqual([...new Set(definitions.filter(series => shown.some(f => f.indicatorId === series.id)).map(series => series.heading))]);
    expect(ids(states)).toEqual(new Set(definitions.map(series => series.id).filter(id => shown.some(f => f.indicatorId === id))));
    for (const state of states) {
      const model = buildSocialWorkbookExportModel({ set, placeId, scope: placeId, facts, state, extras, labels: {}, headingLabels: {}, sources: sourcesFor(facts), populationSources: [], cpiSources: [], gdpSources: [], siteOrigin: ORIGIN, title: set }, en);
      expect(rowsOf(model)).toBe(state.selectedIds.length);
    }
  });

  it("a place without a heading's facts has no state for it", () => {
    const shown = socialPlaceFacts("pensions", "region.imereti", facts, extras).filter(f => !f.indicatorId.endsWith("#share"));
    expect(socialPlaceCrawlStates("pensions", shown).map(state => state.selectedIds[0])).not.toContain("social.pension.recipients#share");
    expect(socialPlaceCrawlStates("pensions", shown)).toHaveLength(3);
  });
});
