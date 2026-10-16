import ExcelJS from "exceljs";
import { beforeAll, expect, test } from "vitest";
import { loadHousingFacts, toClientHousingFact } from "../../lib/data/housing/importHousing";
import { HOUSING_DISTRICTS, HOUSING_INDICATORS, HOUSING_REGIONS, HOUSING_SOURCES, HOUSING_TYPES, type ClientHousingFact } from "../../lib/data/housing/types";
import { INK, OTHER_COLOR } from "../../lib/explorer/colors";
import {
  HOUSING_HUB_PATH, HOUSING_SECTIONS, buildHousingModel, changeHousingSelection, housingCoverage, housingDefaultSelection, housingSeriesColor, housingTopicSeries,
  parseHousingHash, serializeHousingHash, type HousingTopicId,
} from "../../lib/explorer/housing";
import {
  HOUSING_AREAS, buildHousingAreaModel, housingAreaDefaultSelection, housingAreaHref, housingAreaOfMapId, housingAreaSelectionHash, housingAreaSeries,
  housingAreaSlug, housingMapId, housingRegionHref, parseHousingAreaHash,
} from "../../lib/explorer/housingAreas";
import { buildHousingHubCards } from "../../lib/explorer/housingHubCards";
import { buildHousingRegionMapModel } from "../../lib/explorer/housingRegionMap";
import { buildHousingWorkbookExportModel } from "../../lib/explorer/housingWorkbook";
import { serializeTopicHash } from "../../lib/explorer/topicSeries";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Presentation } from "../../lib/i18n/types";

let facts: ClientHousingFact[];
beforeAll(async () => { facts = (await loadHousingFacts()).map(toClientHousingFact); });
const span = (coverage: { min: number; max: number }) => [coverage.min, coverage.max];
const TOPICS: readonly HousingTopicId[] = ["permits", "completed", "prices"];
const state = (selectedIds: string[], range: { kind: "all" } | { kind: "manual"; start: number; end: number } = { kind: "all" }) => ({ mode: "line" as const, range, selectedIds });

test("the hub lists three topic pages and the regions page", () => {
  expect(HOUSING_HUB_PATH).toBe("/explorer/housing");
  expect(HOUSING_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["permits", "/explorer/housing/permits", "common.housingPermits"],
    ["completed", "/explorer/housing/completed", "common.housingCompleted"],
    ["prices", "/explorer/housing/prices", "common.housingPrices"],
    ["regions", "/explorer/housing/regions", "common.housingRegions"],
  ]);
});

test("each page starts on its default selection, with coverage from the facts", () => {
  expect(housingDefaultSelection("permits")).toEqual(["housing.permits_count.total"]);
  expect(housingDefaultSelection("completed")).toEqual(["housing.completed_count.total"]);
  expect(housingDefaultSelection("prices")).toEqual(["housing.price_index.total"]);
  expect(span(housingCoverage("permits", facts))).toEqual([2006, 2025]);
  expect(span(housingCoverage("prices", facts))).toEqual([2020, 2025]);
  expect(span(housingCoverage("prices", facts, ["housing.price_flat.district_vake"]))).toEqual([2021, 2025]);
  expect(housingAreaDefaultSelection("region_guria")).toEqual(["housing.permits_count.region_guria"]);
  expect(housingAreaDefaultSelection("georgia")).toEqual(["housing.permits_count.total"]);
});

