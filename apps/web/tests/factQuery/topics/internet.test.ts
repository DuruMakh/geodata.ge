// apps/web/tests/factQuery/topics/internet.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedInternetData } from "../../../lib/data/internet/importInternet";
import { INTERNET_REGIONS, INTERNET_SOURCES, type InternetFact } from "../../../lib/data/internet/types";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { internetCrawlStates, internetSeriesLabel, internetTopicSeries, type InternetTopicId } from "../../../lib/explorer/internet";
import { INTERNET_AREAS, internetAreaCrawlStates, internetAreaSeries, internetMapId, type InternetArea } from "../../../lib/explorer/internetAreas";
import { internetAreaFacts, internetAreaSeriesLabels, internetLabels, internetPageFacts } from "../../../lib/explorer/internetPageData";
import { buildInternetWorkbookExportModel } from "../../../lib/explorer/internetWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { getSources } from "../../../lib/factQuery/getSources";
import { internetTopicAdapter } from "../../../lib/factQuery/topics/internet";
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
const SECTIONS = ["users", "online", "devices"] as const satisfies readonly InternetTopicId[];

type CsvRow = Record<string, string>;
let csv: CsvRow[];
let builds: TopicDatasetBuild[];
let served: InternetFact[];
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, entityId: string, seriesId: string, year: number) =>
  dataset(id).facts.find((fact) => fact.entityId === entityId && fact.seriesId === seriesId && fact.year === year);
const rowOf = (indicatorId: string, year: number) => csv.find((row) => row.indicator_id === indicatorId && Number(row.year) === year);
const seriesOf = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);

beforeAll(async () => {
  [builds, { facts: served }, csv] = await Promise.all([
    internetTopicAdapter.build(), loadServedInternetData(),
    readFile(path.resolve(process.cwd(), "../../data/imports/internet-annual.csv")).then((text) => parse(text, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]),
  ]);
}, 60_000);

