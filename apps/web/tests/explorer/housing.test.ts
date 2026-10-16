import { beforeAll, expect, test } from "vitest";
import { loadHousingFacts, toClientHousingFact } from "../../lib/data/housing/importHousing";
import { HOUSING_DISTRICTS, HOUSING_INDICATORS, HOUSING_REGIONS, HOUSING_TYPES, type ClientHousingFact } from "../../lib/data/housing/types";
import { INK } from "../../lib/explorer/colors";
import {
  HOUSING_HUB_PATH, HOUSING_SECTIONS, buildHousingModel, changeHousingSelection, housingCoverage, housingDefaultSelection, housingSeriesColor, housingTopicSeries,
  parseHousingHash, serializeHousingHash, type HousingTopicId,
} from "../../lib/explorer/housing";
import {
  HOUSING_AREAS, buildHousingAreaModel, buildHousingRegionMapModel, housingAreaDefaultSelection, housingAreaHref, housingAreaOfMapId, housingAreaSelectionHash, housingAreaSeries,
  housingAreaSlug, housingMapId, housingRegionHref, parseHousingAreaHash,
} from "../../lib/explorer/housingAreas";
import { serializeTopicHash } from "../../lib/explorer/topicSeries";

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

test("a link mixing units keeps one unit: the first row's in the hash, with the years clamped to its coverage", () => {
  const mixed = (...ids: string[]) => `#sel=${ids.join(",")}`;
  expect(parseHousingHash(mixed("housing.permits_count.total", "housing.permits_area.total"), "permits", facts).selectedIds).toEqual(["housing.permits_count.total"]);
  expect(parseHousingHash(mixed("housing.price_index.total", "housing.price_flat.district_vake"), "prices", facts).selectedIds).toEqual(["housing.price_index.total"]);
  const districts = parseHousingHash(`${mixed("housing.price_flat.district_vake", "housing.price_index.total")}&start=2020&end=2023`, "prices", facts);
  expect(districts.selectedIds).toEqual(["housing.price_flat.district_vake"]);
  expect(districts.range).toEqual({ kind: "manual", start: 2021, end: 2023 });
  // A range that spans the index's years is all of the districts' (2021-2025), so it reads as "all".
  expect(parseHousingHash(`${mixed("housing.price_flat.district_vake", "housing.price_index.total")}&start=2020&end=2025`, "prices", facts).range).toEqual({ kind: "all" });
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
