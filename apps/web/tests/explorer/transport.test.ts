import { beforeAll, expect, test } from "vitest";
import { loadTransportFacts, toClientTransportFact } from "../../lib/data/transport/importTransport";
import { TRANSPORT_INDICATORS, TRANSPORT_REGIONS, TRANSPORT_SOURCES, type ClientTransportFact } from "../../lib/data/transport/types";
import { INK } from "../../lib/explorer/colors";
import {
  TRANSPORT_HUB_PATH, TRANSPORT_SECTIONS, buildTransportModel, changeTransportSelection, transportCoverage, transportDefaultSelection, transportSeriesColor,
  transportLatestValue, transportSeriesLabel, transportTopicSeries, transportValueLabel, parseTransportHash, type TransportTopicId,
} from "../../lib/explorer/transport";
import {
  TRANSPORT_AREAS, buildTransportAreaModel, transportAreaDefaultSelection, transportAreaHref, transportAreaSelectionHash, transportAreaSeries,
  changeTransportAreaSelection, parseTransportAreaHash,
} from "../../lib/explorer/transportAreas";
import { buildTransportHubCards } from "../../lib/explorer/transportHubCards";
import { buildTransportRegionMapModel } from "../../lib/explorer/transportRegionMap";
import { buildTransportWorkbookExportModel } from "../../lib/explorer/transportWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";

let facts: ClientTransportFact[];
beforeAll(async () => { facts = (await loadTransportFacts()).map(toClientTransportFact); });
const span = (coverage: { min: number; max: number }) => [coverage.min, coverage.max];
const TOPICS: readonly TransportTopicId[] = ["vehicles", "vehicle-age", "passengers", "freight"];
const state = (selectedIds: string[], range: { kind: "all" } | { kind: "manual"; start: number; end: number } = { kind: "all" }) => ({ mode: "line" as const, range, selectedIds });
const t = (key: string) => ({ "heading.carsFuel": "Passenger cars by fuel · thousand", "heading.busesAge": "Buses and minibuses · thousand", unitThousandVehicles: "thousand vehicles", unitPkmPerPerson: "passenger-km per person", unitThousand: "thousand", unitMillion: "million", unitBillion: "billion" })[key] ?? key;

test("the hub lists four topic pages and the regions page", () => {
  expect(TRANSPORT_HUB_PATH).toBe("/explorer/transport");
  expect(TRANSPORT_SECTIONS.map(s => [s.id, s.href, s.labelKey])).toEqual([
    ["vehicles", "/explorer/transport/vehicles", "common.transportVehicles"],
    ["vehicle-age", "/explorer/transport/vehicle-age", "common.transportVehicleAge"],
    ["passengers", "/explorer/transport/passengers", "common.transportPassengers"],
    ["freight", "/explorer/transport/freight", "common.transportFreight"],
    ["regions", "/explorer/transport/regions", "common.transportRegions"],
  ]);
});

test("each page starts on its default selection, with coverage from the facts", () => {
  expect(TOPICS.map(transportDefaultSelection)).toEqual([
    ["transport.fleet.cars"], ["transport.fleet.cars_age_over_10"], ["transport.passenger_km.total"], ["transport.tonne_km.total"],
  ]);
  expect(TOPICS.map(topic => transportTopicSeries(topic)[0].id)).toEqual([
    "transport.fleet.cars", "transport.fleet.cars_age_up_to_2", "transport.passenger_km.total", "transport.tonne_km.total",
  ]);
  expect(span(transportCoverage("vehicles", facts))).toEqual([2000, 2025]);
  expect(span(transportCoverage("vehicle-age", facts))).toEqual([2017, 2025]);
  expect(span(transportCoverage("passengers", facts, ["transport.passengers.metro"]))).toEqual([2012, 2025]);
  expect(transportAreaDefaultSelection("georgia")).toEqual(["transport.registered.total"]);
  expect(transportAreaDefaultSelection("region_guria")).toEqual(["transport.registered.region_guria"]);
});

