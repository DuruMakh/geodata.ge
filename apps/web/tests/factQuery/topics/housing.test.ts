// apps/web/tests/factQuery/topics/housing.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedHousingData } from "../../../lib/data/housing/importHousing";
import { HOUSING_REGIONS, HOUSING_SOURCES, type HousingFact } from "../../../lib/data/housing/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { housingCrawlStates, housingSeriesLabel, housingTopicSeries, type HousingTopicId } from "../../../lib/explorer/housing";
import { HOUSING_AREAS, housingAreaCrawlStates, housingAreaSeries, housingMapId, type HousingArea } from "../../../lib/explorer/housingAreas";
import { housingAreaFacts, housingAreaSeriesLabels, housingLabels, housingPageFacts } from "../../../lib/explorer/housingPageData";
import { buildHousingWorkbookExportModel } from "../../../lib/explorer/housingWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { housingTopicAdapter } from "../../../lib/factQuery/topics/housing";
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
const RACHA = "region.racha_lechkhumi_kvemo_svaneti";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const SECTIONS = ["permits", "completed", "prices"] as const satisfies readonly HousingTopicId[];

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: HousingFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year);

beforeAll(async () => {
  [builds, { facts: served }, csv] = await Promise.all([
    housingTopicAdapter.build(), loadServedHousingData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/housing-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("housing topic adapter", () => {
  it("is registered, reads the housing source archive and builds the four Housing pages", () => {
    expect(TOPIC_ADAPTERS).toContain(housingTopicAdapter);
    expect(housingTopicAdapter).toMatchObject({ family: "housing", sourceArchive: ["housing"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "housing"));
    // Permits: all buildings and 17 types, by number and floor area; Completed has no holiday camps; Prices: the index's three rows and ten districts for flats and houses.
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([
      ["housing-permits", 1, 36], ["housing-completed", 1, 34], ["housing-prices", 1, 23], ["housing-regions", 12, 8],
    ]);
  });

  it("serves Georgia on the topic pages, and Georgia and the 11 regions, each its area page, on Regions", () => {
    for (const section of SECTIONS) expect(dataset(`housing-${section}`).entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    const regions = dataset("housing-regions").entities;
    expect(regions.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID, ...HOUSING_REGIONS.map((region) => region.replace("region_", "region."))]);
    expect(regions[0]).toEqual({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null });
    expect(regions.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
  });

  it("serves Geostat's published figures in each row's own unit: objects, m², the 2020 = 100 index and GEL per m²", () => {
    const permits = rowOf("housing.permits_count.total", 2024)!;
    expect(factOf("housing-permits", GEORGIA_PLACE_ID, "housing.permits_count.total", 2024)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "housing.permits_count.total", year: 2024, value: Number(permits.published_value), basis: "actual", status: "official", sourceIds: [permits.source_id],
    });
    const units = (id: string) => Object.fromEntries(dataset(id).series.map((series) => [series.seriesId, series.unit]));
    expect(units("housing-permits")).toMatchObject({ "housing.permits_count.type_hotels": "count", "housing.permits_area.type_hotels": "square_metres" });
    expect(units("housing-prices")).toMatchObject({ "housing.price_index.flats": "index_2020", "housing.price_flat.district_vake": "gel_per_square_metre" });
    // Floor area in square metres, as the workbook prints it (the chart's thousand m² is a display scale); the index to one decimal.
    expect(factOf("housing-completed", GEORGIA_PLACE_ID, "housing.completed_area.total", 2024)!.value).toBe(Number(rowOf("housing.completed_area.total", 2024)!.published_value));
    const index = rowOf("housing.price_index.total", 2024)!;
    expect(Number(index.value)).not.toBe(Number(index.published_value));
    expect(factOf("housing-prices", GEORGIA_PLACE_ID, "housing.price_index.total", 2024)!.value).toBe(Number(index.published_value));
    const adjara = rowOf("housing.permits_area.region_adjara_residential", 2024)!;
    expect(factOf("housing-regions", ADJARA, "housing.permits_area.residential", 2024)).toMatchObject({ value: Number(adjara.published_value), sourceIds: [adjara.source_id] });
    expect(factOf("housing-regions", GEORGIA_PLACE_ID, "housing.permits_count", 2024)!.value).toBe(Number(permits.published_value));
    const series = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);
    // A heading without the display unit the page adds to it: the served unit is the row's own.
    expect(series("housing-permits", "housing.permits_area.type_hotels")).toMatchObject({ labelEn: "Hotels", headingEn: "Floor area", isTotal: false, parentSeriesId: null });
    expect(series("housing-prices", "housing.price_house.district_vake")).toMatchObject({ labelEn: "Vake", headingEn: "Tbilisi new houses", headingKa: "თბილისი, ახალი კერძო სახლები" });
    expect(series("housing-regions", "housing.completed_area.residential")).toMatchObject({ labelEn: "Residential buildings", headingEn: "Completed buildings · Floor area", unit: "square_metres" });
    const unitNames = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units;
    expect([unitNames.count, unitNames.square_metres, unitNames.index_2020, unitNames.gel_per_square_metre]).toEqual([
      { labelKa: "რაოდენობა", labelEn: "number" }, { labelKa: "მ²", labelEn: "m²" }, { labelKa: "ინდექსი, 2020 = 100", labelEn: "index, 2020 = 100" }, { labelKa: "ლარი 1\u00a0მ²\u2011ზე", labelEn: "GEL per m²" },
    ]);
  });

  it("serves nothing the pages do not show, and a year Geostat left blank as missing", () => {
    // The regions' rows sit on the area pages only.
    for (const section of SECTIONS) expect(dataset(`housing-${section}`).series.map((series) => series.seriesId).filter((id) => id.includes("region_"))).toEqual([]);
    expect(dataset("housing-completed").series.map((series) => series.seriesId)).not.toContain("housing.completed_count.type_holiday_camps");
    // Geostat lists no completed kindergartens in 2009, nor Racha-Lechkhumi's completed homes in 2010: missing, never zero.
    expect(rowOf("housing.completed_count.type_preschool", 2009)).toBeUndefined();
    expect(factOf("housing-completed", GEORGIA_PLACE_ID, "housing.completed_count.type_preschool", 2009)).toMatchObject({ value: null, sourceIds: [] });
    expect(rowOf("housing.completed_count.region_racha_lechkhumi_kvemo_svaneti_residential", 2010)).toBeUndefined();
    expect(factOf("housing-regions", RACHA, "housing.completed_count.residential", 2010)).toMatchObject({ value: null, sourceIds: [] });
    expect(factOf("housing-regions", RACHA, "housing.completed_count", 2010)!.value).toBe(Number(rowOf("housing.completed_count.region_racha_lechkhumi_kvemo_svaneti", 2010)!.published_value));
    for (const build of builds) expect(build.breaks).toEqual([]);
  });
});

describe("compare on the housing datasets", () => {
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

  it("gives the price index and a district price an absolute and a percentage change", () => {
    const index = comparison("housing-prices", "housing.price_index.total", 2020, 2024);
    expect(index).toMatchObject({ unit: "index_2020", comparability: "comparable", percentagePointChange: null });
    expect(index.absoluteChange).toBeCloseTo(published("housing.price_index.total", 2024) - published("housing.price_index.total", 2020), 9);
    expect(index.percentageChange).not.toBeNull();
    const permits = comparison("housing-regions", "housing.permits_count", 2015, 2024, [ADJARA]);
    expect(permits).toMatchObject({ unit: "count", comparability: "comparable" });
    expect(permits.absoluteChange).toBe(published("housing.permits_count.region_adjara", 2024) - published("housing.permits_count.region_adjara", 2015));
  });

  it("resolves the cited Geostat workbooks through get_sources", () => {
    const prices = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "housing-prices")!;
    const cited = [...new Set(prices.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(["source.geostat_housing_price_index", "source.geostat_housing_tbilisi_prices"]);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "housing-prices", years: [prices.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual(cited);
    for (const source of sources) expect(source.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
    // Only the six workbooks the values are read from are cited, never the files kept for reference.
    const all = new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "housing").flatMap((entry) => entry.columns.sources.flat()).map((index) => snapshot.topics.sourceIds[index]!));
    expect([...all].sort()).toEqual(HOUSING_SOURCES.map((id) => `source.${id}`).sort());
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/housing.tsx, housing-area.tsx; components/housing/housing-explorer.tsx and housing-area-explorer.tsx's
// useCrawlModels). The Regions index draws a map and a list of the area pages' figures.

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
  const ids = ["georgia", ...HOUSING_REGIONS.map((region) => region.replace("region_", "region."))];
  const [presentation, sources] = await Promise.all([
    getPresentation(locale, ["housing", "regionalEconomies", "format", "main", "workbook"], ids, ids),
    loadSourcedWorkbookSources("housing", locale, (row) => HOUSING_SOURCES.includes(row.source_id)),
  ]);
  return { presentation, sources, t: (key: string) => message(presentation.messages, `housing.${key}`) };
}

async function topicModels(locale: Locale, section: HousingTopicId, m: Matcher, facts = served) {
  const { presentation, sources, t } = await inputs(locale);
  const pageFacts = housingPageFacts(facts, section), labels = housingLabels(presentation, section), title = t(`page.${section}.title`);
  const definitions = housingTopicSeries(section);
  return housingCrawlStates(section, pageFacts).map((state) =>
    m.add(buildHousingWorkbookExportModel({ section, facts: pageFacts, state, labels, sources, siteOrigin: ORIGIN, title }, presentation), (row) => {
      const series = definitions.find((candidate) => state.selectedIds.includes(candidate.id) && housingSeriesLabel(candidate, labels, t) === row.label);
      return series ? { entityId: GEORGIA_PLACE_ID, seriesId: series.id } : null;
    }));
}

async function areaModels(locale: Locale, areas: readonly HousingArea[], m: Matcher) {
  const { presentation, sources, t } = await inputs(locale);
  return areas.flatMap((area) => {
    const facts = housingAreaFacts(served, area), labels = housingAreaSeriesLabels(presentation.messages, area), definitions = housingAreaSeries(area);
    const entityId = area === "georgia" ? GEORGIA_PLACE_ID : housingMapId(area);
    return housingAreaCrawlStates(area, facts).map((state) =>
      m.add(buildHousingWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin: ORIGIN, title: area }, presentation), (row) => {
        const series = definitions.find((candidate) => state.selectedIds.includes(candidate.id) && housingSeriesLabel(candidate, labels, t) === row.label);
        if (!series) return null;
        const [prefix, measure] = series.id.split(".");
        return { entityId, seriesId: `${prefix}.${measure}${series.id.endsWith("residential") ? ".residential" : ""}` };
      }));
  });
}

describe("housing parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`housing-${section}`), await topicModels(locale, section, m), m.match);
      });
    }
    it(`regions (${locale}): Georgia's and Adjara's area pages`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("housing-regions"), await areaModels(locale, ["georgia", "region_adjara"], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
    });
  }

  it("regions (en): every area page", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("housing-regions"), await areaModels("en", HOUSING_AREAS, m), m.match);
  });

  it("fails when a served floor area is in thousand m², the chart's scale, not the m² the workbook prints", async () => {
    const permits = dataset("housing-permits");
    const facts = permits.facts.map((fact): TopicFact => (fact.year === 2024 && fact.seriesId === "housing.permits_area.total" ? { ...fact, value: fact.value! / 1_000 } : fact));
    const m = matcher();
    const models = await topicModels("en", "permits", m);
    expect(() => expectWorkbookParity({ ...permits, facts }, models, m.match)).toThrow(/2024: the page prints [\d.]+, country.georgia housing.permits_area.total serves/);
  });
});
