// apps/web/tests/factQuery/topics/wages.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedWagesData, toClientWagesFact } from "../../../lib/data/wages/importWages";
import { WAGES_REGIONS, type ClientWagesFact } from "../../../lib/data/wages/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { wagesCrawlStates, wagesViewSeries, type WagesSectionId } from "../../../lib/explorer/wages";
import { WAGES_LABEL_IDS, wagesLabels, wagesPageFacts, wagesRegionPageData } from "../../../lib/explorer/wagesPageData";
import { buildWagesWorkbookExportModel } from "../../../lib/explorer/wagesWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import { wagesTopicAdapter } from "../../../lib/factQuery/topics/wages";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale } from "../../../lib/i18n/types";
import { loadSourcedWorkbookSources } from "../../../lib/methodology/workbookSources";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ADJARA = "region.adjara";
const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const AVERAGE = "average_monthly_nominal_earnings";
const MEDIAN = "median_monthly_earnings";

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let facts: ClientWagesFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, dimension: string, groupId: string, sectorId: string, year: number) =>
  csv.find((row) => row.indicator_id === indicatorId && row.dimension === dimension && row.group_id === groupId && row.sector_id === sectorId && Number(row.year) === year)!;

beforeAll(async () => {
  let served: Awaited<ReturnType<typeof loadServedWagesData>>;
  [builds, served, csv] = await Promise.all([
    wagesTopicAdapter.build(), loadServedWagesData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/wages-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
  facts = served.facts.map(toClientWagesFact);
}, 60_000);

describe("wages topic adapter", () => {
  it("is registered, reads the wages source archive and builds the three Wages pages", () => {
    expect(TOPIC_ADAPTERS).toContain(wagesTopicAdapter);
    expect(wagesTopicAdapter).toMatchObject({ family: "wages", sourceArchive: ["wages"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "wages"));
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([["wages-overview", 1, 6], ["wages-industries", 1, 144], ["wages-regions", 12, 1]]);
  });

  it("serves Georgia on the Overview and Industries, and Georgia and the 11 regions on Regions", () => {
    for (const id of ["wages-overview", "wages-industries"]) expect(dataset(id).entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    const regions = dataset("wages-regions").entities;
    expect(regions.map((entity) => entity.entityId).sort()).toEqual([GEORGIA_PLACE_ID, ...WAGES_REGIONS].sort());
    expect(regions.find((entity) => entity.entityId === GEORGIA_PLACE_ID)).toMatchObject({ entityType: "country", labelEn: "Georgia", labelKa: "საქართველო", parentEntityId: null });
    expect(regions.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
  });

  it("serves Geostat's published figures in GEL a month: survey averages, the Revenue Service median as official", () => {
    const average = rowOf(AVERAGE, "national", "georgia", "total", 2025);
    expect(factOf("wages-overview", GEORGIA_PLACE_ID, AVERAGE, 2025)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: AVERAGE, year: 2025, value: Number(average.published_value), basis: "actual", status: "survey_estimate", sourceIds: [average.source_id],
    });
    const median = rowOf(MEDIAN, "national", "georgia", "total", 2025);
    expect(average.value).not.toBe(average.published_value);
    expect(factOf("wages-overview", GEORGIA_PLACE_ID, MEDIAN, 2025)).toMatchObject({ value: Number(median.published_value), status: "official", sourceIds: [median.source_id] });
    expect(dataset("wages-overview").series.find((series) => series.seriesId === `${AVERAGE}.women`)).toMatchObject({ unit: "gel", labelEn: "Women", parentSeriesId: AVERAGE, isTotal: false });
    const women = rowOf(AVERAGE, "sex", "women", "sector.f", 2024);
    expect(factOf("wages-industries", GEORGIA_PLACE_ID, `${AVERAGE}.women.sector.f`, 2024)).toMatchObject({ value: Number(women.published_value), sourceIds: [women.source_id] });
    expect(dataset("wages-industries").series.find((series) => series.seriesId === `${AVERAGE}.women.sector.f`)).toMatchObject({ headingEn: "Women", labelEn: "Construction" });
    expect(dataset("wages-industries").series.find((series) => series.seriesId === `${MEDIAN}.sector.c`)).toMatchObject({ headingEn: "Median wage, all employees", labelEn: "Manufacturing" });
    const adjara = rowOf(AVERAGE, "region", ADJARA, "total", 2025);
    expect(factOf("wages-regions", ADJARA, AVERAGE, 2025)).toMatchObject({ value: Number(adjara.published_value), status: "survey_estimate" });
    expect(dataset("wages-regions").series).toEqual([expect.objectContaining({ seriesId: AVERAGE, labelEn: "Average monthly wage", unit: "gel" })]);
    expect(testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units.gel).toEqual({ labelKa: "ლარი თვეში", labelEn: "GEL a month" });
  });

  it("serves nothing a page does not show: no row Geostat publishes only as unavailable, no years before a group's first", () => {
    const ids = dataset("wages-industries").series.map((series) => series.seriesId);
    expect(csv.filter((row) => row.group_id === "public" && row.sector_id === "sector.b").every((row) => row.value_status === "unavailable")).toBe(true);
    expect(ids).not.toContain(`${AVERAGE}.public.sector.b`);
    expect(ids).toContain(`${AVERAGE}.non_public.sector.b`);
    // The overview's women start after the average: missing, never zero.
    const first = Math.min(...csv.filter((row) => row.dimension === "sex" && row.group_id === "women" && row.sector_id === "total" && row.value).map((row) => Number(row.year)));
    expect(factOf("wages-overview", GEORGIA_PLACE_ID, `${AVERAGE}.women`, first - 1)).toMatchObject({ value: null, sourceIds: [] });
    expect(dataset("wages-overview").series.map((series) => series.seriesId).filter((id) => id.includes("business"))).toEqual([]);
    for (const build of builds) expect(build.breaks).toEqual([]);
  });

  it("compares a wage in GEL: an absolute and a percentage change", () => {
    const snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
    const response = compare(snapshot, { target: { dataset: "topic", datasetId: "wages-regions", seriesIds: [AVERAGE], entityIds: [ADJARA] }, fromYear: 2015, toYear: 2025, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    const [change] = (response.data as { comparisons: Comparison[] }).comparisons;
    expect(change).toMatchObject({ unit: "gel", comparability: "comparable", percentagePointChange: null });
    expect(change!.absoluteChange).toBeCloseTo(Number(rowOf(AVERAGE, "region", ADJARA, "total", 2025).published_value) - Number(rowOf(AVERAGE, "region", ADJARA, "total", 2015).published_value), 6);
    expect(change!.caveatIds).toContain("topic_survey_estimate");
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/wages.tsx; components/wages/wages-explorer.tsx's useCrawlModels). The Regions index draws a map and a
// list, no table: its figures are the region pages' latest ones.

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
const presentationOf = (locale: Locale) => getPresentation(locale, ["wages", "regionalEconomies", "format", "main", "workbook"], WAGES_LABEL_IDS, WAGES_REGIONS);

/** The served id contract: the indicator, then the group and the economic section when not Georgia's and all activities. */
const expectedId = (series: { indicatorId: string; groupId: string; sectorId: string }) =>
  [series.indicatorId, series.groupId === "georgia" ? null : series.groupId, series.sectorId === "total" ? null : series.sectorId].filter(Boolean).join(".");

let dashOnly: string[] = [];
/** A row the page prints only as dashes (Geostat's unavailable marker in every year) serves nothing: left out, and named. */
function withoutDashOnly(model: WorkbookExportModel): WorkbookExportModel {
  const kept = model.readable.rows.filter((row) => Object.values(row.valuesByYear).some((value) => value !== null));
  dashOnly.push(...model.readable.rows.filter((row) => !kept.includes(row)).map((row) => `${model.filename}: ${row.label}`));
  return { ...model, readable: { ...model.readable, rows: kept } };
}

async function nationalModels(locale: Locale, section: Exclude<WagesSectionId, "regions">, m: Matcher) {
  const [presentation, sources] = await Promise.all([presentationOf(locale), loadSourcedWorkbookSources("wages", locale)]);
  const shown = wagesPageFacts(facts, section), labels = wagesLabels(presentation);
  return wagesCrawlStates(section, shown).map((state) => {
    const ids = new Map(wagesViewSeries(section, state.view, shown).map((series) => [labels[series.id]!, expectedId(series)]));
    const model = withoutDashOnly(buildWagesWorkbookExportModel({ section, facts: shown, state, labels, sources, siteOrigin: ORIGIN }, presentation));
    return m.add(model, (row) => (ids.has(row.label) ? { entityId: GEORGIA_PLACE_ID, seriesId: ids.get(row.label)! } : null));
  });
}

async function regionModels(locale: Locale, regionIds: readonly string[], m: Matcher) {
  const [presentation, sources] = await Promise.all([presentationOf(locale), loadSourcedWorkbookSources("wages", locale)]);
  const shown = wagesPageFacts(facts, "regions");
  return regionIds.flatMap((regionId) => {
    const page = wagesRegionPageData(shown, presentation, regionId);
    return wagesCrawlStates("regions", page.facts).map((state) =>
      m.add(buildWagesWorkbookExportModel({ section: "regions", facts: page.facts, state, labels: page.labels, sources, siteOrigin: ORIGIN, regionId }, presentation), (row) =>
        row.label === page.labels[regionId] ? { entityId: regionId, seriesId: AVERAGE } : row.label === page.labels.average ? { entityId: GEORGIA_PLACE_ID, seriesId: AVERAGE } : null));
  });
}

describe("wages parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    it(`overview (${locale}): Georgia`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("wages-overview"), await nationalModels(locale, "overview", m), m.match);
    });
    it(`industries (${locale}): Georgia, every group`, async () => {
      const m = matcher();
      dashOnly = [];
      const models = await nationalModels(locale, "industries", m);
      expect(models).toHaveLength(8);
      expectWorkbookParity(dataset("wages-industries"), models, m.match);
      expect(dashOnly).toEqual([expect.stringMatching(/industries-public-.*: (Mining and quarrying|სამთომოპოვებითი მრეწველობა)/)]);
    });
    it(`regions (${locale}): Adjara's page`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("wages-regions"), await regionModels(locale, [ADJARA], m), m.match, [ADJARA]);
    });
  }

  it("regions (en): every region page, Georgia beside each", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("wages-regions"), await regionModels("en", WAGES_REGIONS, m), m.match);
  });

  it("fails when a served wage is the stored figure, not the published one the page prints", async () => {
    const overview = dataset("wages-overview");
    const average = rowOf(AVERAGE, "national", "georgia", "total", 2025);
    const facts = overview.facts.map((fact): TopicFact => (fact.year === 2025 && fact.seriesId === AVERAGE ? { ...fact, value: Number(average.value) } : fact));
    const m = matcher();
    const models = await nationalModels("en", "overview", m);
    expect(() => expectWorkbookParity({ ...overview, facts }, models, m.match)).toThrow(/2025: the page prints [\d.]+, country.georgia average_monthly_nominal_earnings serves/);
  });
});
