import { beforeAll, expect, test } from "vitest";
import { loadInternetFacts, toClientInternetFact } from "../../lib/data/internet/importInternet";
import { INTERNET_GROUPS, INTERNET_REGIONS, INTERNET_SOURCES, type ClientInternetFact } from "../../lib/data/internet/types";
import { INK } from "../../lib/explorer/colors";
import {
  INTERNET_HUB_PATH, INTERNET_SECTIONS, buildInternetModel, changeInternetSelection, internetCoverage, internetDefaultSelection, internetPercent,
  internetSeriesColor, internetSeriesLabel, internetTopicSeries, parseInternetHash, serializeInternetHash,
} from "../../lib/explorer/internet";
import {
  INTERNET_AREAS, buildInternetAreaModel, changeInternetAreaSelection, internetAreaDefaultSelection, internetAreaHref, internetAreaOfMapId,
  internetAreaSelectionHash, internetAreaSeries, internetMapId, internetRegionHref, parseInternetAreaHash,
} from "../../lib/explorer/internetAreas";
import { buildInternetHubCards } from "../../lib/explorer/internetHubCards";
import { buildInternetRegionMapModel } from "../../lib/explorer/internetRegionMap";
import { buildInternetWorkbookExportModel } from "../../lib/explorer/internetWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";

let facts: ClientInternetFact[];
beforeAll(async () => { facts = (await loadInternetFacts()).map(toClientInternetFact); });
const span = (coverage: { min: number; max: number }) => [coverage.min, coverage.max];
const state = (selectedIds: string[], range: { kind: "all" } | { kind: "manual"; start: number; end: number } = { kind: "all" }) => ({ mode: "line" as const, range, selectedIds });
const groups = (measure: string, list: readonly string[] = INTERNET_GROUPS) => list.map(group => `internet.${measure}.${group}`);
const ADULTS = INTERNET_GROUPS.filter(group => group !== "age_6_14");

test("the hub lists the homes map and three topic pages", () => {
  expect(INTERNET_HUB_PATH).toBe("/explorer/internet");
  expect(INTERNET_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["homes", "/explorer/internet/homes", "common.internetHomes"],
    ["users", "/explorer/internet/users", "common.internetUsers"],
    ["online", "/explorer/internet/online", "common.internetOnline"],
    ["devices", "/explorer/internet/devices", "common.internetDevices"],
  ]);
});

test("each page starts on its default selection, with coverage from the facts", () => {
  expect(internetDefaultSelection("users")).toEqual(["internet.used_3m.total"]);
  expect(internetDefaultSelection("online")).toEqual(["internet.bought_online.total"]);
  expect(internetDefaultSelection("devices")).toEqual(["internet.own_mobile.total"]);
  expect(span(internetCoverage("users", facts, internetDefaultSelection("users")))).toEqual([2016, 2026]);
  expect(span(internetCoverage("devices", facts, ["internet.own_smartphone.male"]))).toEqual([2019, 2026]);
  expect(internetAreaDefaultSelection("region_guria")).toEqual(["internet.homes_internet.region_guria"]);
  expect(internetAreaDefaultSelection("georgia")).toEqual(["internet.homes_internet.total"]);
  expect(parseInternetAreaHash("", "region_guria", facts)).toEqual(state(["internet.homes_internet.region_guria"]));
  expect(span(buildInternetAreaModel("region_guria", facts, state(["internet.homes_internet.region_guria"])).range)).toEqual([2020, 2026]);
  expect(span(buildInternetAreaModel("georgia", facts, state(internetAreaDefaultSelection("georgia"))).range)).toEqual([2016, 2026]);
});

