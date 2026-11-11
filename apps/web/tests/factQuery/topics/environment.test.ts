// apps/web/tests/factQuery/topics/environment.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedEnvironmentData, toClientEnvironmentFact } from "../../../lib/data/environment/importEnvironment";
import { ENVIRONMENT_CITIES, ENVIRONMENT_INDICATORS, ENVIRONMENT_REGIONS, ENVIRONMENT_SOURCES, type ClientEnvironmentFact, type EnvironmentCity } from "../../../lib/data/environment/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { environmentListCrawlStates, environmentSeriesLabel, environmentTopicSeries, type EnvironmentSeriesDefinition, type EnvironmentTopicId } from "../../../lib/explorer/environment";
import { ENVIRONMENT_AREAS, environmentAreaRoutes, environmentAreaSeries, type EnvironmentArea, type EnvironmentAreaTopic } from "../../../lib/explorer/environmentAreas";
import { environmentCitySeries } from "../../../lib/explorer/environmentCities";
import { environmentLabels, environmentListFacts } from "../../../lib/explorer/environmentPageData";
import { buildEnvironmentWorkbookExportModel, type EnvironmentWorkbookPage } from "../../../lib/explorer/environmentWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { rank, type RankData } from "../../../lib/factQuery/rank";
import { environmentTopicAdapter } from "../../../lib/factQuery/topics/environment";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { message } from "../../../lib/i18n/messages";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale } from "../../../lib/i18n/types";
import { loadSourcedWorkbookSources } from "../../../lib/methodology/workbookSources";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ADJARA = "region.adjara";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const SECTIONS = ["greenhouse-gases", "air-pollution", "climate", "water"] as const satisfies readonly EnvironmentTopicId[];
const AREA_TOPICS = ["waste", "forests"] as const satisfies readonly EnvironmentAreaTopic[];
const AREA_IDS = [GEORGIA_PLACE_ID, ...ENVIRONMENT_REGIONS.map((region) => region.replace("region_", "region."))];
const CITY_IDS = ENVIRONMENT_CITIES.map((city) => `city.${city}`);

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: ClientEnvironmentFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === `environment-${id}`)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year);
const seriesOf = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);

