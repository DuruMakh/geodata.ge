import { beforeAll, describe, expect, it } from "vitest";
import { loadServedCrimeData, toClientCrimeFact } from "../../lib/data/crime/importCrime";
import type { ClientCrimeFact } from "../../lib/data/crime/types";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES, SOURCE_ID } from "../../lib/data/demography/series";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import { loadEducationFacts, shownEducationFacts, toClientEducationFact } from "../../lib/data/education/importEducation";
import { EDUCATION_GEORGIA, type ClientEducationFact } from "../../lib/data/education/types";
import { loadEnergyFoodFacts, toClientEnergyFoodFact } from "../../lib/data/energyFood/importEnergyFood";
import type { ClientEnergyFoodFact } from "../../lib/data/energyFood/types";
import { loadEnvironmentFacts, toClientEnvironmentFact } from "../../lib/data/environment/importEnvironment";
import { ENVIRONMENT_CITIES, type ClientEnvironmentFact } from "../../lib/data/environment/types";
import { loadInternetFacts, toClientInternetFact } from "../../lib/data/internet/importInternet";
import { INTERNET_REGIONS, type ClientInternetFact } from "../../lib/data/internet/types";
import { loadServedScienceCultureData, toClientScienceCultureFact } from "../../lib/data/scienceCulture/importScienceCulture";
import { SCIENCE_CULTURE_REGIONS, type ClientScienceCultureFact } from "../../lib/data/scienceCulture/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { loadTransportFacts, toClientTransportFact } from "../../lib/data/transport/importTransport";
import { TRANSPORT_REGIONS, type ClientTransportFact } from "../../lib/data/transport/types";
import { projectDemographyObservation, projectMigrationObservation, projectNationalObservation } from "../../lib/explorer/clientData";
import { CRIME_SECTIONS, crimeCrawlStates, crimeSeries, type CrimePopulation } from "../../lib/explorer/crime";
import { buildCrimeWorkbookExportModel } from "../../lib/explorer/crimeWorkbook";
import { ageSexCrawlStates, annualAgeFacts, ageYears, censusAgeFactsForPlace, censusCrawlSettlements } from "../../lib/explorer/demographyAgeSex";
import { buildCensusPlaceWorkbookExportModel, buildPyramidWorkbookExportModel } from "../../lib/explorer/demographyAgeSexWorkbook";
import { GEORGIA_PLACE_ID, buildDemographyPlaces, partsOf, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import { MARRIAGE_SERIES, marriageCrawlStates, marriageFactsForPlace, marriageSourceId, type MarriagePlaceFacts } from "../../lib/explorer/demographyMarriage";
import { buildMarriageWorkbookExportModel } from "../../lib/explorer/demographyMarriageWorkbook";
import { MIGRATION_GROUPS, MIGRATION_SERIES, migrationCrawlStates } from "../../lib/explorer/demographyMigration";
import { buildMigrationWorkbookExportModel } from "../../lib/explorer/demographyMigrationWorkbook";
import { NATIONAL_SERIES } from "../../lib/explorer/demographyNational";
import { buildFertilityWorkbookExportModel, buildLifeWorkbookExportModel } from "../../lib/explorer/demographyNationalWorkbook";
import { populationPlaceCrawlQueries } from "../../lib/explorer/demographyPopulation";
import { buildPopulationWorkbookExportModel } from "../../lib/explorer/demographyPopulationWorkbook";
import { vitalFactsForPlace } from "../../lib/explorer/demographyVital";
import { buildVitalWorkbookExportModel } from "../../lib/explorer/demographyVitalWorkbook";
import { educationCrawlStates, educationTopicSeries, type EducationTopicId } from "../../lib/explorer/education";
import { educationPlaceCrawlStates, educationPlaceSeries } from "../../lib/explorer/educationPlaces";
import { buildEducationWorkbookExportModel } from "../../lib/explorer/educationWorkbook";
import { ENERGY_FOOD_SECTIONS, energyFoodCrawlStates, energyFoodGroup, energyFoodSeries } from "../../lib/explorer/energyFood";
import { buildEnergyFoodWorkbookExportModel } from "../../lib/explorer/energyFoodWorkbook";
import { environmentListCrawlStates, environmentTopicSeries, type EnvironmentSeriesDefinition, type EnvironmentTopicId } from "../../lib/explorer/environment";
import { ENVIRONMENT_AREAS, environmentAreaSeries, type EnvironmentAreaTopic } from "../../lib/explorer/environmentAreas";
import { environmentCitySeries } from "../../lib/explorer/environmentCities";
import { buildEnvironmentWorkbookExportModel, type EnvironmentWorkbookPage } from "../../lib/explorer/environmentWorkbook";
import { internetCrawlStates, internetTopicSeries, type InternetTopicId } from "../../lib/explorer/internet";
import { internetAreaCrawlStates, internetAreaSeries } from "../../lib/explorer/internetAreas";
import { buildInternetWorkbookExportModel } from "../../lib/explorer/internetWorkbook";
import { scienceCultureCrawlStates, scienceCultureTopicSeries, type ScienceCultureTopicId } from "../../lib/explorer/scienceCulture";
import { museumAreaCrawlStates, museumAreaSeries } from "../../lib/explorer/scienceCultureMuseums";
import { buildScienceCultureWorkbookExportModel } from "../../lib/explorer/scienceCultureWorkbook";
import { transportCrawlStates, transportTopicSeries, type TransportTopicId } from "../../lib/explorer/transport";
import { transportAreaCrawlStates, transportAreaSeries } from "../../lib/explorer/transportAreas";
import { buildTransportWorkbookExportModel } from "../../lib/explorer/transportWorkbook";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { getPresentation } from "../../lib/i18n/presentation.server";
import type { Presentation } from "../../lib/i18n/types";
import type { ClientAgeFact, ClientDemographyObservation, ClientMigrationFact, ClientNationalFact } from "../../lib/servedRows";

const ORIGIN = "https://fiscal.ge";
const ids = (states: readonly { selectedIds: readonly string[] }[]) => new Set(states.flatMap((state) => state.selectedIds));
const rowsOf = (model: WorkbookExportModel) => model.readable.rows.length;
const labelsOf = (definitions: readonly { id: string }[]) => Object.fromEntries(definitions.map((definition) => [definition.id, definition.id]));
const withFacts = (definitions: readonly { id: string }[], facts: readonly { indicatorId: string }[]) => {
  const present = new Set(facts.map((fact) => fact.indicatorId));
  return new Set(definitions.map((definition) => definition.id).filter((id) => present.has(id)));
};
/** One public source per id, covering every year: the builders that refuse an uncited value get one. */
const YEARS = Array.from({ length: 60 }, (_, index) => 1980 + index);
const sourcesFor = (sourceIds: Iterable<string>) => [...new Set(sourceIds)].map((sourceId) => ({
  sourceId, title: sourceId, organization: "Geostat", downloadHref: "https://geostat.ge/source" as const, retrievedAt: "2026-01-01", years: YEARS,
}));
const lineAll = { mode: "line", range: { kind: "all" } };
/** Every state selects rows of one unit only (the list's own rule), given a row's unit. */
const oneUnitEach = (states: readonly { selectedIds: readonly string[] }[], unitOf: (id: string) => string | undefined) => {
  for (const state of states) expect(new Set(state.selectedIds.map(unitOf)).size).toBe(1);
};
const factUnit = (facts: readonly { indicatorId: string; unit: string }[]) => {
  const units = new Map(facts.map((fact) => [fact.indicatorId, fact.unit]));
  return (id: string) => units.get(id);
};

let en: Presentation;
let demography: ServedDemographyObservation[];
let places: DemographyPlace[];
beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  demography = served.facts;
  const placeIds = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((municipality) => municipality.code)];
  en = await getPresentation("en", ["format", "main", "workbook", "controls", "demography", "municipal", "education", "scienceCulture", "crime", "internet", "transport", "energyFood", "environment"], placeIds, placeIds);
  places = buildDemographyPlaces({ regions: municipal.regions, municipalities: municipal.municipalities, englishLabels: en.englishLabels, georgiaNameKa: "საქართველო" });
});

