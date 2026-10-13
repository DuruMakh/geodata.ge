import path from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadWagesFacts, toClientWagesFact } from "../../lib/data/wages/importWages";
import type { ClientWagesFact } from "../../lib/data/wages/types";
import { buildWagesHeatmap, buildWagesModel, changeWagesView, defaultWagesState, parseWagesHash, serializeWagesHash, wagesCoverage, wagesSummaryValues, wagesViewSeries, type WagesState } from "../../lib/explorer/wages";
import { message } from "../../lib/i18n/messages";
import { buildWagesHubCards } from "../../lib/explorer/wagesHubCards";
import { buildWagesWorkbookExportModel } from "../../lib/explorer/wagesWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { loadEnglishCatalogue } from "../../lib/i18n/catalogue.server";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";
import { loadReviewedSourceManifest } from "../../lib/methodology/sourceManifest";
import { projectWorkbookSources } from "../../lib/methodology/workbookSources";

let facts: ClientWagesFact[];
beforeAll(async () => { facts = (await loadWagesFacts()).map(toClientWagesFact); });

test("each page starts with only its reference selected and coverage taken from the facts", () => {
  expect(defaultWagesState("overview", facts)).toEqual({ mode: "line", range: { kind: "all" }, view: "main", selectedIds: ["average"] });
  const adjara = facts.filter(f => f.dimension !== "region" || f.groupId === "region.adjara");
  expect(defaultWagesState("regions", adjara).selectedIds).toEqual(["region.adjara"]);
  expect(wagesViewSeries("regions", "main", adjara).map(s => [s.id, s.reference])).toEqual([["region.adjara", true], ["average", false]]);
  expect(wagesCoverage("regions", "main", adjara)).toMatchObject({ min: 2010, max: 2025 });
  expect(defaultWagesState("industries", facts)).toMatchObject({ view: "georgia", selectedIds: ["total"] });
  expect(wagesCoverage("overview", "main", facts)).toMatchObject({ min: 1995, max: 2025 });
  expect(wagesCoverage("industries", "georgia", facts)).toMatchObject({ min: 2014, max: 2025 });
  expect(wagesCoverage("industries", "median", facts)).toMatchObject({ min: 2018, max: 2025 });
  // Women, men, public and non-public sit under the average; the median is its own row.
  expect(wagesViewSeries("overview", "main", facts).map(s => [s.id, s.parentId])).toEqual([["average", undefined], ["women", "average"], ["men", "average"], ["public", "average"], ["non_public", "average"], ["median", undefined]]);
  const model = buildWagesModel("overview", facts, { ...defaultWagesState("overview", facts), selectedIds: ["average", "women"] });
  expect(model.years[0]).toBe(1995);
  expect(model.selected.find(s => s.id === "women")!.valuesByYear[1998]).toBeNull();
  expect(model.selected.find(s => s.id === "women")!.valuesByYear[1999]).not.toBeNull();
});

test("industries list only the sections a group publishes, and public mining shows as unavailable", () => {
  const ids = (group: Parameters<typeof wagesViewSeries>[1]) => wagesViewSeries("industries", group, facts).map(s => s.id);
  expect(ids("georgia")).toHaveLength(20);
  expect(ids("business")).not.toContain("sector.k");
  expect(ids("business")).not.toContain("sector.o");
  expect(ids("public")).toContain("sector.b");
  const model = buildWagesModel("industries", facts, { ...defaultWagesState("industries", facts), view: "public", selectedIds: ["sector.b"] });
  expect(Object.values(model.selected[0].valuesByYear).every(value => value === null)).toBe(true);
  const heatmap = buildWagesHeatmap(model);
  expect(heatmap.rows.map(row => row.id)).toEqual(ids("public").filter(id => id !== "total"));
  expect(heatmap.years).toEqual(model.years);
});

