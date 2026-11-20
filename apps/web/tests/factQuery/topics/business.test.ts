// apps/web/tests/factQuery/topics/business.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedBusinessData } from "../../../lib/data/business/importBusiness";
import { BUSINESS_REGIONS, type BusinessFact } from "../../../lib/data/business/types";
import { businessCrawlStates, type BusinessTopicId } from "../../../lib/explorer/business";
import { BUSINESS_AREAS, businessAreaCrawlStates, businessMapId, type BusinessArea } from "../../../lib/explorer/businessAreas";
import { BUSINESS_AREA_LABEL_IDS, BUSINESS_SECTOR_LABEL_IDS, businessAreaFacts, businessAreaSeriesLabels, businessLabels, businessPageFacts } from "../../../lib/explorer/businessPageData";
import { buildBusinessWorkbookExportModel } from "../../../lib/explorer/businessWorkbook";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { businessTopicAdapter } from "../../../lib/factQuery/topics/business";
import { breaksOnServedSeries } from "../../../lib/factQuery/topics/collect";
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
const SECTIONS = ["sales", "jobs", "investment-profit", "firms"] as const satisfies readonly BusinessTopicId[];

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: BusinessFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year)!;

beforeAll(async () => {
  [builds, { facts: served }, csv] = await Promise.all([
    businessTopicAdapter.build(), loadServedBusinessData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/business-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("business topic adapter", () => {
  it("is registered, reads the business source archive and builds the five Business pages", () => {
    expect(TOPIC_ADAPTERS).toContain(businessTopicAdapter);
    expect(businessTopicAdapter).toMatchObject({ family: "business", sourceArchive: ["business"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "business"));
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([
      ["business-sales", 1, 18], ["business-jobs", 1, 18], ["business-investment-profit", 1, 54], ["business-firms", 1, 98], ["business-regions", 12, 8],
    ]);
  });

  it("serves Georgia on the topic pages, and Georgia and the 11 regions, each its area page, on Regions", () => {
    for (const section of SECTIONS) expect(dataset(`business-${section}`).entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    const regions = dataset("business-regions").entities;
    expect(regions.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID, ...BUSINESS_REGIONS.map((region) => region.replace("region_", "region."))]);
    expect(regions[0]).toEqual({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null });
    expect(regions.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
  });

  it("serves Geostat's published figures in each row's own unit: million GEL, persons, firms and %", () => {
    const sales = rowOf("business.turnover.total", 2024);
    expect(factOf("business-sales", GEORGIA_PLACE_ID, "business.turnover.total", 2024)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "business.turnover.total", year: 2024, value: Number(sales.published_value), basis: "actual", status: "official", sourceIds: [sales.source_id],
    });
    const units = (id: string) => Object.fromEntries(dataset(id).series.map((series) => [series.seriesId, series.unit]));
    expect(units("business-sales")["business.turnover.total"]).toBe("gel_million");
    expect(units("business-jobs")["business.employed.total"]).toBe("persons");
    expect(units("business-firms")).toMatchObject({ "business.births.total": "enterprises", "business.birth_rate.total": "percent" });
    expect(factOf("business-jobs", GEORGIA_PLACE_ID, "business.employed.size_small", 2020)!.value).toBe(Number(rowOf("business.employed.size_small", 2020).published_value));
    const adjara = rowOf("business.turnover.region_adjara", 2024);
    expect(factOf("business-regions", ADJARA, "business.turnover", 2024)).toMatchObject({ value: Number(adjara.published_value), sourceIds: [adjara.source_id] });
    expect(factOf("business-regions", GEORGIA_PLACE_ID, "business.turnover", 2024)!.value).toBe(Number(sales.published_value));
    // A part names its total, as the page's workbook does; a firm count's heading carries no display unit.
    expect(dataset("business-investment-profit").series.find((series) => series.seriesId === "business.profit.sector_f")).toMatchObject({
      labelEn: "Profit — Construction", parentSeriesId: "business.profit.total", headingEn: null, isTotal: false,
    });
    expect(dataset("business-firms").series.find((series) => series.seriesId === "business.death_rate.sector_c")).toMatchObject({ labelEn: "Closed firms — Manufacturing", headingEn: "Compared with active firms" });
    expect(dataset("business-regions").series.find((series) => series.seriesId === "business.employed")).toMatchObject({ labelEn: "Jobs", headingEn: "Jobs", unit: "persons" });
    expect(testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units.enterprises).toEqual({ labelKa: "საწარმო", labelEn: "firms" });
  });

  it("serves nothing the pages do not show, and a year Geostat left blank as missing", () => {
    const ids = builds.flatMap((build) => build.series.map((series) => series.seriesId));
    // The unknown activity's rates are not listed; the region rows sit on the area pages only; Abkhazeti AR and the unknown region have no page.
    expect(ids).not.toContain("business.birth_rate.sector_unknown");
    expect(ids).toContain("business.births.sector_unknown");
    expect(ids.filter((id) => id.includes("region_"))).toEqual([]);
    expect(dataset("business-regions").entities.map((entity) => entity.entityId).filter((id) => /abkhazeti|unknown/.test(id))).toEqual([]);
    expect(served.some((fact) => fact.indicatorId === "business.active.region_abkhazeti")).toBe(true);
    // Geostat publishes no section death rates for 2016 and 2019: missing, never zero.
    expect(csv.some((row) => row.indicator_id === "business.death_rate.sector_a" && row.year === "2016")).toBe(false);
    expect(factOf("business-firms", GEORGIA_PLACE_ID, "business.death_rate.sector_a", 2016)).toMatchObject({ value: null, sourceIds: [] });
    expect(factOf("business-firms", GEORGIA_PLACE_ID, "business.death_rate.total", 2016)!.value).toBe(Number(rowOf("business.death_rate.total", 2016).published_value));
  });

  it("carries the 2006 survey-scope break onto sales and jobs, and onto the area pages' measures", () => {
    const [entry] = dataset("business-sales").breaks;
    expect(entry).toMatchObject({ breakId: "survey_scope_2006", referenceDate: "2006-01-01" });
    expect(entry!.seriesIds.sort()).toEqual(dataset("business-sales").series.map((series) => series.seriesId).sort());
    expect(dataset("business-jobs").breaks.map((item) => item.breakId)).toEqual(["survey_scope_2006"]);
    for (const id of ["business-investment-profit", "business-firms"]) expect(dataset(id).breaks).toEqual([]);
    expect(dataset("business-regions").breaks).toEqual([expect.objectContaining({ breakId: "survey_scope_2006", seriesIds: ["business.turnover", "business.employed"] })]);
  });

  it("places a break on a served measure only when it names every area's indicator", () => {
    const members = new Map([["business.turnover", ["business.turnover.total", "business.turnover.region_adjara"]]]);
    const both = { breakId: "b", seriesIds: ["business.turnover.total", "business.turnover.region_adjara"], referenceDate: "2006-01-01", reasonEn: "r" };
    expect(breaksOnServedSeries([both], members)[0]!.seriesIds).toContain("business.turnover");
    expect(breaksOnServedSeries([{ ...both, seriesIds: ["business.loss.total"] }], members)[0]!.seriesIds).toEqual(["business.loss.total"]);
    expect(() => breaksOnServedSeries([{ ...both, seriesIds: ["business.turnover.total"] }], members)).toThrow(/names 1 of the 2 places of business.turnover/);
  });
});

describe("compare on the business datasets", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparison = (datasetId: string, seriesId: string, fromYear: number, toYear: number, entityIds?: string[]): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId], ...(entityIds ? { entityIds } : {}) }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };

  it("refuses sales across the 2006 survey-scope change and compares on either side of it", () => {
    const across = comparison("business-sales", "business.turnover.total", 2005, 2006);
    expect(across).toMatchObject({ comparability: "not_comparable", absoluteChange: null, percentageChange: null });
    expect(across.caveatIds).toContain("topic_series_break");
    expect(across.reasonsEn[0]).toContain("2006-01-01: ");
    expect(comparison("business-sales", "business.turnover.total", 2000, 2005).comparability).toBe("comparable");
    const after = comparison("business-sales", "business.turnover.total", 2006, 2024);
    expect(after).toMatchObject({ comparability: "comparable", unit: "gel_million", percentagePointChange: null });
    expect(after.absoluteChange).toBeCloseTo(Number(rowOf("business.turnover.total", 2024).published_value) - Number(rowOf("business.turnover.total", 2006).published_value), 6);
    expect(comparison("business-regions", "business.employed", 2005, 2006, [GEORGIA_PLACE_ID]).comparability).toBe("not_comparable");
    expect(comparison("business-regions", "business.employed", 2006, 2024, [ADJARA]).comparability).toBe("comparable");
    expect(comparison("business-firms", "business.births.total", 2014, 2024).comparability).toBe("comparable");
  });

  it("gives a firm birth rate a percentage-point change and no percentage change (R19)", () => {
    const rate = comparison("business-firms", "business.birth_rate.total", 2015, 2024);
    expect(rate).toMatchObject({ unit: "percent", comparability: "comparable", absoluteChange: null, percentageChange: null });
    expect(rate.percentagePointChange).toBeCloseTo(Number(rowOf("business.birth_rate.total", 2024).published_value) - Number(rowOf("business.birth_rate.total", 2015).published_value), 9);
  });

  it("resolves the cited Geostat workbooks through get_sources", () => {
    const sales = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "business-sales")!;
    const cited = [...new Set(sales.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!);
    expect(cited).toEqual(["source.geostat_business_turnover"]);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "business-sales", years: [sales.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const [source] = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(source).toMatchObject({ sourceId: "source.geostat_business_turnover" });
    expect(source!.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/business.tsx, business-regions.tsx; components/business/business-explorer.tsx and
// business-area-explorer.tsx's useCrawlModels). The Regions index draws a map and a list of the area pages' figures.

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
const presentationOf = (locale: Locale, ids: readonly string[]) => getPresentation(locale, ["business", "regionalEconomies", "format", "main", "workbook"], ids, ids);

/** A table's row by its label and, for a part, its total's label, among the table's own series. */
function rowReader(ids: readonly string[], labels: Readonly<Record<string, string>>, parentOf: (id: string) => string | undefined, target: (id: string) => ParityTarget): Reader {
  return (row) => {
    const id = ids.find((candidate) => labels[candidate] === row.label && (parentOf(candidate) === undefined ? row.parentLabel === null : labels[parentOf(candidate)!] === row.parentLabel));
    return id ? target(id) : null;
  };
}

async function topicModels(locale: Locale, section: BusinessTopicId, m: Matcher, facts = businessPageFacts(served, section)) {
  const [presentation, sources] = await Promise.all([presentationOf(locale, BUSINESS_SECTOR_LABEL_IDS), loadSourcedWorkbookSources("business", locale)]);
  const labels = businessLabels(presentation, section), title = message(presentation.messages, `business.page.${section}.title`);
  const parentOf = (id: string) => dataset(`business-${section}`).series.find((series) => series.seriesId === id)?.parentSeriesId ?? undefined;
  return businessCrawlStates(section, facts).map((state) =>
    m.add(buildBusinessWorkbookExportModel({ section, facts, state, labels, sources, siteOrigin: ORIGIN, title }, presentation),
      rowReader(state.selectedIds, labels, parentOf, (id) => ({ entityId: GEORGIA_PLACE_ID, seriesId: id }))));
}

async function areaModels(locale: Locale, areas: readonly BusinessArea[], m: Matcher) {
  const [presentation, sources] = await Promise.all([presentationOf(locale, BUSINESS_AREA_LABEL_IDS), loadSourcedWorkbookSources("business", locale)]);
  return areas.flatMap((area) => {
    const facts = businessAreaFacts(served, area), labels = businessAreaSeriesLabels(presentation.messages, area);
    const entityId = area === "georgia" ? GEORGIA_PLACE_ID : businessMapId(area);
    return businessAreaCrawlStates(area, facts).map((state) =>
      m.add(buildBusinessWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin: ORIGIN, title: area }, presentation),
        rowReader(state.selectedIds, labels, () => undefined, (id) => ({ entityId, seriesId: id.split(".").slice(0, 2).join(".") }))));
  });
}

describe("business parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`business-${section}`), await topicModels(locale, section, m), m.match);
      });
    }
    it(`regions (${locale}): Georgia's and Adjara's area pages`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("business-regions"), await areaModels(locale, ["georgia", "region_adjara"], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
    });
  }

  it("regions (en): every area page", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("business-regions"), await areaModels("en", BUSINESS_AREAS, m), m.match);
  });

  it("fails when a served amount is in GEL, not the million GEL the page prints", async () => {
    const sales = dataset("business-sales");
    const facts = sales.facts.map((fact): TopicFact => (fact.year === 2024 && fact.seriesId === "business.turnover.total" ? { ...fact, value: fact.value! * 1_000_000 } : fact));
    const m = matcher();
    const models = await topicModels("en", "sales", m);
    expect(() => expectWorkbookParity({ ...sales, facts }, models, m.match)).toThrow(/2024: the page prints [\d.]+, country.georgia business.turnover.total serves/);
  });
});