test("the lists have the expected rows under their headings, in order", () => {
  const users = internetTopicSeries("users");
  expect(users.map(s => s.id)).toEqual([...groups("used_3m"), ...groups("never_used"), ...groups("daily", ADULTS)]);
  expect(users).toHaveLength(26);
  expect(users.map(s => s.heading)).toEqual([...Array(9).fill("used_3m"), ...Array(9).fill("never_used"), ...Array(8).fill("daily")]);
  expect(users.filter(s => s.reference).map(s => s.id)).toEqual(["internet.used_3m.total", "internet.never_used.total", "internet.daily.total"]);
  const online = internetTopicSeries("online");
  expect(online.map(s => s.id)).toEqual([
    ...groups("bought_online", ADULTS),
    ...["social", "calls", "news", "email", "health", "goods_info", "jobs", "banking", "software"].map(a => `internet.activity_${a}.total`),
    ...["any", "info", "download_forms", "submit_forms"].map(k => `internet.egov_${k}.total`),
  ]);
  expect(online.map(s => s.heading)).toEqual([...Array(8).fill("bought_online"), ...Array(9).fill("activities"), ...Array(4).fill("egov")]);
  expect(online.filter(s => s.reference).map(s => s.id)).toEqual(["internet.bought_online.total"]);
  const devices = internetTopicSeries("devices");
  expect(devices.map(s => s.id)).toEqual([...groups("own_mobile"), ...groups("own_smartphone"), ...groups("computer_3m")]);
  expect(internetAreaSeries("georgia")).toEqual([
    { id: "internet.homes_internet.total", reference: true, heading: "homes_internet" },
    { id: "internet.homes_internet.urban", reference: false, heading: "homes_internet" },
    { id: "internet.homes_internet.rural", reference: false, heading: "homes_internet" },
    { id: "internet.homes_computer.total", reference: true, heading: "homes_computer" },
    { id: "internet.homes_computer.urban", reference: false, heading: "homes_computer" },
    { id: "internet.homes_computer.rural", reference: false, heading: "homes_computer" },
  ]);
  expect(internetAreaSeries("region_guria")).toEqual([
    { id: "internet.homes_internet.region_guria", reference: true, heading: "homes" },
    { id: "internet.homes_computer.region_guria", reference: true, heading: "homes" },
  ]);
  expect(INTERNET_AREAS).toEqual(["georgia", ...INTERNET_REGIONS]);
});

test("a topic page shows one heading at a time, and its years follow the heading", () => {
  const users = parseInternetHash("#sel=internet.used_3m.total,internet.never_used.urban", "users", facts);
  expect(users.selectedIds).toEqual(["internet.used_3m.total"]);
  const smartphones = parseInternetHash("#sel=internet.own_smartphone.total", "devices", facts);
  expect(smartphones.selectedIds).toEqual(["internet.own_smartphone.total"]);
  expect(span(buildInternetModel("devices", facts, smartphones).range)).toEqual([2019, 2026]);
  const ticked = changeInternetSelection("users", state(["internet.used_3m.total", "internet.used_3m.rural"]), ["internet.used_3m.total", "internet.used_3m.rural", "internet.daily.male"], facts);
  expect(ticked.selectedIds).toEqual(["internet.daily.male"]);
  const untouched = parseInternetHash("", "online", facts);
  expect(untouched.selectedIds).toEqual(["internet.bought_online.total"]);
  expect(parseInternetHash("#sel=", "users", facts).selectedIds).toEqual([]);
  expect(parseInternetHash(`#${serializeInternetHash(state(["internet.never_used.male"], { kind: "manual", start: 2018, end: 2022 }))}`, "users", facts))
    .toEqual(state(["internet.never_used.male"], { kind: "manual", start: 2018, end: 2022 }));
});

test("an area page mixes its rows, since every row is a share of homes", () => {
  const georgia = changeInternetAreaSelection("georgia", state(["internet.homes_internet.total"]), ["internet.homes_internet.total", "internet.homes_computer.rural"], facts);
  expect(georgia.selectedIds).toEqual(["internet.homes_internet.total", "internet.homes_computer.rural"]);
  expect(parseInternetAreaHash("#sel=internet.homes_internet.region_guria,internet.homes_computer.region_guria", "region_guria", facts).selectedIds)
    .toEqual(["internet.homes_internet.region_guria", "internet.homes_computer.region_guria"]);
});

test("a link to another area carries the selection moved to that area", () => {
  expect(internetAreaSelectionHash(["internet.homes_internet.urban", "internet.homes_computer.rural", "internet.homes_internet.total"], "region_guria"))
    .toBe("#sel=internet.homes_internet.region_guria%2Cinternet.homes_computer.region_guria");
  expect(internetAreaSelectionHash(["internet.homes_computer.region_guria"], "georgia")).toBe("#sel=internet.homes_computer.total");
  expect(internetAreaSelectionHash(["internet.homes_internet.region_tbilisi"], "region_guria")).toBe("");
  expect(internetAreaSelectionHash(["internet.homes_internet.region_tbilisi"], "georgia")).toBe("");
  expect(internetAreaSelectionHash([], "georgia")).toBe("#sel=");
});

