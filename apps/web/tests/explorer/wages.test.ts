import path from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadWagesFacts, toClientWagesFact } from "../../lib/data/wages/importWages";
import type { ClientWagesFact } from "../../lib/data/wages/types";
import { buildWagesHeatmap, buildWagesModel, changeWagesView, defaultWagesState, parseWagesHash, serializeWagesHash, wagesCoverage, wagesViewSeries, type WagesState } from "../../lib/explorer/wages";
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
  expect(defaultWagesState("overview", facts)).toEqual({ mode: "line", range: { kind: "all" }, view: "overview", selectedIds: ["average"] });
  expect(defaultWagesState("regions", facts).selectedIds).toEqual(["average"]);
  expect(defaultWagesState("industries", facts)).toMatchObject({ view: "georgia", selectedIds: ["total"] });
  expect(wagesCoverage("overview", "overview", facts)).toMatchObject({ min: 1995, max: 2025 });
  expect(wagesCoverage("overview", "sex", facts).min).toBe(1999);
  expect(wagesCoverage("regions", "main", facts).min).toBe(2010);
  expect(wagesCoverage("overview", "ownership", facts).min).toBe(2000);
  expect(wagesCoverage("industries", "georgia", facts)).toMatchObject({ min: 2014, max: 2025 });
  expect(wagesCoverage("industries", "median", facts)).toMatchObject({ min: 2018, max: 2025 });
  expect(wagesViewSeries("regions", "main", facts)).toHaveLength(12);
  expect(wagesViewSeries("overview", "sex", facts).map(s => s.id)).toEqual(["average", "women", "men"]);
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
  expect(parseWagesHash("tab=business_sector", "overview", facts).view).toBe("overview");
  expect(parseWagesHash("tab=unknown&sel=average,median", "overview", facts)).toMatchObject({ view: "overview", selectedIds: ["average", "median"] });
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
