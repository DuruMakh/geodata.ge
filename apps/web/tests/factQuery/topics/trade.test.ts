// apps/web/tests/factQuery/topics/trade.test.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { parse } from "csv-parse/sync";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedTradeCompositionData, toClientTradeCompositionData } from "../../../lib/data/tradeComposition/importTradeComposition";
import { loadServedTradeDomesticData, toClientTradeDomesticData } from "../../../lib/data/tradeDomestic/importTradeDomestic";
import { loadServedTradeOverviewData, toClientTradeOverviewFact } from "../../../lib/data/tradeOverview/importTradeOverview";
import type { ClientTradeOverviewFact } from "../../../lib/data/tradeOverview/types";
import { loadServedTradePartnersData, toClientTradePartnersData, type ClientTradePartnersData } from "../../../lib/data/tradePartners/importTradePartners";
import { loadServedTradeProductsData, projectTradeProductsForPage, toClientTradeProductsData, type ClientTradeProductsData } from "../../../lib/data/tradeProducts/importTradeProducts";
import { PRODUCT_SOURCE_BLOCK } from "../../../lib/data/tradeProducts/types";
import { loadServedTradeServicesData, toClientTradeServicesData } from "../../../lib/data/tradeServices/importTradeServices";
import { GEORGIA_PLACE_ID } from "../../../lib/explorer/demographyAreas";
import { buildTradeOverviewModel } from "../../../lib/explorer/tradeOverview";
import { tradeOverviewCrawlStates } from "../../../lib/explorer/tradeOverviewState";
import { buildTradeOverviewWorkbookExportModel } from "../../../lib/explorer/tradeOverviewWorkbook";
import { buildTradePartnersModel } from "../../../lib/explorer/tradePartners";
import { tradePartnersCrawlStates, tradePartnersTotalId } from "../../../lib/explorer/tradePartnersState";
import { buildTradePartnersWorkbookModel } from "../../../lib/explorer/tradePartnersWorkbook";
import { buildTradeProductsModel } from "../../../lib/explorer/tradeProducts";
import { TRADE_PRODUCT_TOTAL_ID, tradeProductsCrawlStates } from "../../../lib/explorer/tradeProductsState";
import { buildTradeProductsWorkbookModel } from "../../../lib/explorer/tradeProductsWorkbook";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../../lib/explorer/workbookModel";
import { compare, type Comparison } from "../../../lib/factQuery/compare";
import { describeCoverage } from "../../../lib/factQuery/describeCoverage";
import { getSources } from "../../../lib/factQuery/getSources";
import { buildAllPublications } from "../../../lib/factQuery/publications";
import { TOPIC_PAGES } from "../../../lib/factQuery/topics/pages";
import { TOPIC_ADAPTERS } from "../../../lib/factQuery/topics/registry";
import { tradeTopicAdapter } from "../../../lib/factQuery/topics/trade";
import type { TopicDatasetBuild, TopicFact } from "../../../lib/factQuery/topics/types";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";
import { message } from "../../../lib/i18n/messages";
import { getPresentation } from "../../../lib/i18n/presentation.server";
import type { Locale, Presentation } from "../../../lib/i18n/types";
import { LIMITS, boundedToolResult } from "../../../lib/mcp/result";
import { createMcpServer } from "../../../lib/mcp/tools";
import { testSnapshot } from "../../helpers/factQuerySnapshot";
import { expectWorkbookParity, type ParityTarget } from "./parity";

const ORIGIN = "https://fiscal.ge";
const LOCALES = ["ka", "en"] as const satisfies readonly Locale[];
const TURKEY = "partner.1995-2025.792";
const WINE = "goods.hs4.2020-2025.2204";
const TRADE_DATASETS = ["trade-overview", "trade-partners", "trade-products", "trade-domestic-exports", "trade-services", "trade-composition"];