test("the lists have the spec's rows under their headings, every one a served indicator", () => {
  const vehicles = transportTopicSeries("vehicles");
  const count = (heading: string) => vehicles.filter(s => s.heading === heading).length;
  expect(["types", "carsFuel", "busesFuel", "trucksFuel", "specialFuel"].map(count)).toEqual([4, 8, 6, 6, 5]);
  expect(vehicles).toHaveLength(29);
  expect(transportTopicSeries("vehicle-age").map(s => s.heading)).toEqual([...Array(5).fill("carsAge"), ...Array(4).fill("busesAge"), ...Array(5).fill("trucksAge"), ...Array(5).fill("specialAge")]);
  expect(transportTopicSeries("passengers").map(s => s.id.replace("transport.", ""))).toEqual([
    "passenger_km.total", "passenger_km.road", "passenger_km.rail", "passenger_km.metro", "passenger_km.air", "passenger_km.sea", "passenger_km_per_person.total",
    "passengers.rail", "passengers.rail_domestic", "passengers.rail_international", "passengers.metro", "passengers.airports", "passengers.airlines", "passengers.seaports",
  ]);
  expect(transportTopicSeries("freight")).toHaveLength(16);
  expect(transportAreaSeries("region_guria").map(s => s.heading)).toEqual([
    ...Array(5).fill("registered"), ...Array(8).fill("fuel"), ...Array(5).fill("age"), ...Array(2).fill("owner"), ...Array(4).fill("roads"),
  ]);
  expect(transportAreaSeries("georgia")[0]).toEqual({ id: "transport.registered.total", reference: true, heading: "registered" });
  const listed = [...TOPICS.flatMap(transportTopicSeries), ...TRANSPORT_AREAS.flatMap(transportAreaSeries)].map(s => s.id);
  expect(listed.filter(id => !TRANSPORT_INDICATORS.includes(id))).toEqual([]);
  expect(listed.some(id => /type_unknown|diesel_gas|hybrid_diesel|abkhazia|region_unknown/.test(id))).toBe(false);
});

test("a saved link mixing units keeps the first row's unit, and its years fit that unit's coverage", () => {
  expect(parseTransportHash("#sel=transport.passenger_km.total,transport.passengers.metro", "passengers", facts).selectedIds).toEqual(["transport.passenger_km.total"]);
  const metro = parseTransportHash("#sel=transport.passengers.metro&from=2000", "passengers", facts);
  expect(metro.selectedIds).toEqual(["transport.passengers.metro"]);
  expect(buildTransportModel("passengers", facts, metro).years).toEqual(Array.from({ length: 14 }, (_, i) => 2012 + i));
});

test("ticking a row of another unit replaces the selection", () => {
  const next = changeTransportSelection(state(["transport.passenger_km.total"]), transportTopicSeries("passengers"), ["transport.passenger_km.total", "transport.passenger_km_per_person.total"], facts);
  expect(next.selectedIds).toEqual(["transport.passenger_km_per_person.total"]);
  const roads = changeTransportAreaSelection("region_guria", state(["transport.registered.region_guria"]), ["transport.registered.region_guria", "transport.road_km.region_guria"], facts);
  expect(roads.selectedIds).toEqual(["transport.road_km.region_guria"]);
});

test("a year Geostat left blank is null, a nil cell is 0", () => {
  const vehicles = buildTransportModel("vehicles", facts, state(["transport.fleet.cars"]));
  expect(vehicles.selected[0].valuesByYear[2004]).toBeNull();
  expect(vehicles.selected[0].valuesByYear[2025]).toBe(1650);
  const sea = buildTransportModel("passengers", facts, state(["transport.passenger_km.sea"]));
  expect(sea.selected[0].valuesByYear[2021]).toBe(0);
  expect(buildTransportModel("freight", facts, state(["transport.tonne_km.sea"])).selected[0].valuesByYear[2015]).toBeNull();
});

test("colours: totals are ink, a fuel and a vehicle type keep one colour wherever they are listed", () => {
  const vehicles = buildTransportModel("vehicles", facts, state([])).series;
  const colorOf = (id: string) => vehicles.find(s => s.id === id)!.color;
  expect(colorOf("transport.fleet.cars_fuel_diesel")).toBe(colorOf("transport.fleet.trucks_fuel_diesel"));
  expect(colorOf("transport.fleet.cars_fuel_diesel")).not.toBe(colorOf("transport.fleet.cars_fuel_petrol"));
  expect(new Set(vehicles.filter(s => s.heading === "types" || s.heading === "carsFuel").map(s => s.color)).size).toBe(12);
  const area = buildTransportAreaModel("region_guria", facts, state([])).series;
  expect(area.find(s => s.id === "transport.registered.region_guria_cars")!.color).toBe(colorOf("transport.fleet.cars"));
  expect(area.find(s => s.id === "transport.registered.region_guria_fuel_diesel")!.color).toBe(colorOf("transport.fleet.cars_fuel_diesel"));
  expect(transportSeriesColor({ id: "transport.passenger_km.total", reference: true, heading: "pkm" }, 0)).toBe(INK);
  const age = buildTransportModel("vehicle-age", facts, state([])).series;
  expect(age.find(s => s.id === "transport.fleet.cars_age_over_10")!.color).toBe(age.find(s => s.id === "transport.fleet.buses_age_over_10")!.color);
});

