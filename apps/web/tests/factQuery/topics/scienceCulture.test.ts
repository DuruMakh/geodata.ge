// apps/web/tests/factQuery/topics/scienceCulture.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedScienceCultureData } from "../../../lib/data/scienceCulture/importScienceCulture";
import { SCIENCE_CULTURE_INDICATORS, SCIENCE_CULTURE_REGIONS, SCIENCE_CULTURE_SOURCES, type ScienceCultureFact } from "../../../lib/data/scienceCulture/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { scienceCultureCrawlStates, scienceCultureSeriesLabel, scienceCultureTopicSeries, type ScienceCultureSeriesDefinition, type ScienceCultureTopicId } from "../../../lib/explorer/scienceCulture";
import { MUSEUM_AREAS, museumAreaCrawlStates, museumAreaSeries, museumMapId, type MuseumArea } from "../../../lib/explorer/scienceCultureMuseums";
import { museumAreaFacts, scienceCultureLabels, scienceCulturePageFacts } from "../../../lib/explorer/scienceCulturePageData";
import { buildScienceCultureWorkbookExportModel } from "../../../lib/explorer/scienceCultureWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import { scienceCultureTopicAdapter } from "../../../lib/factQuery/topics/scienceCulture";
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
const SECTIONS = ["research", "patents", "theatres"] as const satisfies readonly ScienceCultureTopicId[];
const AREA_IDS = [GEORGIA_PLACE_ID, ...SCIENCE_CULTURE_REGIONS.map((region) => region.replace("region_", "region."))];

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: ScienceCultureFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year);
const seriesOf = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);