type CsvRow = Record<string, string>;
let builds: TopicDatasetBuild[];
const csv: Record<string, CsvRow[]> = {};
const dataset = (id: string) => builds.find((build) => build.page.datasetId === id)!;
const factOf = (id: string, seriesId: string, year: number) => dataset(id).facts.find((fact) => fact.seriesId === seriesId && fact.year === year);
const seriesOf = (id: string, seriesId: string) => dataset(id).series.find((entry) => entry.seriesId === seriesId);
const rowOf = (file: string, entityId: string | null, indicatorId: string, year: number) =>
  csv[file]!.find((row) => (entityId === null || row.entity_id === entityId) && row.indicator_id === indicatorId && Number(row.year) === year)!;
const registryIds = (row: CsvRow) => [...new Set((JSON.parse(row.source_refs!) as string[][]).map(([id]) => `source.${id!.replaceAll("-", "_")}`))];

beforeAll(async () => {
  const files = ["trade-overview-annual", "trade-partners-annual", "trade-products-annual", "trade-domestic-annual", "trade-services-annual", "trade-composition-annual"];
  const [built, ...texts] = await Promise.all([tradeTopicAdapter.build(), ...files.map((file) => readFile(path.resolve(process.cwd(), `../../data/imports/${file}.csv`)))]);
  builds = built;
  files.forEach((file, index) => { csv[file] = parse(texts[index]!, { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[]; });
}, 120_000);

describe("trade topic adapter", () => {
  it("is registered, reads the trade source archive and builds the six Trade pages, each Georgia's", () => {
    expect(TOPIC_ADAPTERS).toContain(tradeTopicAdapter);
    expect(tradeTopicAdapter).toMatchObject({ family: "trade", sourceArchive: ["trade"] });
    expect(builds.map((build) => build.page)).toEqual(TOPIC_PAGES.filter((page) => page.family === "trade"));
    expect(builds.map((build) => build.page.datasetId)).toEqual(TRADE_DATASETS);
    // Overview: 4 national measures. Partners: 4 measures × (Georgia + countries + 5 groups) with a value. Products: the
    // 1,192 HS4 products of 2020–2025, each in the flows it has (1,079 exported, 1,185 imported), and both national
    // flows. Domestic exports: 3 national, 2 × countries, products. Services: 4 national, 12 types and the countries in 4
    // measures. Composition: 10 goods groups and 7 economic categories in 2 flows, and both national flows.
    expect(builds.map((build) => [build.page.datasetId, build.entities.length, build.series.length])).toEqual([
      ["trade-overview", 1, 4], ["trade-partners", 1, 776], ["trade-products", 1, 2266], ["trade-domestic-exports", 1, 474], ["trade-services", 1, 517], ["trade-composition", 1, 36],
    ]);
    for (const build of builds) {
      expect(build.entities).toEqual([{ entityId: GEORGIA_PLACE_ID, entityType: "country", labelKa: "საქართველო", labelEn: "Georgia", parentEntityId: null }]);
      expect(build.breaks).toEqual([]);
      expect(new Set(build.series.map((series) => series.unit))).toEqual(new Set(["usd"]));
    }
  });

  it("serves the US dollars the pages carry: the Overview's reviewed amounts, the breakdowns' whole dollars", () => {
    // The Overview page reads the reviewed amounts as they are.
    const exports = rowOf("trade-overview-annual", null, "trade.exports", 2025);
    expect(factOf("trade-overview", "trade.exports", 2025)).toEqual({
      entityId: GEORGIA_PLACE_ID, seriesId: "trade.exports", year: 2025, value: Number(exports.value_usd), basis: "actual", status: "official", sourceIds: ["source.geostat_trade_ftrade_1995_2026"],
    });
    // Partners and Products receive whole dollars (largest remainder within each year's countries or products).
    const turkey = rowOf("trade-partners-annual", TURKEY, "trade.exports", 2024);
    const served = factOf("trade-partners", `trade.exports.${TURKEY}`, 2024)!;
    expect(Number.isInteger(served.value)).toBe(true);
    expect(Math.abs(served.value! - Number(turkey.value_usd))).toBeLessThan(1);
    expect(served).toMatchObject({ status: "official", sourceIds: ["source.geostat_trade_export_country_1995_2026"] });
    const wine = rowOf("trade-products-annual", WINE, "trade.exports", 2024);
    expect(Math.abs(factOf("trade-products", `trade.exports.${WINE}`, 2024)!.value! - Number(wine.value_usd))).toBeLessThan(1);
    expect(seriesOf("trade-partners", `trade.exports.${TURKEY}`)).toMatchObject({ labelKa: "თურქეთი", labelEn: "Türkiye", headingEn: "Exports · Countries", headingKa: "ექსპორტი · ქვეყნები", parentSeriesId: "trade.exports", isTotal: false });
    expect(seriesOf("trade-partners", "trade.exports")).toMatchObject({ labelEn: "Georgia total", headingEn: "Exports", parentSeriesId: null, isTotal: true });
    expect(seriesOf("trade-products", `trade.exports.${WINE}`)).toMatchObject({ labelEn: expect.stringMatching(/^Wine of fresh grapes.* · 2204$/), headingEn: "Exports", parentSeriesId: "trade.exports" });
    expect(seriesOf("trade-services", "trade.exports")).toMatchObject({ labelEn: "Services exports", headingEn: null, isTotal: true });
    expect(seriesOf("trade-composition", "trade.exports.trade.sitc1.0")).toMatchObject({ labelEn: "Food and live animals", headingEn: "Exports · Goods groups" });
    expect(seriesOf("trade-composition", "trade.imports.trade.bec1.7")).toMatchObject({ headingEn: "Imports · Economic categories" });
    expect(seriesOf("trade-domestic-exports", "trade.exports")).toMatchObject({ labelEn: "Total exports", isTotal: true });
    const unitNames = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" }).topics.units;
    expect(unitNames.usd).toEqual({ labelKa: "აშშ დოლარი", labelEn: "USD" });
  });

  it("marks total trade, balance and re-exports as Fiscal.ge's derivations, citing both flows' workbooks", () => {
    for (const [id, seriesId, year] of [["trade-overview", "trade.balance", 2025], ["trade-partners", `trade.turnover.${TURKEY}`, 2024], ["trade-domestic-exports", "trade.reexports", 2024], ["trade-services", "trade.balance", 2024]] as const) {
      expect(factOf(id, seriesId, year)?.status, `${id} ${seriesId}`).toBe("derived");
    }
    expect(factOf("trade-partners", `trade.balance.${TURKEY}`, 2024)!.sourceIds).toEqual(registryIds(rowOf("trade-partners-annual", TURKEY, "trade.balance", 2024)));
    expect(factOf("trade-partners", `trade.balance.${TURKEY}`, 2024)!.sourceIds).toEqual(["source.geostat_trade_export_country_1995_2026", "source.geostat_trade_import_country_1995_2026"]);
    expect(factOf("trade-domestic-exports", "trade.reexports", 2024)!.sourceIds).toEqual(["source.geostat_trade_ftrade_1995_2026", "source.geostat_trade_domestic_export_country_2014_2026"]);
    // Every served cell of the published flows is official; every derived one is a sum of two.
    for (const build of builds) for (const fact of build.facts.filter((entry) => entry.value !== null)) {
      const measure = fact.seriesId.split(".").slice(0, 2).join(".");
      expect(fact.status, `${build.page.datasetId} ${fact.seriesId}`).toBe(["trade.turnover", "trade.balance", "trade.reexports"].includes(measure) ? "derived" : "official");
    }
  });

  it("serves only what the pages show: HS4 products of 2020–2025, partner groups as series, no empty flow", () => {
    const products = dataset("trade-products");
    expect([...new Set(products.facts.map((fact) => fact.year))].sort()).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
    const productIds = products.series.filter((series) => !series.isTotal).map((series) => series.seriesId.split(".").slice(2).join("."));
    expect(productIds.every((id) => id.startsWith(`goods.hs4.${PRODUCT_SOURCE_BLOCK}.`))).toBe(true);
    expect(new Set(productIds).size).toBe(1192);
    // A product with no exports in any year is no export series (live horses are imported only).
    const blockRows = csv["trade-products-annual"]!.filter((row) => row.source_block === PRODUCT_SOURCE_BLOCK);
    const exported = new Set(blockRows.filter((row) => row.indicator_id === "trade.exports" && row.value_usd !== "").map((row) => row.entity_id));
    expect(products.series.filter((series) => series.seriesId.startsWith("trade.exports.goods")).length).toBe(exported.size);
    // Partners keep the five country groups as series, beside the countries.
    const groups = dataset("trade-partners").series.filter((series) => series.headingEn === "Exports · Country groups").map((series) => series.seriesId);
    expect(groups).toEqual(["group.eu", "group.cis", "group.bsec", "group.oecd", "group.guam"].map((group) => `trade.exports.${group}`).sort((a, b) => groups.indexOf(a) - groups.indexOf(b)));
    expect(groups).toHaveLength(5);
    // Services stop at 2024 and composition starts at 2000, as their pages do.
    expect([dataset("trade-services").facts.at(0)!.year, Math.max(...dataset("trade-services").facts.map((fact) => fact.year))]).toEqual([2020, 2024]);
    expect(Math.min(...dataset("trade-composition").facts.map((fact) => fact.year))).toBe(2000);
  });
});

describe("compare, sources and the large Products dataset", () => {
  let snapshot: FactQuerySnapshot;
  beforeAll(() => {
    snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-11-11T00:00:00.000Z" });
  });
  const comparison = (datasetId: string, seriesId: string, fromYear: number, toYear: number): Comparison => {
    const response = compare(snapshot, { target: { dataset: "topic", datasetId, seriesIds: [seriesId] }, fromYear, toYear, measure: "value" });
    if (response.kind !== "comparisons") throw new Error(JSON.stringify(response));
    return (response.data as { comparisons: Comparison[] }).comparisons[0]!;
  };

  it("gives wine exports an absolute and a percentage change in USD", () => {
    const wine = comparison("trade-products", `trade.exports.${WINE}`, 2020, 2025);
    const [from, to] = [factOf("trade-products", `trade.exports.${WINE}`, 2020)!.value!, factOf("trade-products", `trade.exports.${WINE}`, 2025)!.value!];
    expect(wine).toMatchObject({ unit: "usd", comparability: "comparable", percentagePointChange: null });
    expect(wine.absoluteChange).toBeCloseTo(to - from, 6);
    expect(wine.percentageChange).toBeCloseTo(((to - from) / from) * 100, 6);
  });

  it("cites the trade workbooks the values are read from, resolved through get_sources", () => {
    const products = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "trade-products")!;
    const cited = [...new Set(products.columns.sources.flat())].map((index) => snapshot.topics.sourceIds[index]!).sort();
    expect(cited).toEqual(["source.geostat_trade_export_product_by_4_digit_2015_2026", "source.geostat_trade_ftrade_1995_2026", "source.geostat_trade_import_product_by_4_digit_2015_2026"]);
    const all = [...new Set(snapshot.topics.datasets.filter((entry) => entry.page.family === "trade").flatMap((entry) => entry.columns.sources.flat()))].map((index) => snapshot.topics.sourceIds[index]!);
    expect(all).toHaveLength(17);
    const response = getSources(snapshot, { sourceIds: all, datasetId: "trade-partners" });
    if (response.kind !== "sources") throw new Error(JSON.stringify(response));
    const sources = (response.data as { sources: { sourceId: string; documents: { officialUrl: string; attributionEn: string | null; attributionKa: string | null }[] }[] }).sources;
    expect(sources.map((source) => source.sourceId).sort()).toEqual([...all].sort());
    for (const source of sources) expect(source.documents[0]).toMatchObject({ officialUrl: expect.stringMatching(/^https:\/\/www\.geostat\.ge\//), attributionEn: "Geostat", attributionKa: "საქსტატი" });
  });

  type Coverage = { series?: { seriesId: string; labelEn?: string }[]; seriesOmitted?: number; headings?: { headingEn: string | null; seriesCount: number }[]; bulkUrl?: string };
  const coverage = (input: Record<string, unknown>) => describeCoverage(snapshot, input);
  const CSV = "https://fiscal.ge/downloads/data/topics/trade-products.csv";

  it("describes Products within the catalogue limit: its totals, its headings, how many series it left out, and its CSV", () => {
    const response = coverage({ datasetId: "trade-products" });
    const data = (response as unknown as { data: Coverage }).data;
    expect(data.series?.map((entry) => entry.seriesId)).toEqual(["trade.exports", "trade.imports"]);
    expect(data.seriesOmitted).toBe(2264);
    expect(data.headings).toEqual([{ headingKa: "ექსპორტი", headingEn: "Exports", seriesCount: 1080 }, { headingKa: "იმპორტი", headingEn: "Imports", seriesCount: 1186 }]);
    expect(data.bulkUrl).toBe(CSV);
    expect(boundedToolResult(snapshot, response, "catalogue").isError).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(response), "utf8")).toBeLessThan(LIMITS.resultBytes);
  });

  it("finds wine among the products by name, in both languages", () => {
    for (const search of ["wine", "ღვინო"]) {
      const data = (coverage({ datasetId: "trade-products", search }) as unknown as { data: Coverage }).data;
      expect(data.series?.map((entry) => entry.seriesId), search).toEqual(expect.arrayContaining([`trade.exports.${WINE}`, `trade.imports.${WINE}`]));
      expect(data, search).not.toHaveProperty("seriesOmitted");
    }
  });

  it("lists Products in catalogue.json as describe_coverage does: totals, the omitted count and the CSV link", () => {
    const catalogue = JSON.parse(buildAllPublications(snapshot).find((file) => file.fileName === "catalogue.json")!.bytes.toString("utf8")) as { datasets: (Coverage & { datasetId: string; seriesOmittedNoteEn?: string })[] };
    expect(catalogue.datasets.map((entry) => entry.datasetId)).toEqual(expect.arrayContaining(TRADE_DATASETS));
    const entry = catalogue.datasets.find((dataset) => dataset.datasetId === "trade-products")!;
    expect(entry.series?.map((series) => series.seriesId)).toEqual(["trade.exports", "trade.imports"]);
    expect(entry).toMatchObject({ seriesOmitted: 2264, bulkUrl: CSV, seriesOmittedNoteEn: expect.stringContaining("2264") });
    expect(entry.headings?.map((heading) => heading.seriesCount)).toEqual([1080, 1186]);
    // A dataset short enough to list in full is unchanged.
    expect(catalogue.datasets.find((dataset) => dataset.datasetId === "trade-overview")).not.toHaveProperty("seriesOmitted");
  });

  it("refuses a whole-history query over 200 products with the dataset's CSV link", async () => {
    const products = snapshot.topics.datasets.find((entry) => entry.page.datasetId === "trade-products")!;
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "trade-test", version: "1.0.0" });
    await Promise.all([createMcpServer().connect(serverTransport), client.connect(clientTransport)]);
    try {
      const seriesIds = products.series.slice(0, 200).map((series) => series.seriesId);
      const refused = await client.callTool({ name: "query_indicators", arguments: { datasetId: "trade-products", seriesIds } });
      expect(refused.isError).toBe(true);
      const text = (refused.content as { text: string }[])[0]!.text;
      expect(text).toContain("result_too_large");
      expect(text).toContain(CSV);
      // One year of the same products fits.
      const narrowed = await client.callTool({ name: "query_indicators", arguments: { datasetId: "trade-products", seriesIds, years: [2025] } });
      expect(narrowed.isError).toBeFalsy();
    } finally { await client.close(); }
  });
});