describe("internet topic adapter", () => {
  it("is registered, reads the internet source archive and builds the four Internet pages", () => {
    expect(TOPIC_ADAPTERS).toContain(internetTopicAdapter);
    expect(internetTopicAdapter).toMatchObject({ family: "internet", sourceArchive: ["internet"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "internet"));
    // Homes: the place's own homes with internet and with a computer, and Georgia's towns and villages for each. Users: 9 + 9 + 8 groups;
    // Online: 8 groups, 9 activities, 4 public services; Devices: 9 groups under each of three headings.
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([
      ["internet-homes", 12, 6], ["internet-users", 1, 26], ["internet-online", 1, 21], ["internet-devices", 1, 27],
    ]);
  });

  it("serves Georgia on the topic pages, and Georgia and the 11 regions, each its area page, on Internet at home", () => {
    for (const section of SECTIONS) expect(dataset(`internet-${section}`).entities.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID]);
    const homes = dataset("internet-homes").entities;
    expect(homes.map((entity) => entity.entityId)).toEqual([GEORGIA_PLACE_ID, ...INTERNET_REGIONS.map((region) => region.replace("region_", "region."))]);
    expect(homes[0]).toEqual({ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null });
    expect(homes.find((entity) => entity.entityId === ADJARA)).toMatchObject({ entityType: "region", labelKa: "აჭარა", labelEn: "Adjara", parentEntityId: GEORGIA_PLACE_ID });
  });

  it("serves Geostat's shares to one decimal, as the pages print them, in per cent and as survey estimates", () => {
    const users = rowOf("internet.used_3m.total", 2024)!;
    expect(Number(users.value)).not.toBe(Number(users.published_value));
    expect(factOf("internet-users", GEORGIA_PLACE_ID, "internet.used_3m.total", 2024)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "internet.used_3m.total", year: 2024, value: Number(users.published_value), basis: "actual", status: "survey_estimate", sourceIds: [users.source_id],
    });
    const adjara = rowOf("internet.homes_internet.region_adjara", 2024)!;
    expect(factOf("internet-homes", ADJARA, "internet.homes_internet", 2024)).toMatchObject({ value: Number(adjara.published_value), sourceIds: [adjara.source_id] });
    expect(factOf("internet-homes", GEORGIA_PLACE_ID, "internet.homes_internet", 2024)!.value).toBe(Number(rowOf("internet.homes_internet.total", 2024)!.published_value));
    expect(factOf("internet-homes", GEORGIA_PLACE_ID, "internet.homes_computer.rural", 2024)!.value).toBe(Number(rowOf("internet.homes_computer.rural", 2024)!.published_value));
    for (const build of builds) expect(new Set(build.series.map((series) => series.unit))).toEqual(new Set(["percent"]));
    // The heading keeps who a share counts: the unit alone says only "%".
    expect(seriesOf("internet-users", "internet.daily.female")).toMatchObject({ labelEn: "Women", headingEn: "Online every day or almost every day · % of internet users aged 15+", isTotal: false, parentSeriesId: null });
    expect(seriesOf("internet-users", "internet.used_3m.total")).toMatchObject({ labelEn: "Everyone", labelKa: "ყველა", isTotal: true });
    expect(seriesOf("internet-online", "internet.activity_banking.total")).toMatchObject({ labelEn: "Internet banking", headingEn: "What internet users do online · % of users aged 15+", isTotal: false });
    // An area's own homes are named as a region's page names them; Georgia's towns and villages under their measure.
    expect(seriesOf("internet-homes", "internet.homes_computer")).toMatchObject({ labelEn: "With a computer", headingEn: "Share of homes · %", isTotal: true });
    expect(seriesOf("internet-homes", "internet.homes_internet.urban")).toMatchObject({ labelEn: "Towns", labelKa: "ქალაქი", headingEn: "Homes with internet · %", isTotal: false });
    expect(testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units.percent).toEqual({ labelKa: "%", labelEn: "%" });
  });

  it("serves nothing the pages do not show", () => {
    // The regions' rows sit on the area pages only, the towns' and villages' homes on Georgia's only, and no group but Everyone has an activity or public-service row.
    for (const section of SECTIONS) expect(dataset(`internet-${section}`).series.filter((series) => series.seriesId.includes("region_") || series.seriesId.includes("homes_"))).toEqual([]);
    expect(dataset("internet-homes").facts.filter((fact) => fact.entityId !== GEORGIA_PLACE_ID && /\.(urban|rural)$/.test(fact.seriesId))).toEqual([]);
    expect(dataset("internet-online").series.filter((series) => /\.(activity|egov)_/.test(series.seriesId) && !series.seriesId.endsWith(".total"))).toEqual([]);
    // People aged 15+ have no 6–14 row.
    expect(dataset("internet-users").series.map((series) => series.seriesId)).not.toContain("internet.daily.age_6_14");
    for (const build of builds) expect(build.breaks).toEqual([]);
  });
});