beforeAll(async () => {
  [builds, { facts: served }, csv] = await Promise.all([
    scienceCultureTopicAdapter.build(), loadServedScienceCultureData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/science-culture-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("science-culture topic adapter", () => {
  it("is registered, reads the science-culture source archive and builds the four Science and culture pages", () => {
    expect(TOPIC_ADAPTERS).toContain(scienceCultureTopicAdapter);
    expect(scienceCultureTopicAdapter).toMatchObject({ family: "science-culture", sourceArchive: ["science-culture"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "science-culture"));
    // Research: 20 researcher rows, 4 R&D staff rows, institutions and spending; Patents: 4 headings of 3; Museums: 4 area
    // measures, Georgia's 6 museum types and 8 staff rows; Theatres: audience, 3 shows, 3 events, 5 theatres, seats, 8 staff.
    expect(builds.map((build) => [build.page.datasetId, build.titleEn, build.entities.length, build.series.length])).toEqual([
      ["science-culture-research", "Research", 1, 26], ["science-culture-patents", "Patents", 1, 12], ["science-culture-museums", "Museums", 12, 18], ["science-culture-theatres", "Theatres", 1, 21],
    ]);
  });

  it("serves Georgia on the topic pages, and Georgia and the 11 regions, each its area page, on Museums", () => {
    for (const section of SECTIONS) expect(dataset(`science-culture-${section}`).entities).toEqual([{ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null }]);
    const museums = dataset("science-culture-museums").entities;
    expect(museums.map((entity) => entity.entityId)).toEqual(AREA_IDS);
    expect(museums.find((entity) => entity.entityId === ADJARA)).toEqual({ entityId: ADJARA, entityType: "region", labelKa: "აჭარა", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
  });

  it("serves Geostat's figures in each row's own unit, an area measure as one series across the places", () => {
    const researchers = rowOf("science_culture.researchers.total", 2024)!;
    expect(factOf("science-culture-research", GEORGIA_PLACE_ID, "science_culture.researchers.total", 2024)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "science_culture.researchers.total", year: 2024, value: Number(researchers.published_value), basis: "actual", status: "official", sourceIds: [researchers.source_id],
    });
    const adjara = rowOf("science_culture.museum_visitors.region_adjara", 2024)!;
    expect(factOf("science-culture-museums", ADJARA, "science_culture.museum_visitors", 2024)).toMatchObject({ value: Number(adjara.published_value), sourceIds: [adjara.source_id] });
    expect(factOf("science-culture-museums", GEORGIA_PLACE_ID, "science_culture.museum_visitors", 2024)!.value).toBe(Number(rowOf("science_culture.museum_visitors.total", 2024)!.published_value));
    expect(factOf("science-culture-museums", GEORGIA_PLACE_ID, "science_culture.museums.type_art", 2024)!.value).toBe(Number(rowOf("science_culture.museums.type_art", 2024)!.published_value));
    const units = (id: string) => Object.fromEntries(dataset(id).series.map((series) => [series.seriesId, series.unit]));
    expect(units("science-culture-research")).toMatchObject({ "science_culture.researchers.total": "persons", "science_culture.institutions.total": "count", "science_culture.rd_spending.total": "gel_million" });
    expect(units("science-culture-museums")).toMatchObject({ "science_culture.museum_visitors": "persons_thousand", "science_culture.museum_tours": "count_thousand", "science_culture.museums": "count", "science_culture.museum_staff.total": "persons" });
    // Headings without the display unit the page adds after " · ": the served unit names it.
    expect(seriesOf("science-culture-museums", "science_culture.museum_visitors")).toMatchObject({ labelEn: "Visitors", headingEn: "Visitors", headingKa: "დამთვალიერებლები", isTotal: true, parentSeriesId: null });
    expect(seriesOf("science-culture-museums", "science_culture.museums.type_art")).toMatchObject({ labelEn: "Art", headingEn: "Museums", isTotal: false });
    expect(seriesOf("science-culture-research", "science_culture.rd_spending.total")).toMatchObject({ headingEn: "Spending", isTotal: false });
    expect(seriesOf("science-culture-patents", "science_culture.invention_applications.local")).toMatchObject({ headingEn: "Invention applications", isTotal: true });
    expect(testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units.count_thousand).toEqual({ labelKa: "ათასი", labelEn: "thousand" });
  });

  it("serves nothing the pages do not show, a blank year as missing and a published zero as zero", () => {
    // R&D staff by sex is reviewed but listed on no page.
    const servedIndicators = new Set([...SECTIONS.flatMap((section) => scienceCultureTopicSeries(section)), ...MUSEUM_AREAS.flatMap((area) => museumAreaSeries(area))].map((series) => series.id));
    expect(SCIENCE_CULTURE_INDICATORS.filter((id) => !servedIndicators.has(id))).toEqual(["science_culture.rd_staff.men", "science_culture.rd_staff.women"]);
    for (const build of builds) expect(build.series.map((series) => series.seriesId).filter((id) => /rd_staff\.(men|women)$/.test(id))).toEqual([]);
    // Museum types and staff are Georgia's alone: a region's page lists none.
    const regionSeries = new Set(dataset("science-culture-museums").facts.filter((fact) => fact.entityId === ADJARA).map((fact) => fact.seriesId));
    expect([...regionSeries].sort()).toEqual(["science_culture.museum_exhibitions", "science_culture.museum_tours", "science_culture.museum_visitors", "science_culture.museums"]);
    // Theatre events start in 2021: the years before are missing, never zero.
    expect(rowOf("science_culture.theatre_events.total", 2020)).toBeUndefined();
    expect(factOf("science-culture-theatres", GEORGIA_PLACE_ID, "science_culture.theatre_events.total", 2020)).toMatchObject({ value: null, sourceIds: [] });
    // Racha-Lechkhumi's group tours of 2005 are a published zero.
    expect(Number(rowOf("science_culture.museum_tours.region_racha_lechkhumi_kvemo_svaneti", 2005)!.published_value)).toBe(0);
    expect(factOf("science-culture-museums", "region.racha_lechkhumi_kvemo_svaneti", "science_culture.museum_tours", 2005)).toMatchObject({ value: 0, sourceIds: ["geostat_culture_museums_regions"] });
  });

  it("carries the 2021 audience change onto the theatre audience only", () => {
    expect(dataset("science-culture-theatres").breaks).toEqual([expect.objectContaining({ breakId: "theatre_audience_2021", referenceDate: "2021-01-01", seriesIds: ["science_culture.theatre_audience.total"] })]);
    for (const id of ["science-culture-research", "science-culture-patents", "science-culture-museums"]) expect(dataset(id).breaks).toEqual([]);
  });
});

describe("compare and sources on the science-culture datasets", () => {
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

  it("refuses the theatre audience across the 2021 change and compares on either side of it", () => {
    const across = comparison("science-culture-theatres", "science_culture.theatre_audience.total", 2020, 2021);
    expect(across).toMatchObject({ comparability: "not_comparable", absoluteChange: null, percentageChange: null });
    expect(across.caveatIds).toContain("topic_series_break");
    expect(across.reasonsEn[0]).toContain("2021-01-01: ");
    expect(comparison("science-culture-theatres", "science_culture.theatre_audience.total", 2010, 2020).comparability).toBe("comparable");
    const after = comparison("science-culture-theatres", "science_culture.theatre_audience.total", 2021, 2024);
    expect(after).toMatchObject({ comparability: "comparable", unit: "persons_thousand", percentagePointChange: null });
    expect(after.absoluteChange).toBeCloseTo(published("science_culture.theatre_audience.total", 2024) - published("science_culture.theatre_audience.total", 2021), 9);
    expect(comparison("science-culture-theatres", "science_culture.theatre_shows.total", 2015, 2024).comparability).toBe("comparable");
    const visitors = comparison("science-culture-museums", "science_culture.museum_visitors", 2015, 2024, [ADJARA]);
    expect(visitors).toMatchObject({ comparability: "comparable", unit: "persons_thousand" });
    expect(visitors.absoluteChange).toBeCloseTo(published("science_culture.museum_visitors.region_adjara", 2024) - published("science_culture.museum_visitors.region_adjara", 2015), 9);
  });

  it("cites exactly the 11 Geostat workbooks the values are read from, resolved through get_sources", () => {
    const cited = [...new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "science-culture").flatMap((entry) => entry.columns.sources.flat()))].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(SCIENCE_CULTURE_SOURCES.map((id) => `source.${id}`).sort());
    const museums = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "science-culture-museums")!;
    const own = [...new Set(museums.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort();
    const response = getSources(snapshot, { sourceIds: own, datasetId: "science-culture-museums", years: [museums.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual(own);
    for (const source of sources) expect(source.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/science-culture.tsx, science-culture-museum-area.tsx; components/science-culture/science-culture-explorer.tsx
// and museum-area-explorer.tsx's useCrawlModels). The Museums index draws a map and a list of the area pages' figures.

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
  const ids = ["georgia", ...SCIENCE_CULTURE_REGIONS.map((region) => region.replace("region_", "region."))];
  const [presentation, sources] = await Promise.all([
    getPresentation(locale, ["scienceCulture", "regionalEconomies", "format", "main", "workbook"], ids, ids),
    loadSourcedWorkbookSources("science-culture", locale, (row) => SCIENCE_CULTURE_SOURCES.includes(row.source_id)),
  ]);
  return { presentation, sources, t: (key: string) => message(presentation.messages, `scienceCulture.${key}`) };
}

/** A table's rows are its selected series in list order, each named by its full label (`Heading — Row`), which is checked. */
function rowsReader(model: WorkbookExportModel, definitions: readonly ScienceCultureSeriesDefinition[], selectedIds: readonly string[], label: (definition: ScienceCultureSeriesDefinition) => string, target: (id: string) => ParityTarget): Reader {
  const listed = definitions.filter((definition) => selectedIds.includes(definition.id));
  return (row) => {
    const definition = listed[model.readable.rows.indexOf(row)];
    return definition && label(definition) === row.label ? target(definition.id) : null;
  };
}

async function topicModels(locale: Locale, section: ScienceCultureTopicId, m: Matcher) {
  const { presentation, sources, t } = await inputs(locale);
  const definitions = scienceCultureTopicSeries(section);
  const facts = scienceCulturePageFacts(served, section), labels = scienceCultureLabels(presentation.messages, definitions), title = t(`page.${section}.title`);
  return scienceCultureCrawlStates(section, facts).map((state) => {
    const model = buildScienceCultureWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin: ORIGIN, title }, presentation);
    return m.add(model, rowsReader(model, definitions, state.selectedIds, (definition) => scienceCultureSeriesLabel(definition, labels, t), (id) => ({ entityId: GEORGIA_PLACE_ID, seriesId: id })));
  });
}

async function areaModels(locale: Locale, areas: readonly MuseumArea[], m: Matcher) {
  const { presentation, sources, t } = await inputs(locale);
  return areas.flatMap((area) => {
    const definitions = museumAreaSeries(area);
    const facts = museumAreaFacts(served, area), labels = scienceCultureLabels(presentation.messages, definitions);
    const entityId = area === "georgia" ? GEORGIA_PLACE_ID : museumMapId(area);
    // An area measure's row (Georgia's `.total`, a region's `.region_<id>`) is the measure's one served series.
    const servedId = (id: string) => {
      const [head, measure, group] = id.split(".");
      return group === "total" || group!.startsWith("region_") ? (measure === "museum_staff" ? id : `${head}.${measure}`) : id;
    };
    return museumAreaCrawlStates(area, facts).map((state) => {
      const model = buildScienceCultureWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin: ORIGIN, title: area }, presentation);
      return m.add(model, rowsReader(model, definitions, state.selectedIds, (definition) => scienceCultureSeriesLabel(definition, labels, t), (id) => ({ entityId, seriesId: servedId(id) })));
    });
  });
}

describe("science-culture parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`science-culture-${section}`), await topicModels(locale, section, m), m.match);
      });
    }
    it(`museums (${locale}): Georgia's and Adjara's area pages`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("science-culture-museums"), await areaModels(locale, ["georgia", "region_adjara"], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
    });
  }

  it("museums (en): every area page", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("science-culture-museums"), await areaModels("en", MUSEUM_AREAS, m), m.match);
  });

  it("fails when a served figure is not the one the page prints", async () => {
    const museums = dataset("science-culture-museums");
    const facts = museums.facts.map((fact): TopicFact => (fact.year === 2024 && fact.entityId === ADJARA && fact.seriesId === "science_culture.museum_visitors" ? { ...fact, value: fact.value! + 0.1 } : fact));
    const m = matcher();
    const models = await areaModels("en", ["region_adjara"], m);
    expect(() => expectWorkbookParity({ ...museums, facts }, models, m.match, [ADJARA])).toThrow(/2024: the page prints [\d.]+, region.adjara science_culture.museum_visitors serves/);
  });
});