// Parity: the cells each dataset serves are the cells the pages' own workbook models print, fed as the pages feed them
// (lib/pages/trade.tsx; components/trade/*'s useCrawlModels: Overview, Partners and Products their own tables, Domestic
// exports its overview, countries and products, Services its overview, types and countries, Composition SITC and BEC).
// The workbooks' Summary sheets print million or billion USD as a display scale: the served unit is USD, so each row is
// read back in USD by the scale its unit names. A row a flow prints only as dashes is not served (as the crawl tables
// omit it).

type Reader = (row: WorkbookReadableRow, index: number) => ParityTarget | null;
function matcher() {
  const readers = new Map<WorkbookExportModel, Map<WorkbookReadableRow, ParityTarget | null>>();
  return {
    add: (model: WorkbookExportModel, read: Reader, presentation: Presentation) => {
      const scale = model.readable.unitLabel === message(presentation.messages, "trade.unit.billion") ? 1e9 : model.readable.unitLabel === message(presentation.messages, "trade.unit.million") ? 1e6 : NaN;
      expect(scale, model.readable.unitLabel).not.toBeNaN();
      const targets = new Map<WorkbookReadableRow, ParityTarget | null>();
      const rows = model.readable.rows.flatMap((row, index) => {
        if (Object.values(row.valuesByYear).every((value) => value === null)) return [];
        const usd = { ...row, valuesByYear: Object.fromEntries(Object.entries(row.valuesByYear).map(([year, value]) => [year, value === null ? null : value * scale])) };
        targets.set(usd, read(row, index));
        return [usd];
      });
      const inUsd = { ...model, readable: { ...model.readable, rows } };
      readers.set(inUsd, targets);
      return inUsd;
    },
    match: (row: WorkbookReadableRow, model: WorkbookExportModel) => readers.get(model)?.get(row) ?? null,
  };
}
type Matcher = ReturnType<typeof matcher>;

