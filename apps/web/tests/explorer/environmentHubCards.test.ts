import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadEnvironmentFacts, toClientEnvironmentFact } from "../../lib/data/environment/importEnvironment";
import { ENVIRONMENT_SOURCES, type ClientEnvironmentFact } from "../../lib/data/environment/types";
import { environmentLabelKey, type EnvironmentState } from "../../lib/explorer/environment";
import { buildEnvironmentCityCards, buildEnvironmentHubCards } from "../../lib/explorer/environmentHubCards";
import { environmentHighestPm10 } from "../../lib/explorer/environmentCities";
import { buildEnvironmentWorkbookExportModel, type EnvironmentWorkbookPage } from "../../lib/explorer/environmentWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import { message } from "../../lib/i18n/messages";
import type { Locale, Presentation } from "../../lib/i18n/types";

let facts: ClientEnvironmentFact[];
beforeAll(async () => { facts = (await loadEnvironmentFacts()).map(toClientEnvironmentFact); });
const presentation = async (locale: Locale = "en"): Promise<Presentation> => ({ locale, englishLabels: {}, messages: await getMessages(locale, ["workbook", "format", "common", "environment"]) });
const SOURCES = ENVIRONMENT_SOURCES.map(sourceId => ({
  sourceId, years: Array.from({ length: 36 }, (_, i) => 1990 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-20",
  downloadHref: `/downloads/methodology/environment/files/${sourceId}.xlsx` as const,
}));

test("the hub has seven cards in page order, each following its page's headline series", async () => {
  const cards = buildEnvironmentHubCards(facts, await presentation());
  expect(cards.map(c => c.title)).toEqual(["Greenhouse gases", "Air pollution", "City air quality", "Temperature and rain", "Water", "Waste", "Forests"]);
  expect(cards[0].footer).toBe("2022 · 20.1 · 2000–2022");
  expect(cards[1].footer).toBe("2024 · 86.4 · 2013–2024");
  expect(cards[2].footer).toBe("2025 · 51 · 2019–2025");
  expect(cards[4].footer).toBe("2025 · 869.1 · 2015–2025");
  expect(cards[6].footer).toBe("2024 · 376,215 · 2010–2024");
  // Temperature and rain print 1990 and 1995, then 2000 on: the years between are gaps in the sparkline.
  expect(cards[3].series!.slice(0, 11).map(v => v === null)).toEqual([false, true, true, true, true, false, true, true, true, true, false]);
  expect(cards.every(c => c.href?.startsWith("/explorer/environment/") && !c.comingSoon)).toBe(true);
});

test("the most polluted station is Rustavi's Batumi Street in 2025", () => {
  expect(environmentHighestPm10(facts)).toEqual({ city: "rustavi", indicatorId: "environment.aq.pm10_avg.rustavi_d1", year: 2025, value: 51 });
});

test("nine city cards open the city pages; Zestaponi's follows its dust", async () => {
  const cards = buildEnvironmentCityCards(facts, await presentation());
  expect(cards).toHaveLength(9);
  expect(cards[0]).toMatchObject({ title: "Tbilisi", href: "/explorer/environment/air-quality/tbilisi", description: "Varketili · fine dust (PM10)" });
  expect(cards[0].footer).toBe("2025 · 31 · 2017–2025");
  expect(cards[4]).toMatchObject({ title: "Zestaponi", href: "/explorer/environment/air-quality/zestaponi", description: "Chikashua Street · dust (TSP)" });
  expect(cards.every(c => c.series!.length > 0)).toBe(true);
});

const workbook = async (input: EnvironmentWorkbookPage & { state: EnvironmentState }, locale: Locale = "en") => {
  const p = await presentation(locale);
  // The treatment levels are served but listed on no page, so they have no label.
  const labels = Object.fromEntries(facts.filter(f => !f.indicatorId.includes(".treatment_")).map(f => [f.indicatorId, message(p.messages, `environment.${environmentLabelKey(f.indicatorId)}`)]));
  return buildEnvironmentWorkbookExportModel({ ...input, facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels, title: "Title" }, p);
};

test("a negative decimal exports as published, with its decimals, citing only its source", async () => {
  const model = await workbook({ section: "greenhouse-gases", state: { mode: "table", range: { kind: "manual", start: 2020, end: 2022 }, selectedIds: ["environment.ghg.sector_land"] } });
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.readable.rows[0]).toMatchObject({ label: "Forests and land", kind: "item" });
  expect(model.readable.rows[0].valuesByYear[2022]).toBe(-5.8);
  expect(model.analysis.rows.at(-1)).toEqual([2022, "Forests and land", -5.8, "Official"]);
  expect(model.sources.map(s => s.title)).toEqual(["geostat_env_ghg"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/environment/files/geostat_env_ghg.xlsx");
  expect(model.filename).toMatch(/^fiscal-environment-greenhouse-gases-2020-2022/);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets.length).toBeGreaterThan(1);
});

test("a year without a value is an empty cell marked unavailable, never zero", async () => {
  const model = await workbook({ section: "climate", state: { mode: "table", range: { kind: "manual", start: 1990, end: 2000 }, selectedIds: ["environment.climate.temperature.georgia"] } });
  expect(model.readable.rows[0].valuesByYear[1992]).toBeNull();
  expect(model.analysis.rows.find(row => row[0] === 1992)).toEqual([1992, "Georgia — Yearly average temperature", null, "Not available"]);
});

test("a city and an area workbook name their station and area", async () => {
  const city = await workbook({ city: "rustavi", state: { mode: "table", range: { kind: "all" }, selectedIds: ["environment.aq.pm10_avg.rustavi_d1", "environment.aq.pm10_limit.rustavi"] } });
  expect(city.readable.rows.map(r => r.label)).toEqual(["Batumi Street — Fine dust PM10, yearly average", "Yearly limit — Fine dust PM10, yearly average"]);
  expect(city.filename).toMatch(/^fiscal-environment-air-quality-rustavi-/);
  const area = await workbook({ topic: "forests", area: "region_kakheti", state: { mode: "table", range: { kind: "all" }, selectedIds: ["environment.forest.timber_cut.region_kakheti"] } });
  expect(area.filename).toMatch(/^fiscal-environment-forests-kakheti-2010-2024/);
  expect(area.sources.map(s => s.title)).toEqual(["geostat_env_timber"]);
});