describe("compare and sources on the internet datasets", () => {
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

  it("gives a share a percentage-point change and no percentage change (R19)", () => {
    const users = comparison("internet-users", "internet.used_3m.total", 2016, 2024);
    expect(users).toMatchObject({ unit: "percent", comparability: "comparable", absoluteChange: null, percentageChange: null });
    expect(users.percentagePointChange).toBeCloseTo(published("internet.used_3m.total", 2024) - published("internet.used_3m.total", 2016), 9);
    const homes = comparison("internet-homes", "internet.homes_internet", 2016, 2024, [ADJARA]);
    expect(homes.percentagePointChange).toBeCloseTo(published("internet.homes_internet.region_adjara", 2024) - published("internet.homes_internet.region_adjara", 2016), 9);
  });

  it("cites exactly the ten Geostat tables the values are read from, resolved through get_sources", () => {
    const all = new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "internet").flatMap((entry) => entry.columns.sources.flat()).map((index) => snapshot.topics.sourceIds[index]!));
    expect([...all].sort()).toEqual(INTERNET_SOURCES.map((id) => `source.${id}`).sort());
    const homes = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "internet-homes")!;
    const cited = [...new Set(homes.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(["source.geostat_ict_homes_computer", "source.geostat_ict_homes_internet"]);
    const response = getSources(snapshot, { sourceIds: cited, datasetId: "internet-homes", years: [homes.lastYear] });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual(cited);
    for (const source of sources) expect(source.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed exactly as the pages feed
// them (lib/pages/internet.tsx, internet-area.tsx; components/internet/internet-explorer.tsx and internet-area-explorer.tsx's
// useCrawlModels). The Internet at home index draws a map and a list of the area pages' figures.

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
  const ids = ["georgia", ...INTERNET_REGIONS.map((region) => region.replace("region_", "region."))];
  const [presentation, sources] = await Promise.all([
    getPresentation(locale, ["internet", "regionalEconomies", "format", "main", "workbook"], ids, ids),
    loadSourcedWorkbookSources("internet", locale, (row) => INTERNET_SOURCES.includes(row.source_id)),
  ]);
  return { presentation, sources, t: (key: string) => message(presentation.messages, `internet.${key}`) };
}

async function topicModels(locale: Locale, section: InternetTopicId, m: Matcher, facts = served) {
  const { presentation, sources, t } = await inputs(locale);
  const pageFacts = internetPageFacts(facts, section), labels = internetLabels(presentation, section), title = t(`page.${section}.title`);
  const definitions = internetTopicSeries(section);
  return internetCrawlStates(section, pageFacts).map((state) =>
    m.add(buildInternetWorkbookExportModel({ section, facts: pageFacts, state, labels, sources, siteOrigin: ORIGIN, title }, presentation), (row) => {
      const series = definitions.find((candidate) => state.selectedIds.includes(candidate.id) && internetSeriesLabel(candidate, labels, t) === row.label);
      return series ? { entityId: GEORGIA_PLACE_ID, seriesId: series.id } : null;
    }));
}

async function areaModels(locale: Locale, areas: readonly InternetArea[], m: Matcher) {
  const { presentation, sources, t } = await inputs(locale);
  return areas.flatMap((area) => {
    const facts = internetAreaFacts(served, area), labels = internetAreaSeriesLabels(presentation.messages, area), definitions = internetAreaSeries(area);
    const entityId = area === "georgia" ? GEORGIA_PLACE_ID : internetMapId(area);
    return internetAreaCrawlStates(area, facts).map((state) =>
      m.add(buildInternetWorkbookExportModel({ area, facts, state, labels, sources, siteOrigin: ORIGIN, title: area }, presentation), (row) => {
        const series = definitions.find((candidate) => state.selectedIds.includes(candidate.id) && internetSeriesLabel(candidate, labels, t) === row.label);
        if (!series) return null;
        const [prefix, measure, group] = series.id.split(".");
        return { entityId, seriesId: group === "urban" || group === "rural" ? `${prefix}.${measure}.${group}` : `${prefix}.${measure}` };
      }));
  });
}

describe("internet parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const section of SECTIONS) {
      it(`${section} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(`internet-${section}`), await topicModels(locale, section, m), m.match);
      });
    }
    it(`homes (${locale}): Georgia's and Adjara's area pages`, async () => {
      const m = matcher();
      expectWorkbookParity(dataset("internet-homes"), await areaModels(locale, ["georgia", "region_adjara"], m), m.match, [GEORGIA_PLACE_ID, ADJARA]);
    });
  }

  it("homes (en): every area page", async () => {
    const m = matcher();
    expectWorkbookParity(dataset("internet-homes"), await areaModels("en", INTERNET_AREAS, m), m.match);
  });

  it("fails when a served share is the stored, unrounded number rather than the one decimal the page prints", async () => {
    const users = dataset("internet-users");
    const stored = Number(rowOf("internet.used_3m.total", 2024)!.value);
    const facts = users.facts.map((fact): TopicFact => (fact.year === 2024 && fact.seriesId === "internet.used_3m.total" ? { ...fact, value: stored } : fact));
    const m = matcher();
    const models = await topicModels("en", "users", m);
    expect(() => expectWorkbookParity({ ...users, facts }, models, m.match)).toThrow(/2024: the page prints [\d.]+, country.georgia internet.used_3m.total serves/);
  });
});