test("a region surveyed from 2020 starts in 2020, even when the hash asks for earlier years", () => {
  const model = buildInternetAreaModel("region_guria", facts, state(["internet.homes_internet.region_guria"], { kind: "manual", start: 2016, end: 2026 }));
  const guria = model.series.find(s => s.id === "internet.homes_internet.region_guria")!;
  expect(Object.keys(guria.valuesByYear).map(Number)).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  expect(guria.valuesByYear[2026]).toBe(91.1);
  expect(parseInternetAreaHash("#start=2016&end=2026", "region_guria", facts).range).toEqual({ kind: "all" });
  expect(buildInternetAreaModel("region_imereti", facts, state(["internet.homes_internet.region_imereti"])).range.start).toBe(2016);
});

test("series outside the list name their heading where the list relies on it", () => {
  const labels = { "internet.never_used.urban": "Towns", "internet.used_3m.total": "Everyone", "internet.activity_banking.total": "Internet banking", "internet.homes_internet.total": "Georgia", "internet.homes_internet.region_guria": "With internet" };
  const t = (key: string) => ({ "heading.never_used": "Never used the internet · % of people aged 6+", "heading.used_3m": "Used the internet in the last 3 months · % of people aged 6+", "heading.homes_internet": "Homes with internet · %" } as Record<string, string>)[key] ?? key;
  expect(internetSeriesLabel({ id: "internet.never_used.urban", heading: "never_used" }, labels, t)).toBe("Towns — Never used the internet");
  expect(internetSeriesLabel({ id: "internet.used_3m.total", heading: "used_3m" }, labels, t)).toBe("Everyone — Used the internet in the last 3 months");
  expect(internetSeriesLabel({ id: "internet.activity_banking.total", heading: "activities" }, labels, t)).toBe("Internet banking");
  expect(internetSeriesLabel({ id: "internet.homes_internet.total", heading: "homes_internet" }, labels, t)).toBe("Georgia — Homes with internet");
  expect(internetSeriesLabel({ id: "internet.homes_internet.region_guria", heading: "homes" }, labels, t)).toBe("With internet");
  expect(internetPercent(93.3)).toBe("93.3%");
  expect(internetPercent(89)).toBe("89.0%");
});

test("each group wears one colour on every heading and page, Everyone in ink", () => {
  const color = (section: "users" | "online" | "devices", id: string) => buildInternetModel(section, facts, state([])).series.find(s => s.id === id)!.color;
  expect(color("users", "internet.used_3m.rural")).toBe(color("users", "internet.daily.rural"));
  expect(color("users", "internet.used_3m.rural")).toBe(color("devices", "internet.own_mobile.rural"));
  expect(color("online", "internet.bought_online.male")).toBe(color("devices", "internet.computer_3m.male"));
  expect(color("users", "internet.used_3m.total")).toBe(INK);
  expect(color("users", "internet.used_3m.urban")).not.toBe(color("users", "internet.used_3m.rural"));
  const online = buildInternetModel("online", facts, state([])).series;
  expect(new Set(online.filter(s => s.heading === "activities").map(s => s.color)).size).toBe(9);
  const georgia = buildInternetAreaModel("georgia", facts, state([])).series;
  const urban = georgia.find(s => s.id === "internet.homes_internet.urban")!;
  const computerUrban = georgia.find(s => s.id === "internet.homes_computer.urban")!;
  expect(urban.color).toBe(computerUrban.color);
  expect(urban.color).toBe(color("users", "internet.used_3m.urban"));
  expect([urban.stroke, computerUrban.stroke]).toEqual(["solid", "dashed"]);
  const guria = buildInternetAreaModel("region_guria", facts, state([])).series;
  expect(guria.map(s => [s.color, s.stroke])).toEqual([[INK, "solid"], [INK, "dashed"]]);
  expect(internetSeriesColor({ id: "internet.daily.total", reference: true, heading: "daily" }, 17)).toBe(INK);
});

test("area routes follow the homes index", () => {
  expect(internetAreaHref("georgia")).toBe("/explorer/internet/homes/georgia");
  expect(internetAreaHref("region_guria")).toBe("/explorer/internet/homes/guria");
  expect(internetMapId("region_guria")).toBe("region.guria");
  expect(internetAreaOfMapId("region.guria")).toBe("region_guria");
  expect(internetRegionHref("georgia")).toBe("/explorer/internet/homes/georgia");
});

test("the homes map colours each region by its 2026 share of homes with internet", () => {
  const map = buildInternetRegionMapModel(facts);
  expect(map.year).toBe(2026);
  expect(map.regions).toHaveLength(11);
  const top = [...map.regions].sort((a, b) => a.rank - b.rank)[0];
  expect(top.regionId).toBe("region.tbilisi");
});