const SCOPES = ["trade", "main", "format", "workbook"] as const;
/** A breakdown row is its own series, labelled as the row; a total row is its measure's national figure. */
function target(build: TopicDatasetBuild, locale: Locale, seriesId: string, row: WorkbookReadableRow, checkLabel: boolean): ParityTarget | null {
  const series = build.series.find((entry) => entry.seriesId === seriesId);
  if (checkLabel && (locale === "ka" ? series?.labelKa : series?.labelEn) !== row.label) return null;
  return { entityId: GEORGIA_PLACE_ID, seriesId };
}

function overviewModels(m: Matcher, build: TopicDatasetBuild, presentation: Presentation, facts: readonly ClientTradeOverviewFact[], dataset?: "services") {
  return tradeOverviewCrawlStates(facts).map((state) => {
    const ids = buildTradeOverviewModel(facts, state, presentation).selectedIds;
    return m.add(buildTradeOverviewWorkbookExportModel({ facts, state, sources: [], siteOrigin: ORIGIN, dataset }, presentation), (row, index) => target(build, presentation.locale, ids[index]!, row, true), presentation);
  });
}
function partnersModels(m: Matcher, build: TopicDatasetBuild, presentation: Presentation, data: ClientTradePartnersData) {
  const totalId = tradePartnersTotalId(data);
  return tradePartnersCrawlStates(data).map((state) => {
    const ids = buildTradePartnersModel(data, state, presentation).selectedIds;
    return m.add(buildTradePartnersWorkbookModel({ data, state, sources: [], siteOrigin: ORIGIN }, presentation), (row, index) =>
      ids[index] === totalId ? target(build, presentation.locale, state.measure, row, false) : target(build, presentation.locale, `${state.measure}.${ids[index]}`, row, true), presentation);
  });
}
function productsModels(m: Matcher, build: TopicDatasetBuild, presentation: Presentation, data: ClientTradeProductsData) {
  return tradeProductsCrawlStates(data).map((state) => {
    const ids = buildTradeProductsModel(data, state, presentation).selectedIds;
    return m.add(buildTradeProductsWorkbookModel({ data, state, sources: [], siteOrigin: ORIGIN }, presentation), (row, index) =>
      ids[index] === TRADE_PRODUCT_TOTAL_ID ? target(build, presentation.locale, state.measure, row, false) : target(build, presentation.locale, `${state.measure}.${ids[index]}`, row, true), presentation);
  });
}