test("the lists have the expected rows under their headings, in order", () => {
  const permits = housingTopicSeries("permits");
  expect(permits).toHaveLength(36);
  expect(permits[0]).toEqual({ id: "housing.permits_count.total", reference: true, heading: "count" });
  expect(permits.slice(0, 18).map(s => s.id)).toEqual(["total", ...HOUSING_TYPES.map(type => `type_${type}`)].map(group => `housing.permits_count.${group}`));
  expect(permits.slice(18).map(s => s.id)).toEqual(["total", ...HOUSING_TYPES.map(type => `type_${type}`)].map(group => `housing.permits_area.${group}`));
  expect(permits.map(s => s.heading)).toEqual([...Array(18).fill("count"), ...Array(18).fill("area")]);
  expect(permits.filter(s => s.reference).map(s => s.id)).toEqual(["housing.permits_count.total", "housing.permits_area.total"]);

  const completed = housingTopicSeries("completed");
  expect(completed).toHaveLength(34);
  expect(completed.some(s => s.id.endsWith("type_holiday_camps"))).toBe(false);
  expect(completed[0].id).toBe("housing.completed_count.total");
  expect(completed.map(s => s.heading)).toEqual([...Array(17).fill("count"), ...Array(17).fill("area")]);

  const prices = housingTopicSeries("prices");
  expect(prices).toHaveLength(23);
  expect(prices.map(s => [s.id, s.heading]).slice(0, 4)).toEqual([
    ["housing.price_index.total", "index"], ["housing.price_index.flats", "index"], ["housing.price_index.houses", "index"], ["housing.price_flat.district_gldani", "flats"],
  ]);
  expect(prices.slice(3, 13).map(s => s.id)).toEqual(HOUSING_DISTRICTS.map(d => `housing.price_flat.district_${d}`));
  expect(prices.slice(13).map(s => [s.id, s.heading])).toEqual(HOUSING_DISTRICTS.map(d => [`housing.price_house.district_${d}`, "houses"]));
  expect(prices.filter(s => s.reference).map(s => s.id)).toEqual(["housing.price_index.total"]);

  // Every listed row is a served indicator.
  for (const section of TOPICS) for (const s of housingTopicSeries(section)) expect(HOUSING_INDICATORS).toContain(s.id);
});

test("an area lists its homes and all buildings, completed and permitted, as counts then floor area", () => {
  for (const area of HOUSING_AREAS) {
    const series = housingAreaSeries(area);
    expect(series).toHaveLength(8);
    expect(series.map(s => s.heading)).toEqual([...Array(4).fill("count"), ...Array(4).fill("area")]);
    for (const s of series) expect(HOUSING_INDICATORS).toContain(s.id);
  }
  expect(housingAreaSeries("region_guria").map(s => s.id)).toEqual([
    "housing.permits_count.region_guria", "housing.permits_count.region_guria_residential", "housing.completed_count.region_guria", "housing.completed_count.region_guria_residential",
    "housing.permits_area.region_guria", "housing.permits_area.region_guria_residential", "housing.completed_area.region_guria", "housing.completed_area.region_guria_residential",
  ]);
  expect(housingAreaSeries("georgia").slice(0, 4).map(s => s.id)).toEqual([
    "housing.permits_count.total", "housing.permits_count.type_residential", "housing.completed_count.total", "housing.completed_count.type_residential",
  ]);
  expect(housingAreaSeries("georgia").filter(s => s.reference).map(s => s.id)).toEqual(["housing.permits_count.total", "housing.permits_area.total"]);
});

test("a link mixing units keeps the first row in list order, with the years clamped to its coverage (Review Focus 2)", () => {
  const mixed = (...ids: string[]) => `#sel=${ids.join(",")}`;
  expect(parseHousingHash(mixed("housing.permits_count.total", "housing.permits_area.total"), "permits", facts).selectedIds).toEqual(["housing.permits_count.total"]);
  expect(parseHousingHash(mixed("housing.permits_area.total", "housing.permits_count.total"), "permits", facts).selectedIds).toEqual(["housing.permits_count.total"]);
  // The index is listed before the districts, so it wins whichever comes first in the link, and its years are 2020-2025.
  for (const ids of [["housing.price_index.total", "housing.price_flat.district_vake"], ["housing.price_flat.district_vake", "housing.price_index.total"]]) {
    const parsed = parseHousingHash(`${mixed(...ids)}&start=2020&end=2025`, "prices", facts);
    expect(parsed.selectedIds).toEqual(["housing.price_index.total"]);
    expect(parsed.range).toEqual({ kind: "all" });
    expect(housingCoverage("prices", facts, parsed.selectedIds)).toMatchObject({ min: 2020, max: 2025 });
  }
  // A district-only link clamps the years to the districts' 2021-2025.
  const districts = parseHousingHash("#sel=housing.price_flat.district_vake&start=2020&end=2023", "prices", facts);
  expect(districts.selectedIds).toEqual(["housing.price_flat.district_vake"]);
  expect(districts.range).toEqual({ kind: "manual", start: 2021, end: 2023 });
  expect(parseHousingHash("#sel=housing.price_flat.district_vake&start=2020&end=2025", "prices", facts).range).toEqual({ kind: "all" });
  expect(buildHousingModel("prices", facts, districts).years).toEqual([2021, 2022, 2023]);
  // The default applies without a selection in the hash, and an explicit empty selection stays empty.
  expect(parseHousingHash("", "permits", facts).selectedIds).toEqual(["housing.permits_count.total"]);
  const empty = state([]);
  expect(parseHousingHash(`#${serializeHousingHash(empty)}`, "permits", facts)).toEqual(empty);
  expect(new URLSearchParams(serializeHousingHash(empty)).has("tab")).toBe(false);
  expect(serializeHousingHash(empty)).toBe(serializeTopicHash(empty));
});