const presentation = async (locale: Locale = "en"): Promise<Presentation> => ({ locale, englishLabels: {}, messages: await getMessages(locale, ["workbook", "format", "common", "internet"]) });
const SOURCES = INTERNET_SOURCES.map(sourceId => ({
  sourceId, years: Array.from({ length: 11 }, (_, i) => 2016 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-20",
  downloadHref: `/downloads/methodology/internet/files/${sourceId}.xlsx` as const,
}));

test("an area workbook leaves the years before a region's first survey blank and cites only its two tables", async () => {
  const ids = ["internet.homes_internet.region_guria", "internet.homes_computer.region_guria"];
  const model = buildInternetWorkbookExportModel({
    area: "region_guria", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { [ids[0]]: "With internet", [ids[1]]: "With a computer" }, title: "Title",
    state: { mode: "table", range: { kind: "manual", start: 2016, end: 2026 }, selectedIds: ids },
  }, await presentation());
  expect(model.filename).toBe("fiscal-internet-homes-guria-2020-2026-en.xlsx");
  expect(model.readable.unitLabel).toBe("%");
  expect(model.readable.numberFormat).toBe("0.0");
  expect(model.readable.rows.map(row => row.label)).toEqual(["With internet", "With a computer"]);
  expect(model.readable.rows[0].valuesByYear[2026]).toBe(91.1);
  expect(model.readable.rows[0].valuesByYear[2019]).toBeUndefined();
  expect(model.sources.map(s => s.title)).toEqual(["geostat_ict_homes_internet", "geostat_ict_homes_computer"]);
  expect(model.analysis.rows[0]).toEqual([2020, "With internet", facts.find(f => f.indicatorId === ids[0] && f.year === 2020)!.value, "Survey estimate"]);
  // Georgia's page reaches back to 2016; Guria has no row before 2020, so a mixed range keeps Guria's own years.
  const wide = buildInternetWorkbookExportModel({
    area: "georgia", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { "internet.homes_internet.urban": "Towns" }, title: "Title",
    state: { mode: "table", range: { kind: "all" }, selectedIds: ["internet.homes_internet.urban"] },
  }, await presentation("ka"));
  expect(wide.filename).toBe("fiscal-internet-homes-georgia-2016-2026.xlsx");
  expect(wide.readable.rows.map(row => row.label)).toEqual(["Towns — ინტერნეტით უზრუნველყოფილი შინამეურნეობები"]);
});

test("a users workbook names each group with its heading and cites only the table behind it", async () => {
  const ids = ["internet.used_3m.urban", "internet.used_3m.rural"];
  const model = buildInternetWorkbookExportModel({
    section: "users", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: { [ids[0]]: "Towns", [ids[1]]: "Villages" }, title: "Title",
    state: { mode: "table", range: { kind: "manual", start: 2016, end: 2026 }, selectedIds: ids },
  }, await presentation());
  expect(model.filename).toBe("fiscal-internet-users-2016-2026-en.xlsx");
  expect(model.readable.rows.map(row => row.label)).toEqual(["Towns — Used the internet in the last 3 months", "Villages — Used the internet in the last 3 months"]);
  expect(model.sources.map(s => s.title)).toEqual(["geostat_ict_last_internet_use"]);
  const empty = buildInternetWorkbookExportModel({ section: "users", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: {}, title: "Title", state: state([]) }, await presentation());
  expect(empty.readable.rows).toEqual([]); expect(empty.sources).toEqual([]);
});

test("the hub cards follow each page's default series", async () => {
  const base = await presentation();
  const cards = buildInternetHubCards(facts, { ...base, messages: { ...base.messages, ...await getMessages("en", ["groups"]) } });
  expect(cards.map(card => card.href)).toEqual(INTERNET_SECTIONS.map(section => section.href));
  expect(cards.map(card => card.title)).toEqual(["Internet at home", "Internet users", "Shopping and services online", "Phones and computers"]);
  expect(cards.map(card => card.footer)).toEqual(["2026 · 93.5% · 2016–2026", "2026 · 89.6% · 2016–2026", "2026 · 38.6% · 2016–2026", "2026 · 93.3% · 2016–2026"]);
  expect(cards.every(card => card.series?.length === 11 && card.seriesColor === INK)).toBe(true);
  // Phones and computers names the device its share counts; the other titles name theirs.
  expect(cards.map(card => card.latest?.caption ?? null)).toEqual([null, null, null, "Own a mobile phone"]);
});