/** Each page's workbook models, with the presentation its page builds (lib/pages/trade.tsx). */
async function pageModels(datasetId: string, locale: Locale, m: Matcher): Promise<WorkbookExportModel[]> {
  const build = dataset(datasetId);
  const [national, partners, products, domestic, services, composition] = await Promise.all([
    loadServedTradeOverviewData(), loadServedTradePartnersData(), loadServedTradeProductsData(), loadServedTradeDomesticData(), loadServedTradeServicesData(), loadServedTradeCompositionData(),
  ]);
  const plain = await getPresentation(locale, SCOPES, []);
  const withLabels = (labels: Record<string, string>) => ({ ...plain, englishLabels: { ...plain.englishLabels, ...labels } });
  switch (datasetId) {
    case "trade-overview":
      return overviewModels(m, build, plain, national.facts.map(toClientTradeOverviewFact));
    case "trade-partners": {
      const ids = partners.entities.map((entity) => entity.id);
      return partnersModels(m, build, await getPresentation(locale, SCOPES, ids, ids), toClientTradePartnersData(partners, national.facts));
    }
    case "trade-products": {
      const data = projectTradeProductsForPage(toClientTradeProductsData(products, national.facts, "", PRODUCT_SOURCE_BLOCK), locale);
      return productsModels(m, build, await getPresentation(locale, SCOPES, data.entities.map((entity) => entity.id)), data);
    }
    case "trade-domestic-exports": {
      const { englishLabels, ...data } = toClientTradeDomesticData(domestic, national.facts);
      const presentation = withLabels(locale === "en" ? englishLabels : Object.fromEntries(data.countries.entities.map((entity) => [entity.id, englishLabels[entity.id]!])));
      return [...overviewModels(m, build, presentation, data.national), ...partnersModels(m, build, presentation, data.countries), ...productsModels(m, build, presentation, projectTradeProductsForPage(data.products, locale))];
    }
    case "trade-services": {
      const { englishLabels, ...data } = toClientTradeServicesData(services);
      const presentation = withLabels(englishLabels);
      return [...overviewModels(m, build, presentation, data.national, "services"), ...partnersModels(m, build, presentation, data.types), ...partnersModels(m, build, presentation, data.countries)];
    }
    default: {
      const { englishLabels, ...data } = toClientTradeCompositionData(composition, national.facts);
      const presentation = withLabels(englishLabels);
      return [...partnersModels(m, build, presentation, data.sitc), ...partnersModels(m, build, presentation, data.bec)];
    }
  }
}