test("labels: a fuel or age row names its heading, other rows keep their own name, and values name their unit", () => {
  const labels = { "transport.fleet.cars_fuel_petrol": "Petrol", "transport.fleet.buses_age_up_to_2": "Up to 2 years", "transport.fleet.cars": "Passenger cars" };
  expect(transportSeriesLabel({ id: "transport.fleet.cars_fuel_petrol", heading: "carsFuel" }, labels, t)).toBe("Petrol — Passenger cars by fuel");
  expect(transportSeriesLabel({ id: "transport.fleet.buses_age_up_to_2", heading: "busesAge" }, labels, t)).toBe("Up to 2 years — Buses and minibuses");
  expect(transportSeriesLabel({ id: "transport.fleet.cars", heading: "types" }, labels, t)).toBe("Passenger cars");
  expect(transportValueLabel(1650, "vehicles", t)).toBe("1,650.0 thousand vehicles");
  expect(transportValueLabel(2858, "pkmPerPerson", t)).toBe("2,858 passenger-km per person");
  expect(transportValueLabel(null, "vehicles", t)).toBe("—");
});

test("the latest-value line reads in thousands, millions or billions of the published figure", () => {
  // Published in thousand vehicles or million passenger-km and tonne-km.
  expect(transportLatestValue(1650.04, "million", t)).toBe("1.65 million");
  expect(transportLatestValue(11262.1, "billion", t)).toBe("11.3 billion");
  expect(transportLatestValue(855, "thousand", t)).toBe("855.0 thousand");
});

test("a link to another area page carries the selection moved to that area", () => {
  expect(transportAreaSelectionHash(["transport.road_km.region_guria_local"], "georgia")).toBe("#sel=transport.road_km.total_local");
  expect(transportAreaSelectionHash(["transport.registered.total_fuel_electric", "transport.registered.total"], "region_imereti"))
    .toBe(`#${new URLSearchParams({ sel: "transport.registered.region_imereti_fuel_electric,transport.registered.region_imereti" })}`);
  expect(transportAreaSelectionHash(["transport.road_km.total"], "region_guria")).toBe(`#${new URLSearchParams({ sel: "transport.road_km.region_guria" })}`);
  expect(transportAreaSelectionHash(transportAreaDefaultSelection("region_guria"), "georgia")).toBe("");
  expect(transportAreaSelectionHash(["transport.registered.region_guria"], "region_imereti")).toBe("");
  expect(transportAreaHref("region_guria")).toBe("/explorer/transport/regions/guria");
  expect(parseTransportAreaHash("#sel=transport.road_km.region_guria", "region_guria", facts).selectedIds).toEqual(["transport.road_km.region_guria"]);
});

test("the region map shows registered vehicles in 2025, Tbilisi first", () => {
  const map = buildTransportRegionMapModel(facts);
  expect(map.year).toBe(2025);
  expect(map.regions).toHaveLength(TRANSPORT_REGIONS.length);
  expect(map.regions[0]).toMatchObject({ regionId: "region.tbilisi", value: 855 });
});

const presentation = async (): Promise<Presentation> => ({
  locale: "en", englishLabels: {},
  messages: {
    ...await getMessages("en", ["workbook", "format", "common"]),
    ...Object.fromEntries(TRANSPORT_SECTIONS.flatMap(s => [[s.labelKey, s.id], [`transport.page.${s.id}.summary`, `${s.id} summary`]])),
    "transport.unitMillionPkm": "million passenger-km", "transport.status.official": "Official",
  },
});

test("the hub has five cards: four headline series ending in 2025, then Regions with its years only", async () => {
  const cards = buildTransportHubCards(facts, await presentation());
  expect(cards.map(card => card.href)).toEqual(TRANSPORT_SECTIONS.map(section => section.href));
  expect(cards.map(card => card.footer)).toEqual(["2025 · 1,650.0 · 2000–2025", "2025 · 1,318.9 · 2017–2025", "2025 · 11,262.1 · 2000–2025", expect.stringMatching(/^2025 · .* · 2000–2025$/), "2017–2025"]);
  expect(cards[4]).toMatchObject({ series: null, seriesColor: null, comingSoon: false });
});

test("the default Passengers workbook has one row with Geostat's 2025 figure and cites only H-1", async () => {
  const sources = TRANSPORT_SOURCES.map(sourceId => ({
    sourceId, years: Array.from({ length: 26 }, (_, i) => 2000 + i), title: sourceId, organization: "Geostat", retrievedAt: "2026-10-20",
    downloadHref: `/downloads/methodology/transport/files/${sourceId}.xlsx` as const,
  }));
  const model = buildTransportWorkbookExportModel({
    section: "passengers", facts, sources, siteOrigin: "https://fiscal.ge", labels: { "transport.passenger_km.total": "All transport" }, title: "Title",
    state: { mode: "table", range: { kind: "all" }, selectedIds: transportDefaultSelection("passengers") },
  }, await presentation());
  expect(model.readable.rows).toHaveLength(1);
  expect(model.readable.rows[0]).toMatchObject({ kind: "total", label: "All transport" });
  expect(model.readable.rows[0].valuesByYear[2025]).toBe(11262.1);
  expect(model.readable.numberFormat).toBe("#,##0.0");
  expect(model.sources.map(source => source.title)).toEqual(["geostat_transport_passenger_demand"]);
});