describe("demography: migration", () => {
  let facts: ClientMigrationFact[];
  beforeAll(() => { facts = demography.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation); });

  it("one state per sex, every group selected, every year; each builds arrivals, departures and the net", () => {
    const states = migrationCrawlStates(facts);
    expect(states.map((state) => state.sex)).toEqual(["total", "male", "female"]);
    for (const state of states) {
      expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
      expect(state.selectedIds).toEqual([...MIGRATION_GROUPS]);
      // Two direction blocks (heading + six groups each) and the net.
      expect(rowsOf(buildMigrationWorkbookExportModel({ facts, state, sources: [], siteOrigin: ORIGIN }, en))).toBe(2 * (1 + MIGRATION_GROUPS.length) + 1);
    }
  });

  it("a sex without arrivals has no state; no facts, none at all", () => {
    expect(migrationCrawlStates(facts.filter((fact) => fact.sex !== "female")).map((state) => state.sex)).toEqual(["total", "male"]);
    expect(migrationCrawlStates([])).toEqual([]);
  });
});

describe("demography: marriages and divorces", () => {
  let georgia: MarriagePlaceFacts;
  let sources: ReturnType<typeof sourcesFor>;
  beforeAll(() => {
    georgia = marriageFactsForPlace(demography, GEORGIA_PLACE_ID, MARRIAGE_SERIES.map((series) => series.id));
    sources = sourcesFor([...MARRIAGE_SERIES.map((series) => marriageSourceId(series.id)), SOURCE_ID.midYear]);
  });

  it("Georgia: counts and years as published, counts per 1,000; every row of each", () => {
    const states = marriageCrawlStates(georgia);
    expect(states.map((state) => [state.measure, state.selectedIds])).toEqual([
      ["count", ["marriages", "divorces"]],
      ["count", MARRIAGE_SERIES.filter((series) => series.group === "years").map((series) => series.id)],
      ["per1000", ["marriages", "divorces"]],
    ]);
    expect(ids(states)).toEqual(new Set(MARRIAGE_SERIES.map((series) => series.id)));
    for (const state of states) {
      expect(state).toMatchObject({ mode: "line", range: { kind: "all" } });
      expect(rowsOf(buildMarriageWorkbookExportModel({ place: georgia, state, labels: labelsOf(MARRIAGE_SERIES), sources, siteOrigin: ORIGIN, title: "T", scope: "georgia" }, en))).toBe(state.selectedIds.length);
    }
  });

  it("a place section (counts only): counts and per 1,000; without a mid-year population, no rates", () => {
    const batumi = marriageFactsForPlace(demography, "15");
    expect(marriageCrawlStates(batumi).map((state) => [state.measure, state.selectedIds])).toEqual([["count", ["marriages", "divorces"]], ["per1000", ["marriages", "divorces"]]]);
    expect(marriageCrawlStates({ ...batumi, midYear: [] }).map((state) => state.measure)).toEqual(["count"]);
    expect(marriageCrawlStates({ facts: [], midYear: [] })).toEqual([]);
  });
});