test("ticking a row of another unit replaces the selection, and the years stay clamped to the new unit", () => {
  const prices = housingTopicSeries("prices");
  const districts = state(["housing.price_flat.district_vake", "housing.price_house.district_vake"], { kind: "manual", start: 2021, end: 2024 });
  expect(changeHousingSelection(districts, prices, [...districts.selectedIds, "housing.price_index.flats"], facts))
    .toEqual({ ...districts, selectedIds: ["housing.price_index.flats"] });
  const index = state(["housing.price_index.total"], { kind: "manual", start: 2020, end: 2024 });
  expect(changeHousingSelection(index, prices, [...index.selectedIds, "housing.price_flat.district_vake"], facts))
    .toEqual({ ...index, selectedIds: ["housing.price_flat.district_vake"], range: { kind: "manual", start: 2021, end: 2024 } });
  // Within one unit a tick adds.
  expect(changeHousingSelection(index, prices, [...index.selectedIds, "housing.price_index.flats"], facts).selectedIds).toEqual(["housing.price_index.total", "housing.price_index.flats"]);
  // Area page: ticking floor area replaces the counts.
  const permits = housingTopicSeries("permits");
  expect(changeHousingSelection(state(["housing.permits_count.total"]), permits, ["housing.permits_count.total", "housing.permits_area.total"], facts).selectedIds).toEqual(["housing.permits_area.total"]);
});

test("a type Geostat did not report in a year is null in the model, never zero (Review Focus 1)", () => {
  const model = buildHousingModel("permits", facts, state(["housing.permits_count.total", "housing.permits_count.type_preschool"]));
  const preschool = model.selected.find(s => s.id === "housing.permits_count.type_preschool")!;
  const total = model.selected.find(s => s.id === "housing.permits_count.total")!;
  expect(preschool.valuesByYear[2008]).toBeNull();
  expect(total.valuesByYear[2008]).not.toBeNull();
  expect(model.unit).toBe("count");
  expect(model.years[0]).toBe(2006);
  expect(model.years.at(-1)).toBe(2025);
  expect(total.valuesByYear[2025]).toBe(11578);
  expect(total.endValue).toBe(11578);
  expect(buildHousingModel("permits", facts, state(["housing.permits_area.total"])).unit).toBe("area");
  expect(buildHousingModel("prices", facts, state(["housing.price_index.total"])).selected[0].valuesByYear[2025]).toBe(159.4);
  expect(buildHousingModel("prices", facts, state([])).unit).toBe("index");
});