describe("trade parity with the pages' workbook models", () => {
  for (const locale of LOCALES) {
    for (const datasetId of TRADE_DATASETS) {
      it(`${datasetId} (${locale}): Georgia`, async () => {
        const m = matcher();
        expectWorkbookParity(dataset(datasetId), await pageModels(datasetId, locale, m), m.match);
      }, 60_000);
    }
  }

  it("fails when a served figure is the reviewed unrounded amount rather than the whole dollars the page carries", async () => {
    const partners = dataset("trade-partners");
    const row = csv["trade-partners-annual"]!.find((entry) => entry.indicator_id === "trade.exports" && entry.role === "detail" && entry.value_usd !== "" && Number(entry.value_usd) < 1e6 && Math.abs(Number(entry.value_usd) % 1 - 0.5) < 0.4)!;
    const seriesId = `trade.exports.${row.entity_id}`, year = Number(row.year);
    const facts = partners.facts.map((fact): TopicFact => (fact.seriesId === seriesId && fact.year === year ? { ...fact, value: Number(row.value_usd) } : fact));
    const m = matcher();
    const models = await pageModels("trade-partners", "en", m);
    expect(() => expectWorkbookParity({ ...partners, facts }, models, m.match)).toThrow(new RegExp(`${year}: the page prints [\\d.e+]+, country.georgia ${seriesId.replaceAll(".", "\\.")} serves`));
  }, 60_000);

  it("fails when a served figure is in the workbook's display scale, not USD", async () => {
    const overview = dataset("trade-overview");
    const facts = overview.facts.map((fact): TopicFact => (fact.seriesId === "trade.exports" && fact.year === 2025 ? { ...fact, value: fact.value! / 1e9 } : fact));
    const m = matcher();
    const models = await pageModels("trade-overview", "en", m);
    expect(() => expectWorkbookParity({ ...overview, facts }, models, m.match)).toThrow(/2025: the page prints [\d.e+]+, country.georgia trade.exports serves/);
  }, 60_000);
});