describe("demography: births and deaths, fertility and life expectancy", () => {
  it("the national charts' two workbooks hold the total fertility rate, the seven age rates and the life lines", () => {
    const facts: ClientNationalFact[] = demography.filter((fact) => NATIONAL_SERIES.includes(fact.seriesId)).map(projectNationalObservation);
    expect(rowsOf(buildFertilityWorkbookExportModel({ facts, sources: [], siteOrigin: ORIGIN }, en))).toBe(1 + 7);
    expect(rowsOf(buildLifeWorkbookExportModel({ facts, sources: [], siteOrigin: ORIGIN }, en))).toBe(3);
  });

  it("a place's section: births, deaths and natural increase", () => {
    const place = places.find((candidate) => candidate.id === GEORGIA_PLACE_ID)!;
    const facts: ClientDemographyObservation[] = vitalFactsForPlace(demography, place.id);
    expect(rowsOf(buildVitalWorkbookExportModel({ facts, place, sources: [], siteOrigin: ORIGIN, scope: "georgia" }, en))).toBe(3);
  });
});

describe("demography: population place pages", () => {
  let facts: ClientDemographyObservation[];
  beforeAll(() => { facts = demography.map(projectDemographyObservation); });

  it("Georgia, a region and a municipality: the place and every part it lists, over the place's years", () => {
    for (const id of [GEORGIA_PLACE_ID, "region.adjara", "15"]) {
      const place = places.find((candidate) => candidate.id === id)!;
      const queries = populationPlaceCrawlQueries(facts, place, places);
      expect(queries).toHaveLength(1);
      const listed = [place.id, ...partsOf(place, places).map((part) => part.id)];
      expect(new Set(queries[0]!.selectedIds)).toEqual(new Set(listed));
      const model = buildPopulationWorkbookExportModel(facts, places, queries[0]!, en, [], ORIGIN, "scope", place.id);
      expect(rowsOf(model)).toBe(listed.length);
      // Georgia's years start in 2004, every other place's in 2015: no column of dashes before a place's first year.
      expect(model.readable.years[0]).toBe(id === GEORGIA_PLACE_ID ? 2004 : 2015);
    }
  });

  it("a place without population figures has no query", () => {
    const place = places.find((candidate) => candidate.id === "region.adjara")!;
    expect(populationPlaceCrawlQueries(facts.filter((fact) => fact.geographyId !== "region.adjara"), place, places)).toEqual([]);
  });
});