test("a region's early gaps are null on its area page (Review Focus 4)", () => {
  const model = buildHousingAreaModel("region_kakheti", facts, state(["housing.completed_count.region_kakheti_residential"]));
  expect(model.selected[0].valuesByYear[2006]).toBeNull();
  expect(model.selected[0].valuesByYear[2025]).not.toBeNull();
  const racha = buildHousingAreaModel("region_racha_lechkhumi_kvemo_svaneti", facts, state(["housing.completed_area.region_racha_lechkhumi_kvemo_svaneti_residential"]));
  expect(racha.selected[0].valuesByYear[2010]).toBeNull();
  expect(racha.selected[0].valuesByYear[2011]).toBeNull();
  expect(racha.unit).toBe("area");
  const georgia = buildHousingAreaModel("georgia", facts, state(["housing.permits_count.type_residential"]));
  expect(georgia.selected[0].valuesByYear[2025]).toBe(8167);
});

test("an area page reads its own hash and links to another area carry the selection moved there (Review Focus 4)", () => {
  expect(housingAreaSelectionHash(["housing.completed_area.region_guria_residential"], "region_imereti")).toBe("#sel=housing.completed_area.region_imereti_residential");
  expect(housingAreaSelectionHash(["housing.permits_count.region_guria"], "region_imereti")).toBe("");
  expect(housingAreaSelectionHash(housingAreaDefaultSelection("georgia"), "region_guria")).toBe("");
  // Georgia to a region and back: the homes row is `type_residential` in Georgia.
  expect(housingAreaSelectionHash(["housing.completed_count.type_residential"], "region_guria")).toBe("#sel=housing.completed_count.region_guria_residential");
  expect(housingAreaSelectionHash(["housing.completed_count.region_guria_residential", "housing.permits_count.region_guria"], "georgia"))
    .toBe(`#${new URLSearchParams({ sel: "housing.completed_count.type_residential,housing.permits_count.total" })}`);
  expect(housingAreaSelectionHash(["housing.permits_area.region_guria"], "georgia")).toBe("#sel=housing.permits_area.total");
  expect(housingAreaSelectionHash(["housing.permits_area.total"], "georgia")).toBe("#sel=housing.permits_area.total");
  // The moved selection parses on the target page.
  expect(parseHousingAreaHash("#sel=housing.completed_area.region_imereti_residential", "region_imereti", facts).selectedIds).toEqual(["housing.completed_area.region_imereti_residential"]);
  expect(parseHousingAreaHash("", "region_guria", facts).selectedIds).toEqual(["housing.permits_count.region_guria"]);
  expect(parseHousingAreaHash("#sel=housing.permits_count.region_guria,housing.permits_area.region_guria", "region_guria", facts).selectedIds).toEqual(["housing.permits_count.region_guria"]);
});

test("area routes and map ids", () => {
  expect(HOUSING_AREAS).toEqual(["georgia", ...HOUSING_REGIONS]);
  expect(housingAreaSlug("region_guria")).toBe("guria");
  expect(housingAreaHref("georgia")).toBe("/explorer/housing/regions/georgia");
  expect(housingAreaHref("region_samegrelo_zemo_svaneti")).toBe("/explorer/housing/regions/samegrelo_zemo_svaneti");
  expect(housingMapId("georgia")).toBe("georgia");
  expect(housingMapId("region_guria")).toBe("region.guria");
  for (const area of HOUSING_AREAS) expect(housingAreaOfMapId(housingMapId(area))).toBe(area);
  expect(housingRegionHref("region.guria")).toBe("/explorer/housing/regions/guria");
});

test("the Regions map ranks the eleven regions by permitted floor area in the latest year", () => {
  const map = buildHousingRegionMapModel(facts);
  expect(map.year).toBe(2025);
  expect(map.regions).toHaveLength(11);
  expect(map.regions[0]).toMatchObject({ regionId: "region.tbilisi", rank: 1, value: 6423329 });
});