test("URL state round-trips views, years and an explicitly empty selection", () => {
  const state: WagesState = { mode: "table", range: { kind: "manual", start: 2016, end: 2020 }, view: "women", selectedIds: ["total", "sector.p"] };
  expect(parseWagesHash(serializeWagesHash(state, "industries"), "industries", facts)).toEqual(state);
  const empty = { ...defaultWagesState("regions", facts), selectedIds: [] };
  const hash = serializeWagesHash(empty, "regions");
  expect(hash).not.toContain("tab=");
  expect(parseWagesHash(hash, "regions", facts).selectedIds).toEqual([]);
  // Links from when the overview had tabs still open the one list with their ticks kept.
  expect(parseWagesHash("tab=sex&sel=average,women,men", "overview", facts)).toMatchObject({ view: "main", selectedIds: ["average", "women", "men"] });
  expect(serializeWagesHash(defaultWagesState("overview", facts), "overview")).not.toContain("tab=");
  const switched = changeWagesView({ ...defaultWagesState("industries", facts), range: { kind: "manual", start: 2014, end: 2016 } }, "industries", "median", facts);
  expect(switched).toMatchObject({ view: "median", selectedIds: ["total"], range: { kind: "all" } });
});

test("the median keeps whole lari and the 2025 headline matches Geostat's release", () => {
  const model = buildWagesModel("overview", facts, { ...defaultWagesState("overview", facts), selectedIds: ["average", "median"] });
  expect(model.series.find(s => s.id === "average")!.endValue).toBe(2165.2);
  expect(model.series.find(s => s.id === "median")!).toMatchObject({ endValue: 1531, decimals: 0 });
  expect(model.series.find(s => s.id === "median")!.valuesByYear[2017]).toBeNull();
});

test("the hub has three cards in order with a national sparkline only on the overview", async () => {
  const presentation: Presentation = { locale: "en", englishLabels: {}, messages: await getMessages("en", ["wages", "common"]) };
  const cards = buildWagesHubCards(facts, presentation);
  expect(cards.map(card => card.href)).toEqual(["/explorer/wages/overview", "/explorer/wages/industries", "/explorer/wages/regions"]);
  expect(cards[0].series).toHaveLength(31);
  expect(cards[0].footer).toContain("2025");
  expect(cards.slice(1).every(card => card.series === null)).toBe(true);
});

test.each(["ka", "en"] as const)("the %s workbook keeps selected series, years, statuses and archived sources", async (locale: Locale) => {
  const root = path.resolve(process.cwd(), "../..");
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(root, "wages"), loadEnglishCatalogue(root)]);
  const presentation: Presentation = { locale, englishLabels: {}, messages: await getMessages(locale, ["wages", "workbook", "format"]) };
  const sources = manifest.filter(row => row.media_type.includes("spreadsheet")).map(row => ({ ...projectWorkbookSources([row], locale, catalogue.documents)[0], sourceId: row.source_id }));
  const model = buildWagesWorkbookExportModel({
    section: "industries", facts, labels: { total: "All activities", "sector.b": "Mining" }, sources, siteOrigin: "https://fiscal.ge",
    state: { mode: "table", view: "public", range: { kind: "manual", start: 2024, end: 2025 }, selectedIds: ["total", "sector.b"] },
  }, presentation);
  expect(model.readable.years).toEqual([2024, 2025]);
  expect(model.readable.rows.map(row => row.label)).toEqual(["All activities", "Mining"]);
  expect(model.analysis.rows).toHaveLength(4);
  expect(model.analysis.rows.filter(row => row[1] === "Mining").every(row => row[2] === null)).toBe(true);
  expect(new Set(model.analysis.rows.map(row => row[3])).size).toBe(2);
  expect(model.analysis.headers.join(" ")).not.toMatch(/source_cell|sheet|source_id/i);
  expect(model.sources.length).toBeGreaterThan(0);
  for (const source of model.sources) expect(source.absoluteUrl).toMatch(/^https:\/\/fiscal\.ge\/downloads\/methodology\/wages\/files\//);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
});

async function overviewWorkbook(locale: Locale, patch: Partial<Parameters<typeof buildWagesWorkbookExportModel>[0]>) {
  const presentation: Presentation = { locale, englishLabels: {}, messages: await getMessages(locale, ["wages", "workbook", "format"]) };
  return buildWagesWorkbookExportModel({
    section: "overview", facts, labels: { average: "Average", median: "Median" }, sources: [], siteOrigin: "https://fiscal.ge",
    state: { mode: "table", view: "main", range: { kind: "manual", start: 2022, end: 2022 }, selectedIds: ["average"] }, ...patch,
  }, presentation);
}