describe("demography: age and sex", () => {
  it("Georgia: every year's pyramid in persons, 18 groups and the total", () => {
    const facts: ClientAgeFact[] = annualAgeFacts(demography);
    const states = ageSexCrawlStates(facts);
    expect(states.map((state) => state.year)).toEqual(ageYears(facts));
    for (const state of states) {
      expect(state).toEqual({ year: state.year, compare: null, measure: "persons" });
      expect(rowsOf(buildPyramidWorkbookExportModel({ facts, sources: [], siteOrigin: ORIGIN, ...state }, en))).toBe(19);
    }
    const first = states[0]!.year;
    expect(ageSexCrawlStates(facts.filter((fact) => !(fact.year === first && fact.ageGroup === "age_1_4"))).map((state) => state.year)).not.toContain(first);
  });

  it("a region's census section: each settlement; one without a count has none", () => {
    const place = places.find((candidate) => candidate.id === "region.adjara")!;
    const facts = censusAgeFactsForPlace(demography, place.id);
    expect(censusCrawlSettlements(facts)).toEqual(["total", "urban", "rural"]);
    for (const settlement of censusCrawlSettlements(facts)) {
      expect(rowsOf(buildCensusPlaceWorkbookExportModel({ facts, sources: [], siteOrigin: ORIGIN, place, settlement, scope: "region-adjara" }, en))).toBe(19);
    }
    expect(censusCrawlSettlements(facts.filter((fact) => !(fact.settlement === "rural" && fact.sex === "female" && fact.ageGroup === "age_85_plus")))).toEqual(["total", "urban"]);
    expect(censusCrawlSettlements([])).toEqual([]);
  });
});