test("colours: the reference is ink, and a type or district keeps one colour wherever it appears", () => {
  const color = (id: string) => {
    const series = [...housingTopicSeries("permits"), ...housingTopicSeries("completed"), ...housingTopicSeries("prices")];
    const index = series.findIndex(s => s.id === id);
    return housingSeriesColor(series[index], index);
  };
  expect(color("housing.permits_count.total")).toBe(INK);
  expect(color("housing.permits_area.total")).toBe(INK);
  expect(color("housing.price_index.total")).toBe(INK);
  expect(color("housing.permits_count.type_hotels")).toBe(color("housing.permits_area.type_hotels"));
  expect(color("housing.permits_count.type_hotels")).toBe(color("housing.completed_count.type_hotels"));
  expect(color("housing.price_flat.district_vake")).toBe(color("housing.price_house.district_vake"));
  expect(color("housing.permits_count.type_hotels")).not.toBe(color("housing.permits_count.type_cafes"));
  const model = buildHousingModel("permits", facts, state([]));
  expect(model.series.find(s => s.id === "housing.permits_count.type_hotels")!.color).toBe(model.series.find(s => s.id === "housing.permits_area.type_hotels")!.color);
});

test("no two rows of one list share a colour, wherever a type appears", () => {
  const colors = (section: HousingTopicId) => buildHousingModel(section, facts, state([])).series.map(s => [s.heading, s.id, s.color] as const);
  for (const section of ["permits", "completed"] as const) {
    const rows = colors(section);
    for (const heading of ["count", "area"]) {
      const own = rows.filter(([h]) => h === heading);
      expect(own).toHaveLength(section === "permits" ? 18 : 17);
      expect(new Set(own.map(([, , color]) => color)).size).toBe(own.length);
    }
    // A type keeps one colour under both headings.
    for (const type of section === "permits" ? HOUSING_TYPES : HOUSING_TYPES.filter(t => t !== "holiday_camps")) {
      expect(new Set(rows.filter(([, id]) => id.endsWith(`.type_${type}`)).map(([, , color]) => color)).size).toBe(1);
    }
  }
  expect(colors("permits").find(([, id]) => id === "housing.permits_count.type_other")![2]).toBe(OTHER_COLOR);
  // Prices: the index rows, and each unit's districts, are distinct; a district keeps its colour under flats and houses.
  const prices = colors("prices");
  for (const heading of ["index", "flats", "houses"]) {
    const own = prices.filter(([h]) => h === heading);
    expect(new Set(own.map(([, , color]) => color)).size).toBe(own.length);
  }
  for (const district of HOUSING_DISTRICTS) {
    expect(new Set(prices.filter(([, id]) => id.endsWith(`.district_${district}`)).map(([, , color]) => color)).size).toBe(1);
  }
  for (const area of HOUSING_AREAS) {
    const own = buildHousingAreaModel(area, facts, state([])).series;
    for (const heading of ["count", "area"]) expect(new Set(own.filter(s => s.heading === heading).map(s => s.color)).size).toBe(4);
  }
});

test("a district's house row is dashed and every other row solid", () => {
  const strokes = (section: HousingTopicId) => buildHousingModel(section, facts, state([])).series;
  expect(strokes("prices").filter(s => s.stroke === "dashed").map(s => s.id)).toEqual(HOUSING_DISTRICTS.map(d => `housing.price_house.district_${d}`));
  expect(strokes("prices").filter(s => s.stroke === "solid")).toHaveLength(13);
  for (const section of ["permits", "completed"] as const) expect(strokes(section).every(s => s.stroke === "solid")).toBe(true);
  expect(buildHousingAreaModel("georgia", facts, state([])).series.every(s => s.stroke === "solid")).toBe(true);
});