beforeAll(async () => {
  let facts: Awaited<ReturnType<typeof loadServedEnvironmentData>>;
  [builds, facts, csv] = await Promise.all([
    environmentTopicAdapter.build(), loadServedEnvironmentData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/environment-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
  served = facts.map(toClientEnvironmentFact);
}, 60_000);

describe("environment topic adapter", () => {
  it("is registered, reads the environment source archive and builds the seven Environment and climate pages", () => {
    expect(TOPIC_ADAPTERS).toContain(environmentTopicAdapter);
    expect(environmentTopicAdapter).toMatchObject({ family: "environment", sourceArchive: ["environment"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "environment"));
    // City air quality: 16 stations' averages and days (Zestaponi's four manual measures) and the three yearly limits.
    expect(builds.map((build) => [build.page.datasetId, build.titleEn, build.entities.length, build.series.length])).toEqual([
      ["environment-greenhouse-gases", "Greenhouse gases", 1, 16], ["environment-air-pollution", "Air pollution", 1, 24], ["environment-air-quality", "City air quality", 9, 67],
      ["environment-climate", "Temperature and rain", 1, 12], ["environment-water", "Water", 1, 12], ["environment-waste", "Waste", 12, 2], ["environment-forests", "Forests", 12, 6],
    ]);
    for (const build of builds) expect(build.breaks).toEqual([]);
  });

  it("serves Georgia on the national pages, each city's page as a city, and Georgia's and each region's area page on Waste and Forests", () => {
    for (const section of SECTIONS) expect(dataset(section).entities).toEqual([{ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null }]);
    const cities = dataset("air-quality").entities;
    expect(cities.map((entity) => entity.entityId)).toEqual(CITY_IDS);
    expect(cities.find((entity) => entity.entityId === "city.rustavi")).toEqual({ entityId: "city.rustavi", entityType: "city", labelKa: "რუსთავი", labelEn: "Rustavi", parentEntityId: GEORGIA_PLACE_ID });
    for (const topic of AREA_TOPICS) {
      expect(dataset(topic).entities.map((entity) => entity.entityId)).toEqual(AREA_IDS);
      expect(dataset(topic).entities.find((entity) => entity.entityId === ADJARA)).toEqual({ entityId: ADJARA, entityType: "region", labelKa: "აჭარა", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
    }
  });

  it("gives a city the inflation cities' id where the city is the same", () => {
    const inflation = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).inflation.cityEntities;
    const cities = dataset("air-quality").entities;
    const shared = cities.filter((entity) => inflation.some((city) => city.id === entity.entityId));
    expect(shared.map((entity) => entity.entityId)).toEqual(["city.tbilisi", "city.kutaisi", "city.batumi", "city.zugdidi", "city.telavi"]);
    for (const entity of shared) expect(inflation.find((city) => city.id === entity.entityId)!.labelEn).toBe(entity.labelEn);
    // No other inflation city carries an Environment city's English name under another id.
    for (const city of inflation) expect(cities.filter((entity) => entity.labelEn === city.labelEn && entity.entityId !== city.id)).toEqual([]);
  });

  it("serves Geostat's figures in each row's own unit; a place's limit and area measure as one series across the places", () => {
    const ghg = rowOf("environment.ghg.total", 2022)!;
    expect(factOf("greenhouse-gases", GEORGIA_PLACE_ID, "environment.ghg.total", 2022)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "environment.ghg.total", year: 2022, value: Number(ghg.published_value), basis: "actual", status: "official", sourceIds: [ghg.source_id],
    });
    expect(factOf("air-quality", "city.rustavi", "environment.aq.pm10_limit", 2024)!.value).toBe(Number(rowOf("environment.aq.pm10_limit.rustavi", 2024)!.published_value));
    expect(factOf("air-quality", "city.rustavi", "environment.aq.pm10_avg.rustavi_d1", 2024)!.value).toBe(Number(rowOf("environment.aq.pm10_avg.rustavi_d1", 2024)!.published_value));
    expect(factOf("air-quality", "city.zestaponi", "environment.aq.tsp_avg.zestaponi_e1", 2005)!.value).toBe(505);
    const adjara = rowOf("environment.waste.collected.region_adjara", 2024)!;
    expect(factOf("waste", ADJARA, "environment.waste.collected", 2024)).toMatchObject({ value: Number(adjara.published_value), sourceIds: [adjara.source_id] });
    expect(factOf("waste", GEORGIA_PLACE_ID, "environment.waste.collected", 2024)!.value).toBe(Number(rowOf("environment.waste.collected.georgia", 2024)!.published_value));
    expect(factOf("forests", ADJARA, "environment.forest.timber_cut", 2024)!.value).toBe(Number(rowOf("environment.forest.timber_cut.region_adjara", 2024)!.published_value));
    // Geostat's stored per-person figures are served; Fiscal.ge computes none.
    expect(factOf("water", GEORGIA_PLACE_ID, "environment.water.per_person", 2024)!.value).toBe(Number(rowOf("environment.water.per_person", 2024)!.published_value));
    const units = (id: string) => Object.fromEntries(dataset(id).series.map((series) => [series.seriesId, series.unit]));
    expect(units("greenhouse-gases")).toMatchObject({ "environment.ghg.total": "mt_co2e", "environment.ghg.gas_hfcs": "kt_co2e", "environment.ghg.per_person": "t_co2e_per_person" });
    expect(units("water")).toMatchObject({ "environment.water.gross": "million_m3", "environment.water.lost_share": "percent", "environment.water.people_piped": "million_persons" });
    expect(units("air-quality")).toMatchObject({ "environment.aq.pm10_limit": "ug_m3", "environment.aq.pm10_days.rustavi_d1": "days" });
    expect(units("forests")).toMatchObject({ "environment.forest.fires": "fires", "environment.forest.burnt_area": "hectares" });
    // A row is named as the workbook names it, under its heading's own words.
    expect(seriesOf("air-pollution", "environment.air.co.total")).toMatchObject({ labelEn: "Total — Carbon monoxide (CO)", headingEn: "Carbon monoxide (CO)", isTotal: true, parentSeriesId: null });
    expect(seriesOf("air-pollution", "environment.air.co.stationary")).toMatchObject({ headingEn: "Carbon monoxide (CO)", isTotal: false, parentSeriesId: null });
    expect(seriesOf("air-quality", "environment.aq.pm10_limit")).toMatchObject({ labelEn: "Yearly limit — Fine dust PM10, yearly average", headingEn: "Fine dust PM10, yearly average" });
    expect(seriesOf("climate", "environment.climate.temperature.georgia")).toMatchObject({ labelEn: "Georgia — Yearly average temperature", isTotal: true });
    expect(seriesOf("greenhouse-gases", "environment.ghg.total")).toMatchObject({ labelEn: "Total emissions", headingEn: "Total", isTotal: true });
    expect(testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units.ug_m3).toEqual({ labelKa: "მკგ/მ³", labelEn: "µg/m³" });
  });

  it("serves nothing the pages do not show, a blank year as missing", () => {
    // Wastewater treatment by stage is reviewed but listed on no page; Geostat prints no timber cut in Tbilisi.
    const servedIndicators = new Set([
      ...SECTIONS.flatMap((section) => environmentTopicSeries(section)), ...ENVIRONMENT_CITIES.flatMap((city) => environmentCitySeries(city, served)),
      ...AREA_TOPICS.flatMap((topic) => ENVIRONMENT_AREAS.flatMap((area) => environmentAreaSeries(topic, area, served))),
    ].map((series) => series.id));
    expect(ENVIRONMENT_INDICATORS.filter((id) => !servedIndicators.has(id))).toEqual(["environment.water.treatment_primary", "environment.water.treatment_secondary", "environment.water.treatment_tertiary", "environment.forest.timber_cut.region_tbilisi"]);
    for (const build of builds) expect(build.series.map((series) => series.seriesId).filter((id) => id.includes("treatment_"))).toEqual([]);
    expect(dataset("forests").facts.some((fact) => fact.entityId === "region.tbilisi" && fact.seriesId === "environment.forest.timber_cut")).toBe(false);
    // Rows Geostat publishes only nationally are Georgia's alone.
    expect([...new Set(dataset("forests").facts.filter((fact) => fact.entityId === ADJARA).map((fact) => fact.seriesId))].sort()).toEqual(["environment.forest.illegal_logging", "environment.forest.timber_cut"]);
    expect([...new Set(dataset("waste").facts.filter((fact) => fact.entityId === ADJARA).map((fact) => fact.seriesId))]).toEqual(["environment.waste.collected"]);
    // A station keeps to its city: Varketili is Tbilisi's alone.
    expect([...new Set(dataset("air-quality").facts.filter((fact) => fact.seriesId === "environment.aq.pm10_avg.tbilisi_a1").map((fact) => fact.entityId))]).toEqual(["city.tbilisi"]);
    // Temperature and rain has no figures for 1991–1994: missing, never zero.
    expect(rowOf("environment.climate.temperature.georgia", 1992)).toBeUndefined();
    expect(factOf("climate", GEORGIA_PLACE_ID, "environment.climate.temperature.georgia", 1992)).toMatchObject({ value: null, sourceIds: [] });
  });
});

describe("compare and sources on the environment datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparison = (id: string, seriesId: string, fromYear: number, toYear: number, entityIds?: string[]): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId: `environment-${id}`, seriesIds: [seriesId], ...(entityIds ? { entityIds } : {}) }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };
  const published = (indicatorId: string, year: number) => Number(rowOf(indicatorId, year)!.published_value);

  it("gives a water share's change in percentage points (R19) and a city's or region's in its own unit", () => {
    const lost = comparison("water", "environment.water.lost_share", 2015, 2024);
    expect(lost).toMatchObject({ comparability: "comparable", unit: "percent", percentageChange: null });
    expect(lost.percentagePointChange).toBeCloseTo(published("environment.water.lost_share", 2024) - published("environment.water.lost_share", 2015), 9);
    const station = comparison("air-quality", "environment.aq.pm10_avg.rustavi_d1", 2019, 2024, ["city.rustavi"]);
    expect(station).toMatchObject({ comparability: "comparable", unit: "ug_m3", percentagePointChange: null });
    expect(station.absoluteChange).toBeCloseTo(published("environment.aq.pm10_avg.rustavi_d1", 2024) - published("environment.aq.pm10_avg.rustavi_d1", 2019), 9);
    const waste = comparison("waste", "environment.waste.collected", 2015, 2024, [ADJARA]);
    expect(waste.absoluteChange).toBeCloseTo(published("environment.waste.collected.region_adjara", 2024) - published("environment.waste.collected.region_adjara", 2015), 9);
  });

  it("gives a temperature's change as a difference only, never a percentage (R33), and rain its percentage", () => {
    for (const seriesId of ["environment.climate.temperature.georgia", "environment.climate.temperature_anomaly.georgia"]) {
      const change = comparison("climate", seriesId, 2011, 2024);
      expect(change, seriesId).toMatchObject({ comparability: "comparable", unit: "celsius", percentageChange: null, percentagePointChange: null });
      expect(change.absoluteChange, seriesId).toBeCloseTo(published(seriesId, 2024) - published(seriesId, 2011), 9);
      expect(change.reasonsEn, seriesId).toEqual([]);
    }
    const rain = comparison("climate", "environment.climate.precipitation.georgia", 2011, 2024);
    expect(rain).toMatchObject({ comparability: "comparable", unit: "mm", percentagePointChange: null });
    expect(rain.percentageChange).toBeCloseTo((published("environment.climate.precipitation.georgia", 2024) / published("environment.climate.precipitation.georgia", 2011) - 1) * 100, 9);
  });

  it("ranks temperatures by their difference and refuses their percentage change (R33); rain ranks by percentage", () => {
    const ranked = (seriesId: string, metric: string) => rank(snapshot, { datasetId: "environment-climate", dimension: "series", seriesId, measure: "value", metric, fromYear: 2011, toYear: 2024 } as Parameters<typeof rank>[1]);
    for (const seriesId of ["environment.climate.temperature.tbilisi", "environment.climate.temperature_anomaly.tbilisi"]) {
      const refused = ranked(seriesId, "percentage_change") as { kind: string; error: { code: string; messageEn: string } };
      expect(refused.kind, seriesId).toBe("error");
      expect(refused.error).toMatchObject({ code: "unsupported_measure", messageEn: expect.stringContaining("absolute_change") });
      const response = ranked(seriesId, "absolute_change");
      if (response.kind !== "ranking") throw new Error(JSON.stringify(response));
      // The heading's places, the national figure (the page's reference) aside.
      expect((response.data as RankData).entries.map((entry) => entry.seriesId).sort(), seriesId).toEqual([seriesId.replace(".tbilisi", ".coldest"), seriesId, seriesId.replace(".tbilisi", ".warmest")]);
      expect((response.data as RankData).entries.every((entry) => entry.unit === "celsius"), seriesId).toBe(true);
    }
    const rain = ranked("environment.climate.precipitation.tbilisi", "percentage_change");
    if (rain.kind !== "ranking") throw new Error(JSON.stringify(rain));
    expect((rain.data as RankData).entries.every((entry) => entry.unit === "percent")).toBe(true);
  });

  it("ranks a pollutant's two sources against each other, never against its total", () => {
    const response = rank(snapshot, { datasetId: "environment-air-pollution", dimension: "series", seriesId: "environment.air.co.stationary", measure: "value", metric: "value", year: 2024 } as Parameters<typeof rank>[1]);
    if (response.kind !== "ranking") throw new Error(JSON.stringify(response));
    expect((response.data as RankData).entries.map((entry) => entry.seriesId).sort()).toEqual(["environment.air.co.mobile", "environment.air.co.stationary"]);
  });

  it("cites exactly the 13 Geostat workbooks the values are read from, resolved through get_sources", () => {
    const cited = [...new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "environment").flatMap((entry) => entry.columns.sources.flat()))].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(ENVIRONMENT_SOURCES.map((id) => `source.${id}`).sort());
    const forests = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "environment-forests")!;
    const own = [...new Set(forests.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort();
    const response = getSources(snapshot, { sourceIds: own, datasetId: "environment-forests", years: [forests.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual(own);
    for (const source of sources) expect(source.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/environment.tsx, environment-air-quality.tsx, environment-areas.tsx; components/environment/
// environment-explorer.tsx's useCrawlModels). The City air quality, Waste and Forests index pages draw cards, a map and a list.

type Reader = (row: WorkbookReadableRow) => ParityTarget | null;
function matcher() {
  const readers = new Map<WorkbookExportModel, Reader>();
  return {
    add: (model: WorkbookExportModel, reader: Reader) => { readers.set(model, reader); return model; },
    match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.(row) ?? null,
  };
}
type Matcher = ReturnType<typeof matcher>;

async function inputs(locale: Locale) {
  const ids = ["georgia", ...ENVIRONMENT_REGIONS.map((region) => region.replace("region_", "region."))];
  const [presentation, sources] = await Promise.all([
    getPresentation(locale, ["environment", "regionalEconomies", "format", "main", "workbook"], ids, ids),
    loadSourcedWorkbookSources("environment", locale, (row) => ENVIRONMENT_SOURCES.includes(row.source_id)),
  ]);
  return { presentation, sources, t: (key: string) => message(presentation.messages, `environment.${key}`) };
}

/** One page's list: its crawl tables' models, a table's rows its selected series in list order, each named as the workbook names it, which is checked. */
async function listModels(locale: Locale, m: Matcher, page: EnvironmentWorkbookPage, series: readonly EnvironmentSeriesDefinition[], target: (id: string) => ParityTarget) {
  const { presentation, sources, t } = await inputs(locale);
  const facts = environmentListFacts(served, series), labels = environmentLabels(presentation, series.map((item) => item.id));
  return environmentListCrawlStates(series, facts).map((state) => {
    const model = buildEnvironmentWorkbookExportModel({ ...page, facts, state, labels, sources, siteOrigin: ORIGIN, title: "title" }, presentation);
    const listed = series.filter((definition) => state.selectedIds.includes(definition.id));
    return m.add(model, (row) => {
      const definition = listed[model.readable.rows.indexOf(row)];
      return definition && environmentSeriesLabel(definition, labels, t) === row.label ? target(definition.id) : null;
    });
  });
}

const cityModels = async (locale: Locale, cities: readonly EnvironmentCity[], m: Matcher) => (await Promise.all(cities.map((city) => listModels(locale, m, { city }, environmentCitySeries(city, served), (id) => {
  // A city's limit is the measure's one served series; a station's row keeps its id.
  const [head, topic, measure] = id.split(".");
  return { entityId: `city.${city}`, seriesId: measure!.endsWith("_limit") ? `${head}.${topic}.${measure}` : id };
})))).flat();

const areaModels = async (locale: Locale, topic: EnvironmentAreaTopic, areas: readonly EnvironmentArea[], m: Matcher) => (await Promise.all(areas.map((area) => listModels(locale, m, { topic, area }, environmentAreaSeries(topic, area, served), (id) => ({
  entityId: area === "georgia" ? GEORGIA_PLACE_ID : environmentAreaRoutes(topic).mapId(area),
  // An area measure's row (`environment.waste.collected.<area>`) is the measure's one served series.
  seriesId: id.endsWith(`.${area}`) ? id.slice(0, -area.length - 1) : id,
}))))).flat();

describe("environment parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(section), await listModels(locale, m, { section }, environmentTopicSeries(section), (id) => ({ entityId: GEORGIA_PLACE_ID, seriesId: id })), m.match);
      });
    }
    it(`air-quality (${locale}): Tbilisi's and Zestaponi's city pages`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("air-quality"), await cityModels(locale, ["tbilisi", "zestaponi"], m), m.match, ["city.tbilisi", "city.zestaponi"]);
    });
    for (const topic of AREA_TOPICS) {
      it(`${topic} (${locale}): Georgia's and Adjara's area pages`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(topic), await areaModels(locale, topic, ["georgia", "region_adjara"], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
      });
    }
  }

  it("air-quality (en): every city page", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("air-quality"), await cityModels("en", ENVIRONMENT_CITIES, m), m.match);
  });

  for (const topic of AREA_TOPICS) {
    it(`${topic} (en): every area page`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset(topic), await areaModels("en", topic, ENVIRONMENT_AREAS, m), m.match);
    });
  }

  it("fails when a served figure is not the one the page prints", async () => {
    const quality = dataset("air-quality");
    const facts = quality.facts.map((fact): TopicFact => (fact.year === 2024 && fact.entityId === "city.rustavi" && fact.seriesId === "environment.aq.pm10_limit" ? { ...fact, value: fact.value! + 1 } : fact));
    const m = matcher();
    const models = await cityModels("en", ["rustavi"], m);
    expect(() => expectWorkbookParity({ ...quality, facts }, models, m.match, ["city.rustavi"])).toThrow(/2024: the page prints [\d.]+, city.rustavi environment.aq.pm10_limit serves/);
  });
});