describe("education", () => {
  let facts: ClientEducationFact[];
  beforeAll(async () => { facts = shownEducationFacts(await loadEducationFacts()).map(toClientEducationFact); });
  const headingLabelsOf = (definitions: readonly { heading: string }[]) => Object.fromEntries(definitions.map((definition) => [definition.heading, definition.heading]));

  for (const section of ["universities", "vocational"] as const satisfies readonly EducationTopicId[]) {
    it(`${section}: one state, every row Georgia has (every row counts persons)`, () => {
      const georgia = facts.filter((fact) => fact.geographyId === EDUCATION_GEORGIA);
      const definitions = educationTopicSeries(section);
      const states = educationCrawlStates(section, facts);
      expect(states).toHaveLength(1);
      expect(ids(states)).toEqual(withFacts(definitions, georgia));
      expect(states[0]).toMatchObject(lineAll);
      expect(rowsOf(buildEducationWorkbookExportModel({ section, facts: georgia, state: states[0]!, labels: labelsOf(definitions), headingLabels: headingLabelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(states[0]!.selectedIds.length);
    });
  }

  it("Schools and Kindergartens places: one state per heading, every row of it", () => {
    for (const [set, placeId] of [["schools", EDUCATION_GEORGIA], ["schools", "region.guria"], ["kindergartens", "26"]] as const) {
      const definitions = educationPlaceSeries(set, placeId);
      const headingOf = new Map(definitions.map((definition) => [definition.id, definition.heading]));
      const own = facts.filter((fact) => fact.geographyId === placeId);
      const states = educationPlaceCrawlStates(set, placeId, facts);
      expect(states.map((state) => headingOf.get(state.selectedIds[0]!))).toEqual([...new Set(definitions.map((definition) => definition.heading))]);
      expect(ids(states)).toEqual(withFacts(definitions, own));
      oneUnitEach(states, (id) => headingOf.get(id));
      for (const state of states) {
        expect(rowsOf(buildEducationWorkbookExportModel({ set, placeId, scope: "s", facts, state, labels: labelsOf(definitions), headingLabels: headingLabelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    }
  });

  it("a place without teacher figures has no teachers state", () => {
    const placeId = "region.guria";
    const states = educationPlaceCrawlStates("schools", placeId, facts.filter((fact) => !(fact.geographyId === placeId && fact.indicatorId.startsWith("education.teachers."))));
    expect(states.flatMap((state) => state.selectedIds).some((id) => id.startsWith("education.teachers."))).toBe(false);
    expect(states).toHaveLength(2);
  });
});

describe("science and culture", () => {
  let facts: ClientScienceCultureFact[];
  beforeAll(async () => { facts = (await loadServedScienceCultureData()).facts.map(toClientScienceCultureFact); });

  for (const section of ["research", "patents", "theatres"] as const satisfies readonly ScienceCultureTopicId[]) {
    it(`${section}: one state per unit, every row of the list with facts`, () => {
      const definitions = scienceCultureTopicSeries(section);
      const states = scienceCultureCrawlStates(section, facts);
      expect(ids(states)).toEqual(withFacts(definitions, facts));
      oneUnitEach(states, factUnit(facts));
      for (const state of states) {
        expect(state).toMatchObject(lineAll);
        expect(rowsOf(buildScienceCultureWorkbookExportModel({ section, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    });
  }

  it("museum areas: Georgia and every region, every row with facts", () => {
    for (const area of ["georgia", ...SCIENCE_CULTURE_REGIONS] as const) {
      const definitions = museumAreaSeries(area);
      const states = museumAreaCrawlStates(area, facts);
      expect(ids(states)).toEqual(withFacts(definitions, facts));
      oneUnitEach(states, factUnit(facts));
      for (const state of states) {
        expect(rowsOf(buildScienceCultureWorkbookExportModel({ area, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    }
  });

  it("a region without visitor figures has no visitors state", () => {
    const area = SCIENCE_CULTURE_REGIONS[0];
    const visitors = museumAreaSeries(area)[0]!.id;
    expect(ids(museumAreaCrawlStates(area, facts.filter((fact) => fact.indicatorId !== visitors))).has(visitors)).toBe(false);
  });
});

describe("crime and justice", () => {
  let facts: ClientCrimeFact[];
  let population: CrimePopulation;
  beforeAll(async () => {
    facts = (await loadServedCrimeData()).facts.map(toClientCrimeFact);
    population = demography.filter((fact) => fact.seriesId === SERIES.populationTotal && fact.geographyId === GEORGIA_PLACE_ID).map((fact) => ({ year: fact.year, persons: fact.value }));
  });

  for (const { id: section } of CRIME_SECTIONS) {
    it(`${section}: each unit as counts and per 100,000, every series of the list`, () => {
      const definitions = crimeSeries(section);
      const states = crimeCrawlStates(section, facts, population);
      expect(ids(states)).toEqual(withFacts(definitions, facts));
      oneUnitEach(states, factUnit(facts));
      const counts = states.filter((state) => state.measure === "count");
      expect(states.filter((state) => state.measure === "per100k").map((state) => state.selectedIds)).toEqual(counts.map((state) => state.selectedIds));
      if (section === "road-accidents") expect(counts).toHaveLength(2);
      const sources = sourcesFor([...facts.map((fact) => fact.sourceId), SOURCE_ID.populationUnits]);
      for (const state of states) {
        expect(state).toMatchObject(lineAll);
        expect(rowsOf(buildCrimeWorkbookExportModel({ section, facts, population, state, labels: labelsOf(definitions), sources, siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    });
  }

  it("without population years there are no rates", () => {
    expect(crimeCrawlStates("recorded", facts, []).map((state) => state.measure)).toEqual(["count"]);
  });
});

describe("internet and technology", () => {
  let facts: ClientInternetFact[];
  beforeAll(async () => { facts = (await loadInternetFacts()).map(toClientInternetFact); });

  for (const section of ["users", "online", "devices"] as const satisfies readonly InternetTopicId[]) {
    it(`${section}: one state per heading, every row of it`, () => {
      const definitions = internetTopicSeries(section);
      const headingOf = new Map<string, string>(definitions.map((definition) => [definition.id, definition.heading]));
      const states = internetCrawlStates(section, facts);
      expect(states.map((state) => headingOf.get(state.selectedIds[0]!))).toEqual([...new Set(definitions.map((definition) => definition.heading))]);
      expect(ids(states)).toEqual(withFacts(definitions, facts));
      oneUnitEach(states, (id) => headingOf.get(id));
      for (const state of states) {
        expect(rowsOf(buildInternetWorkbookExportModel({ section, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    });
  }

  it("homes areas: Georgia and every region, one state with every row (all shares of homes)", () => {
    for (const area of ["georgia", ...INTERNET_REGIONS] as const) {
      const definitions = internetAreaSeries(area);
      const states = internetAreaCrawlStates(area, facts);
      expect(states).toHaveLength(1);
      expect(ids(states)).toEqual(withFacts(definitions, facts));
      expect(rowsOf(buildInternetWorkbookExportModel({ area, facts, state: states[0]!, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(definitions.length);
    }
  });

  it("an area without computer figures lists internet only", () => {
    const area = INTERNET_REGIONS[0];
    expect([...ids(internetAreaCrawlStates(area, facts.filter((fact) => !fact.indicatorId.startsWith("internet.homes_computer."))))]).toEqual([internetAreaSeries(area)[0]!.id]);
  });
});

describe("transport", () => {
  let facts: ClientTransportFact[];
  beforeAll(async () => { facts = (await loadTransportFacts()).map(toClientTransportFact); });

  for (const section of ["vehicles", "vehicle-age", "passengers", "freight"] as const satisfies readonly TransportTopicId[]) {
    it(`${section}: one state per unit, every row of the list with facts`, () => {
      const definitions = transportTopicSeries(section);
      const states = transportCrawlStates(section, facts);
      expect(ids(states)).toEqual(withFacts(definitions, facts));
      oneUnitEach(states, factUnit(facts));
      for (const state of states) {
        expect(rowsOf(buildTransportWorkbookExportModel({ section, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    });
  }

  it("areas: Georgia and every region, every row with facts", () => {
    for (const area of ["georgia", ...TRANSPORT_REGIONS] as const) {
      const definitions = transportAreaSeries(area);
      const states = transportAreaCrawlStates(area, facts);
      expect(ids(states)).toEqual(withFacts(definitions, facts));
      oneUnitEach(states, factUnit(facts));
      for (const state of states) {
        expect(rowsOf(buildTransportWorkbookExportModel({ area, facts, state, labels: labelsOf(definitions), sources: [], siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
      }
    }
  });

  it("an area without one unit's figures has no state for it", () => {
    const area = TRANSPORT_REGIONS[0];
    const unitOf = factUnit(facts);
    const all = transportAreaCrawlStates(area, facts);
    expect(all.length).toBeGreaterThan(1);
    const dropped = unitOf(all.at(-1)!.selectedIds[0]!);
    const listed = new Set(transportAreaSeries(area).map((definition) => definition.id));
    const states = transportAreaCrawlStates(area, facts.filter((fact) => !(listed.has(fact.indicatorId) && fact.unit === dropped)));
    expect(states).toHaveLength(all.length - 1);
    expect(states.map((state) => unitOf(state.selectedIds[0]!))).not.toContain(dropped);
  });
});

describe("energy and food", () => {
  let facts: ClientEnergyFoodFact[];
  beforeAll(async () => { facts = (await loadEnergyFoodFacts()).map(toClientEnergyFoodFact); });

  for (const { id: section } of ENERGY_FOOD_SECTIONS) {
    it(`${section}: one state per group a chart can hold, every row with facts`, () => {
      const definitions = energyFoodSeries(section);
      const states = energyFoodCrawlStates(section, facts);
      expect(ids(states)).toEqual(withFacts(definitions, facts));
      oneUnitEach(states, energyFoodGroup);
      const sources = sourcesFor(facts.map((fact) => fact.sourceId));
      for (const state of states) {
        expect(state).toMatchObject(lineAll);
        expect(rowsOf(buildEnergyFoodWorkbookExportModel({ section, facts, state, labels: labelsOf(definitions), sources, siteOrigin: ORIGIN }, en))).toBe(state.selectedIds.length);
      }
    });
  }
});

describe("environment and climate", () => {
  let facts: ClientEnvironmentFact[];
  let sources: ReturnType<typeof sourcesFor>;
  beforeAll(async () => {
    facts = (await loadEnvironmentFacts()).map(toClientEnvironmentFact);
    sources = sourcesFor(facts.map((fact) => fact.sourceId));
  });
  const check = (page: EnvironmentWorkbookPage, definitions: readonly EnvironmentSeriesDefinition[]) => {
    const states = environmentListCrawlStates(definitions, facts);
    expect(ids(states)).toEqual(withFacts(definitions, facts));
    oneUnitEach(states, factUnit(facts));
    for (const state of states) {
      expect(rowsOf(buildEnvironmentWorkbookExportModel({ ...page, facts, state, labels: labelsOf(definitions), sources, siteOrigin: ORIGIN, title: "T" }, en))).toBe(state.selectedIds.length);
    }
    return states;
  };

  it("topic pages: one state per unit, every row with facts", () => {
    for (const section of ["greenhouse-gases", "air-pollution", "climate", "water"] as const satisfies readonly EnvironmentTopicId[]) {
      expect(check({ section }, environmentTopicSeries(section)).length).toBeGreaterThan(0);
    }
  });

  it("city air quality and waste and forests areas: every row each place has", () => {
    for (const city of ENVIRONMENT_CITIES) check({ city }, environmentCitySeries(city, facts));
    for (const topic of ["waste", "forests"] as const satisfies readonly EnvironmentAreaTopic[]) {
      for (const area of ENVIRONMENT_AREAS) check({ topic, area }, environmentAreaSeries(topic, area, facts));
    }
  });

  it("a city without one unit's figures has no state for it", () => {
    const definitions = environmentCitySeries("tbilisi", facts);
    const unitOf = factUnit(facts);
    const all = environmentListCrawlStates(definitions, facts);
    expect(all.length).toBeGreaterThan(1);
    const dropped = unitOf(all.at(-1)!.selectedIds[0]!);
    const listed = new Set(definitions.map((definition) => definition.id));
    const states = environmentListCrawlStates(definitions, facts.filter((fact) => !(listed.has(fact.indicatorId) && fact.unit === dropped)));
    expect(states.map((state) => unitOf(state.selectedIds[0]!))).not.toContain(dropped);
  });
});