const presentation = async (locale: Locale = "en"): Promise<Presentation> => ({ locale, englishLabels: {}, messages: await getMessages(locale, ["workbook", "format", "common", "housing"]) });
const SOURCES = HOUSING_SOURCES.map(sourceId => ({
  sourceId, years: Array.from({ length: 20 }, (_, i) => 2006 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-16",
  downloadHref: `/downloads/methodology/housing/files/${sourceId}.xlsx` as const,
}));
// The page hands over a label for every series it lists; a district has the same one under flats and houses.
const labelsFor = (ids: readonly string[]) => Object.fromEntries(ids.map(id => [id, id.includes("district_") ? id.split("district_")[1].replace(/^./, c => c.toUpperCase()) : id]));
const topicWorkbook = async (section: HousingTopicId, selectedIds: string[], start: number, end: number, locale: Locale = "en") =>
  buildHousingWorkbookExportModel({
    section, facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(selectedIds), title: "Title",
    state: { mode: "table", range: { kind: "manual", start, end }, selectedIds },
  }, await presentation(locale));

test("a permits floor-area workbook exports square metres, leaves a year Geostat left blank empty and cites only the sources behind it", async () => {
  const ids = ["housing.permits_area.total", "housing.permits_area.type_preschool"];
  const model = await topicWorkbook("permits", ids, 2006, 2025);
  expect(model.filename).toBe("fiscal-housing-permits-2006-2025-en.xlsx");
  expect(model.readable.unitLabel).toBe("m²");
  expect(model.readable.numberFormat).toBe("#,##0");
  expect(model.readable.years).toHaveLength(20);
  expect(model.readable.rows.map(row => [row.label, row.kind])).toEqual([[ids[0], "total"], [ids[1], "item"]]);
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(11397190);
  expect(model.readable.rows[1].valuesByYear[2008]).toBeNull();
  expect(model.readable.rows[1].basisByYear[2008]).toBeNull();
  expect(model.readable.rows[1].valuesByYear[2009]).toBe(83);
  expect(model.analysis.rows).toHaveLength(40);
  expect(model.analysis.rows.find(r => r[0] === 2025 && r[1] === ids[0])).toEqual([2025, ids[0], 11397190, "Official"]);
  expect(model.analysis.rows.find(r => r[0] === 2008 && r[1] === ids[1])!.slice(2)).toEqual([null, "Not available"]);
  expect(model.analysis.numericFormats).toEqual({ 3: "#,##0" });
  expect(model.sources.map(s => s.title)).toEqual(["geostat_housing_permits_regions", "geostat_housing_permits_types"]);
  const excel = new ExcelJS.Workbook(); await excel.xlsx.load(await createWorkbookBuffer(model));
  expect(excel.worksheets).toHaveLength(3);
  expect(excel.worksheets[1].getCell(2, 3).numFmt).toBe("#,##0");
});

test("a prices workbook keeps district prices to whole GEL, tells a district's flat row from its house row, and cites the Tbilisi prices file alone", async () => {
  const ids = ["housing.price_flat.district_vake", "housing.price_house.district_vake"];
  const model = await topicWorkbook("prices", ids, 2021, 2025);
  expect(model.filename).toBe("fiscal-housing-prices-2021-2025-en.xlsx");
  expect(model.readable.unitLabel).toBe("GEL per m²");
  expect(model.readable.numberFormat).toBe("#,##0");
  const [flats, houses] = model.readable.rows.map(row => row.label);
  expect(flats).toBe("Vake — Tbilisi new flats");
  expect(houses).toBe("Vake — Tbilisi new houses");
  expect(flats).not.toBe(houses);
  expect(new Set(model.analysis.rows.map(row => row[1]))).toEqual(new Set([flats, houses]));
  expect(model.sources.map(s => s.title)).toEqual(["geostat_housing_tbilisi_prices"]);
  const ka = await topicWorkbook("prices", ids, 2021, 2025, "ka");
  expect(ka.readable.rows.map(row => row.label)).toEqual(["Vake — თბილისი, ახალი ბინები", "Vake — თბილისი, ახალი კერძო სახლები"]);
  const index = await topicWorkbook("prices", ["housing.price_index.total"], 2020, 2025);
  expect(index.readable.unitLabel).toBe("index, 2020 = 100");
  expect(index.readable.numberFormat).toBe("0.0");
  expect(index.readable.rows[0].label).toBe("housing.price_index.total");
  expect(index.sources.map(s => s.title)).toEqual(["geostat_housing_price_index"]);
});

test("an area workbook is named for its slug, and an empty selection exports nothing", async () => {
  const ids = ["housing.permits_count.region_guria", "housing.completed_count.region_guria"];
  const model = await buildHousingWorkbookExportModel({
    area: "region_guria", facts, sources: SOURCES, siteOrigin: "https://fiscal.ge", labels: labelsFor(ids), title: "Title",
    state: { mode: "table", range: { kind: "manual", start: 2010, end: 2025 }, selectedIds: ids },
  }, await presentation());
  expect(model.filename).toBe("fiscal-housing-guria-2010-2025-en.xlsx");
  expect(model.readable.unitLabel).toBe("number");
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(facts.find(f => f.indicatorId === ids[0] && f.year === 2025)!.value);
  expect(model.sources.map(s => s.title)).toEqual(["geostat_housing_permits_regions", "geostat_housing_completed_regions"]);
  const empty = await topicWorkbook("permits", [], 2020, 2025);
  expect(empty.readable.rows).toEqual([]); expect(empty.analysis.rows).toEqual([]); expect(empty.sources).toEqual([]);
});

test("the hub has four cards: three headline series with their latest values and years, then Regions with its years only", async () => {
  const cards = buildHousingHubCards(facts, await presentation());
  expect(cards.map(card => card.href)).toEqual(HOUSING_SECTIONS.map(section => section.href));
  expect(cards.map(card => card.title)).toEqual(["Building permits", "Completed buildings", "Home prices", "Regions"]);
  expect(cards.map(card => card.footer)).toEqual(["2025 · 11,578 · 2006–2025", "2025 · 3,393 · 2006–2025", "2025 · 159.4 · 2020–2025", "2006–2025"]);
  expect(cards.map(card => card.series?.length ?? null)).toEqual([20, 20, 6, null]);
  expect(cards[0].series!.at(-1)).toBe(11578);
  expect(cards[3]).toMatchObject({ series: null, seriesColor: null, comingSoon: false });
  expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04"]);
});

test("the workbook Sources sheet lists the six served Geostat workbooks, archived at fiscal.ge and named in the page's language", async () => {
  const { loadHousingWorkbookSources } = await import("../../lib/pages/housing-shared");
  const en = await loadHousingWorkbookSources("en");
  // Keyed by the facts' raw source id, so a page's facts find their file, and the .xls files are listed with the .xlsx ones.
  expect(en.map(source => source.sourceId).sort()).toEqual([...HOUSING_SOURCES].sort());
  expect(en.find(source => source.sourceId === "geostat_housing_permits_regions")).toEqual({
    sourceId: "geostat_housing_permits_regions", years: Array.from({ length: 20 }, (_, i) => 2006 + i), title: "Permissions granted for construction by region",
    organization: "National Statistics Office of Georgia (Geostat)", downloadHref: "/downloads/methodology/housing/files/0503en020101_permissions.xls", retrievedAt: "2026-10-16",
  });
  expect(en.find(source => source.sourceId === "geostat_housing_price_index")).toMatchObject({ years: [2020, 2021, 2022, 2023, 2024, 2025], title: "Residential property price index, 2020 average = 100" });
  expect(en.find(source => source.sourceId === "geostat_housing_tbilisi_prices")).toMatchObject({ years: [2021, 2022, 2023, 2024, 2025] });
  expect(en.every(source => source.downloadHref.startsWith("/downloads/methodology/housing/files/"))).toBe(true);
  const ka = await loadHousingWorkbookSources("ka");
  expect(ka.find(source => source.sourceId === "geostat_housing_tbilisi_prices")).toMatchObject({ title: "საცხოვრებელი უძრავი ქონების ფასები თბილისის უბნების მიხედვით", organization: "საქსტატი" });
  // The workbook cites only the files behind the exported values, here the regional file for a permits count.
  const model = await buildHousingWorkbookExportModel({
    section: "permits", facts, sources: en, siteOrigin: "https://fiscal.ge", labels: labelsFor(["housing.permits_count.total"]), title: "Title",
    state: { mode: "table", range: { kind: "manual", start: 2010, end: 2025 }, selectedIds: ["housing.permits_count.total"] },
  }, await presentation());
  expect(model.sources.map(source => source.title)).toEqual(["Permissions granted for construction by region"]);
  expect(model.sources[0].absoluteUrl).toBe("https://fiscal.ge/downloads/methodology/housing/files/0503en020101_permissions.xls");
});