test("the Data sheet formats the amount column", async () => {
  const model = await overviewWorkbook("en", {});
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0.0" });
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  const amount = excel.worksheets[1].getCell("C2");
  expect(amount.value).toBe(1543);
  expect(amount.numFmt).toBe("#,##0.0");
});

test("a region workbook is named after its region", async () => {
  const state = { ...defaultWagesState("regions", facts), range: { kind: "manual" as const, start: 2024, end: 2025 } };
  const adjara = await overviewWorkbook("en", { section: "regions", state, regionId: "region.adjara" });
  const guria = await overviewWorkbook("en", { section: "regions", state, regionId: "region.guria" });
  expect(adjara.filename).toContain("adjara");
  expect(guria.filename).toContain("guria");
  expect(adjara.filename).not.toBe(guria.filename);
});

test("wages summaries take their years and activity count from the facts", async () => {
  const messages = await getMessages("en", ["wages"]);
  const text = (key: string, from: readonly ClientWagesFact[], extra: Record<string, string> = {}) => message(messages, key, { ...wagesSummaryValues(from), ...extra });
  const overview = text("wages.page.overview.summary", facts);
  expect(overview).toContain("since 1995");
  expect(overview).toContain("since 2018");
  const industries = text("wages.page.industries.summary", facts);
  expect(industries).toContain("19 economic activities since 2014");
  expect(industries).toContain("since 2018");
  expect(text("wages.regionSummary", facts, { region: "Adjara" })).toContain("Adjara since 2010");
  expect(text("wages.page.overview.summary", facts.filter(f => f.year >= 1996))).toContain("since 1996");
});

test("the wages region map ranks the eleven regions by their latest average wage, with buckets and the occupied overlays", async () => {
  const { buildWagesRegionMapModel } = await import("../../lib/explorer/wagesRegionMap");
  const model = buildWagesRegionMapModel(facts);
  const regional = facts.filter(fact => fact.dimension === "region" && fact.indicatorId === "average_monthly_nominal_earnings" && fact.value !== null);
  const year = Math.max(...regional.map(fact => fact.year));
  expect(model.year).toBe(year);
  expect(model.firstYear).toBe(Math.min(...regional.map(fact => fact.year)));
  expect(model.regions).toHaveLength(11);
  expect(model.regions.map(region => region.rank)).toEqual(Array.from({ length: 11 }, (_, index) => index + 1));
  const latest = regional.filter(fact => fact.year === year);
  expect(model.regions.map(region => region.value)).toEqual(latest.map(fact => fact.value!).sort((left, right) => right - left));
  expect(model.regions[0]!.regionId).toBe(latest.find(fact => fact.value === Math.max(...latest.map(item => item.value!)))!.groupId);
  expect(new Set(model.regions.map(region => region.pathD))).toHaveLength(11);
  expect(model.regions.every(region => region.bucket >= 0 && region.bucket <= 5)).toBe(true);
  expect(model.regions[0]!.bucket).toBe(5);
  expect(model.regions.at(-1)!.bucket).toBe(0);
  expect(model.occupiedAreas.map(area => area.key).sort()).toEqual(["abkhazia", "tskhinvali"]);
  expect([model.legendMin, model.legendMax]).toEqual([model.regions.at(-1)!.value, model.regions[0]!.value]);
});

// U18-10: the source note ends its sentence before the map-boundaries credit. U18-11: the Regions index is the map and
// the ranked list (DESIGN.md §31): no overview tiles repeating the Georgia average under the heading.
test("the wages Regions index is the map and list, its source note a full sentence", async () => {
  const { renderWagesRegionsIndexPage } = await import("../../lib/pages/wages-regions-index");
  const { renderPageMarkup } = await import("../helpers/render-localized");
  const html = renderPageMarkup("en", await renderWagesRegionsIndexPage("en"));
  expect(html).toContain("Source: Geostat · enterprise surveys · annual. Map boundaries");
  expect(html).not.toContain("Regional overview");
});
