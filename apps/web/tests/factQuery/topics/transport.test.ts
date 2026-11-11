// apps/web/tests/factQuery/topics/transport.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedTransportData } from "../../../lib/data/transport/importTransport";
import { TRANSPORT_REGIONS, TRANSPORT_SOURCES, type TransportFact } from "../../../lib/data/transport/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { transportCrawlStates, transportSeriesLabel, transportTopicSeries, type TransportTopicId } from "../../../lib/explorer/transport";
import { TRANSPORT_AREAS, transportAreaCrawlStates, transportAreaSeries, transportMapId, type TransportArea } from "../../../lib/explorer/transportAreas";
import { transportAreaFacts, transportAreaSeriesLabels, transportLabels, transportPageFacts } from "../../../lib/explorer/transportPageData";
import { buildTransportWorkbookExportModel } from "../../../lib/explorer/transportWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { transportTopicAdapter } from "../../../lib/factQuery/topics/transport";
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
const TBILISI = "region.tbilisi";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const SECTIONS = ["vehicles", "vehicle-age", "passengers", "freight"] as const satisfies readonly TransportTopicId[];

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: TransportFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year);
const seriesOf = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);

beforeAll(async () => {
  [builds, { facts: served }, csv] = await Promise.all([
    transportTopicAdapter.build(), loadServedTransportData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/transport-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("transport topic adapter", () => {
  it("is registered, reads the transport source archive and builds the five Transport pages", () => {
    expect(TOPIC_ADAPTERS).toContain(transportTopicAdapter);
    expect(transportTopicAdapter).toMatchObject({ family: "transport", sourceArchive: ["transport"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "transport"));
    // Vehicles: 4 types and 25 fuel rows; Vehicle age: 5 age rows per type, buses without unknown; Passengers: 6 modes, per person and 7 carriers;
    // Freight: 5 modes and 11 carriers; Regions: 5 type, 8 fuel, 5 age and 2 owner columns of registered vehicles, and 4 road rows.
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([
      ["transport-vehicles", 1, 29], ["transport-vehicle-age", 1, 19], ["transport-passengers", 1, 14], ["transport-freight", 1, 16], ["transport-regions", 12, 24],
    ]);
  });

  it("serves Georgia on the topic pages, and Georgia and the 11 regions, each its area page, on Regions", () => {
    for (const section of SECTIONS) expect(dataset(`transport-${section}`).entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    const regions = dataset("transport-regions").entities;
    expect(regions.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID, ...TRANSPORT_REGIONS.map((region) => region.replace("region_", "region."))]);
    expect(regions[0]).toEqual({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null });
    expect(regions.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", labelKa: "აჭარა", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
  });

  it("serves Geostat's published figures in each row's own unit", () => {
    const cars = rowOf("transport.fleet.cars", 2024)!;
    expect(factOf("transport-vehicles", GEORGIA_PLACE_ID, "transport.fleet.cars", 2024)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "transport.fleet.cars", year: 2024, value: Number(cars.published_value), basis: "actual", status: "official", sourceIds: [cars.source_id],
    });
    // Registered vehicles to one decimal, as the page prints them, not the stored thousands to three.
    const adjara = rowOf("transport.registered.region_adjara", 2025)!;
    expect(Number(adjara.value)).not.toBe(Number(adjara.published_value));
    expect(factOf("transport-regions", ADJARA, "transport.registered", 2025)).toMatchObject({ value: Number(adjara.published_value), sourceIds: [adjara.source_id] });
    expect(factOf("transport-regions", GEORGIA_PLACE_ID, "transport.registered.fuel_diesel", 2025)!.value).toBe(Number(rowOf("transport.registered.total_fuel_diesel", 2025)!.published_value));
    expect(factOf("transport-regions", ADJARA, "transport.road_km.secondary", 2024)!.value).toBe(Number(rowOf("transport.road_km.region_adjara_secondary", 2024)!.published_value));
    const units = (id: string) => Object.fromEntries(dataset(id).series.map((series) => [series.seriesId, series.unit]));
    expect(units("transport-passengers")).toMatchObject({ "transport.passenger_km.rail": "million_passenger_km", "transport.passenger_km_per_person.total": "passenger_km_per_person", "transport.passengers.metro": "thousand_passengers" });
    expect(units("transport-freight")).toMatchObject({ "transport.tonne_km.road": "million_tonne_km", "transport.freight_tonnes.seaports": "thousand_tonnes" });
    expect(units("transport-regions")).toMatchObject({ "transport.registered.owner_companies": "thousand_units", "transport.road_km": "km" });
    // Headings without the display scale the page adds after " · ": the served unit names it.
    expect(seriesOf("transport-vehicles", "transport.fleet.trucks_fuel_diesel")).toMatchObject({ labelEn: "Diesel", headingEn: "Trucks by fuel", isTotal: false, parentSeriesId: null });
    expect(seriesOf("transport-passengers", "transport.passenger_km.total")).toMatchObject({ labelEn: "All transport", headingEn: "Passenger-km", headingKa: "მგზავრთბრუნვა", isTotal: true });
    expect(seriesOf("transport-regions", "transport.registered.age_over_10")).toMatchObject({ labelEn: "Over 10 years", headingEn: "Registered vehicles · By age", isTotal: false });
    expect(seriesOf("transport-regions", "transport.road_km")).toMatchObject({ labelEn: "All roads", headingEn: "Roads", isTotal: true });
    const unitNames = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units;
    expect([unitNames.thousand_units, unitNames.million_passenger_km, unitNames.passenger_km_per_person, unitNames.thousand_passengers, unitNames.million_tonne_km, unitNames.thousand_tonnes, unitNames.km]).toEqual([
      { labelKa: "ათასი ერთეული", labelEn: "thousand units" }, { labelKa: "მლნ მგზავრ-კმ", labelEn: "million passenger-km" }, { labelKa: "მგზავრ-კმ ერთ სულზე", labelEn: "passenger-km per person" },
      { labelKa: "ათასი მგზავრი", labelEn: "thousand passengers" }, { labelKa: "მლნ ტონა-კმ", labelEn: "million tonne-km" }, { labelKa: "ათასი ტონა", labelEn: "thousand tonnes" }, { labelKa: "კმ", labelEn: "km" },
    ]);
  });

  it("serves nothing the pages do not show, a blank year as missing and a nil cell as zero", () => {
    // Abkhazia and "region unknown" have no area page; the three tiny register columns are unlisted; the regional rows sit on the area pages only.
    expect(dataset("transport-regions").entities.map((entity) => entity.entityId).filter((id) => /abkhazia|unknown/.test(id))).toEqual([]);
    const regionSeries = dataset("transport-regions").series.map((series) => series.seriesId);
    for (const hidden of ["transport.registered.type_unknown", "transport.registered.fuel_diesel_gas", "transport.registered.fuel_hybrid_diesel"]) expect(regionSeries).not.toContain(hidden);
    for (const section of SECTIONS) expect(dataset(`transport-${section}`).series.filter((series) => /\.(registered|road_km)\./.test(series.seriesId))).toEqual([]);
    // A road row 0 in every year is listed on no page: Tbilisi's local roads (local roads exclude self-governing cities).
    expect(rowOf("transport.road_km.region_tbilisi_local", 2024)).toMatchObject({ published_value: "0.0" });
    expect(dataset("transport-regions").facts.filter((fact) => fact.entityId === TBILISI && fact.seriesId === "transport.road_km.local")).toEqual([]);
    expect(factOf("transport-regions", ADJARA, "transport.road_km.local", 2024)!.value).toBeGreaterThan(0);
    // Geostat prints no fleet for 2004, and no railway passengers for 2012: missing, never zero.
    expect(rowOf("transport.fleet.cars", 2004)).toBeUndefined();
    expect(factOf("transport-vehicles", GEORGIA_PLACE_ID, "transport.fleet.cars", 2004)).toMatchObject({ value: null, sourceIds: [] });
    expect(rowOf("transport.passengers.rail", 2012)).toBeUndefined();
    expect(factOf("transport-passengers", GEORGIA_PLACE_ID, "transport.passengers.rail", 2012)).toMatchObject({ value: null, sourceIds: [] });
    // A nil cell ("-") is a published zero, served as 0.
    const electric = rowOf("transport.fleet.buses_fuel_electric", 2017)!;
    expect(Number(electric.published_value)).toBe(0);
    expect(factOf("transport-vehicles", GEORGIA_PLACE_ID, "transport.fleet.buses_fuel_electric", 2017)).toMatchObject({ value: 0, sourceIds: [electric.source_id] });
    for (const build of builds) expect(build.breaks).toEqual([]);
  });
});

describe("compare and sources on the transport datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparison = (datasetId: string, seriesId: string, fromYear: number, toYear: number, entityIds?: string[]): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId], ...(entityIds ? { entityIds } : {}) }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };
  const published = (indicatorId: string, year: number) => Number(rowOf(indicatorId, year)!.published_value);

  it("gives a fleet and a region's registered vehicles an absolute and a percentage change", () => {
    const cars = comparison("transport-vehicles", "transport.fleet.cars", 2015, 2024);
    const [from, to] = [published("transport.fleet.cars", 2015), published("transport.fleet.cars", 2024)];
    expect(cars).toMatchObject({ unit: "thousand_units", comparability: "comparable", percentagePointChange: null });
    expect(cars.absoluteChange).toBeCloseTo(to - from, 9);
    expect(cars.percentageChange).toBeCloseTo(((to - from) / from) * 100, 6);
    const registered = comparison("transport-regions", "transport.registered", 2017, 2025, [ADJARA]);
    expect(registered).toMatchObject({ unit: "thousand_units", comparability: "comparable" });
    expect(registered.absoluteChange).toBeCloseTo(published("transport.registered.region_adjara", 2025) - published("transport.registered.region_adjara", 2017), 9);
  });

  it("cites exactly the 13 Geostat workbooks the values are read from, resolved through get_sources", () => {
    const all = new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "transport").flatMap((entry) => entry.columns.sources.flat()).map((index) => snapshot.topics.sourceIds[index]!));
    expect([...all].sort()).toEqual(TRANSPORT_SOURCES.map((id) => `source.${id}`).sort());
    const regions = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "transport-regions")!;
    const cited = [...new Set(regions.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(["source.geostat_transport_registered", "source.geostat_transport_roads"]);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "transport-regions", years: [regions.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual(cited);
    for (const source of sources) expect(source.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/transport.tsx, transport-area.tsx; components/transport/transport-explorer.tsx and
// transport-area-explorer.tsx's useCrawlModels). The Regions index draws a map and a list of the area pages' figures.

type Reader = (row: WorkbookReadableRow) => ParityTarget | null;
function matcher() {
  const readers = new Map<WorkbookExportModel, Reader>();
  const add = (model: WorkbookExportModel, reader: Reader) => {
    readers.set(model, reader);
    return model;
  };
  return { add, match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.(row) ?? null };
}
type Matcher = ReturnType<typeof matcher>;

async function inputs(locale: Locale) {
  const ids = ["georgia", ...TRANSPORT_REGIONS.map((region) => region.replace("region_", "region."))];
  const [presentation, sources] = await Promise.all([
    getPresentation(locale, ["transport", "regionalEconomies", "format", "main", "workbook"], ids, ids),
    loadSourcedWorkbookSources("transport", locale, (row) => TRANSPORT_SOURCES.includes(row.source_id)),
  ]);
  return { presentation, sources, t: (key: string) => message(presentation.messages, `transport.${key}`) };
}

async function topicModels(locale: Locale, section: TransportTopicId, m: Matcher) {
  const { presentation, sources, t } = await inputs(locale);
  const pageFacts = transportPageFacts(served, section), labels = transportLabels(presentation, section), title = t(`page.${section}.title`);
  const definitions = transportTopicSeries(section);
  return transportCrawlStates(section, pageFacts).map((state) =>
    m.add(buildTransportWorkbookExportModel({ section, facts: pageFacts, state, labels, sources, siteOrigin: ORIGIN, title }, presentation), (row) => {
      const series = definitions.find((candidate) => state.selectedIds.includes(candidate.id) && transportSeriesLabel(candidate, labels, t) === row.label);
      return series ? { entityId: GEORGIA_PLACE_ID, seriesId: series.id } : null;
    }));
}

async function areaModels(locale: Locale, areas: readonly TransportArea[], m: Matcher) {
  const { presentation, sources, t } = await inputs(locale);
  return areas.flatMap((area) => {
    const facts = transportAreaFacts(served, area), labels = transportAreaSeriesLabels(presentation.messages, area), definitions = transportAreaSeries(area);
    const entityId = area === "georgia" ? GEORGIA_PLACE_ID : transportMapId(area);
    const prefix = area === "georgia" ? "total" : area;
    return transportAreaCrawlStates(area, facts).map((state) =>
      m.add(buildTransportWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin: ORIGIN, title: area }, presentation), (row) => {
        const series = definitions.find((candidate) => state.selectedIds.includes(candidate.id) && transportSeriesLabel(candidate, labels, t) === row.label);
        if (!series) return null;
        const [head, measure, group] = series.id.split(".");
        const part = group!.slice(prefix.length + 1);
        return { entityId, seriesId: `${head}.${measure}${part ? `.${part}` : ""}` };
      }));
  });
}

describe("transport parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`transport-${section}`), await topicModels(locale, section, m), m.match);
      });
    }
    it(`regions (${locale}): Georgia's and Adjara's area pages`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("transport-regions"), await areaModels(locale, ["georgia", "region_adjara"], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
    });
  }

  it("regions (en): every area page", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("transport-regions"), await areaModels("en", TRANSPORT_AREAS, m), m.match);
  });

  it("fails when a served figure is the stored, unrounded number rather than the one decimal the page prints", async () => {
    const regions = dataset("transport-regions");
    const stored = Number(rowOf("transport.registered.region_adjara", 2025)!.value);
    const facts = regions.facts.map((fact): TopicFact => (fact.year === 2025 && fact.entityId === ADJARA && fact.seriesId === "transport.registered" ? { ...fact, value: stored } : fact));
    const m = matcher();
    const models = await areaModels("en", ["region_adjara"], m);
    expect(() => expectWorkbookParity({ ...regions, facts }, models, m.match, [ADJARA])).toThrow(/2025: the page prints [\d.]+, region.adjara transport.registered serves/);
  });
});
