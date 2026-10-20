import { beforeAll, expect, test } from "vitest";
import { loadEnvironmentFacts, toClientEnvironmentFact } from "../../lib/data/environment/importEnvironment";
import type { ClientEnvironmentFact } from "../../lib/data/environment/types";
import { INK } from "../../lib/explorer/colors";
import {
  ENVIRONMENT_HUB_PATH, ENVIRONMENT_SECTIONS, buildEnvironmentModel, changeEnvironmentSelection, environmentCoverage, environmentDefaultSelection,
  environmentTopicSeries, parseEnvironmentHash, serializeEnvironmentHash, type EnvironmentTopicId,
} from "../../lib/explorer/environment";

let facts: ClientEnvironmentFact[];
beforeAll(async () => { facts = (await loadEnvironmentFacts()).map(toClientEnvironmentFact); });
const TOPICS: readonly EnvironmentTopicId[] = ["greenhouse-gases", "air-pollution", "climate", "water"];
const state = (selectedIds: string[]) => ({ mode: "line" as const, range: { kind: "all" as const }, selectedIds });

test("the hub lists seven pages in the design's order", () => {
  expect(ENVIRONMENT_HUB_PATH).toBe("/explorer/environment");
  expect(ENVIRONMENT_SECTIONS.map(s => s.href)).toEqual(["greenhouse-gases", "air-pollution", "air-quality", "climate", "water", "waste", "forests"].map(id => `/explorer/environment/${id}`));
  expect(ENVIRONMENT_SECTIONS.map(s => s.labelKey)).toEqual(["GreenhouseGases", "AirPollution", "AirQuality", "Climate", "Water", "Waste", "Forests"].map(id => `common.environment${id}`));
});

test("each list follows the design's headings and order, and every listed row has facts", () => {
  const ghg = environmentTopicSeries("greenhouse-gases");
  expect(ghg.slice(0, 3).map(s => s.id)).toEqual(["environment.ghg.total", "environment.ghg.net", "environment.ghg.sector_energy"]);
  expect([...new Set(ghg.map(s => s.heading))]).toEqual(["totals", "bySector", "energyDetail", "byGas", "fluorinated", "ghgPerPerson"]);
  expect([...new Set(environmentTopicSeries("air-pollution").map(s => s.heading))]).toEqual(["co", "nox", "so2", "nh3", "nmvoc", "tsp", "pm10", "pm25"]);
  expect([...new Set(environmentTopicSeries("climate").map(s => s.heading))]).toEqual(["temperature", "anomaly", "precipitation"]);
  expect([...new Set(environmentTopicSeries("water").map(s => s.heading))]).toEqual(["water", "lostShare", "people", "peopleShare", "waterPerPerson"]);
  for (const topic of TOPICS) {
    const ids = new Set(facts.map(f => f.indicatorId));
    expect(environmentTopicSeries(topic).every(s => ids.has(s.id)), topic).toBe(true);
    // Rows under one heading share one unit.
    for (const heading of new Set(environmentTopicSeries(topic).map(s => s.heading))) {
      const units = new Set(environmentTopicSeries(topic).filter(s => s.heading === heading).map(s => facts.find(f => f.indicatorId === s.id)!.unit));
      expect(units.size, `${topic} ${heading}`).toBe(1);
    }
  }
});

test("the default is the page's total, or the eight pollutant totals in eight colours", () => {
  expect(environmentDefaultSelection("greenhouse-gases")).toEqual(["environment.ghg.total"]);
  expect(environmentDefaultSelection("climate")).toEqual(["environment.climate.temperature.georgia"]);
  expect(environmentDefaultSelection("water")).toEqual(["environment.water.gross"]);
  const air = environmentDefaultSelection("air-pollution");
  expect(air).toHaveLength(8);
  expect(air.every(id => id.endsWith(".total"))).toBe(true);
  const model = buildEnvironmentModel("air-pollution", facts, parseEnvironmentHash("", "air-pollution", facts));
  expect(model.selected.map(s => s.id)).toEqual(air);
  expect(new Set(model.selected.map(s => s.color)).size).toBe(8);
  expect(model.selected.some(s => s.color === INK)).toBe(false);
  expect(buildEnvironmentModel("greenhouse-gases", facts, state(["environment.ghg.total"])).selected[0].color).toBe(INK);
});

test("ticking a row of another unit replaces the selection", () => {
  const start = parseEnvironmentHash("", "greenhouse-gases", facts);
  expect(changeEnvironmentSelection(start, "greenhouse-gases", ["environment.ghg.total", "environment.ghg.gas_hfcs"], facts).selectedIds).toEqual(["environment.ghg.gas_hfcs"]);
  expect(changeEnvironmentSelection(start, "greenhouse-gases", ["environment.ghg.total", "environment.ghg.net"], facts).selectedIds).toEqual(["environment.ghg.total", "environment.ghg.net"]);
});

test("climate years run 1990-2024 with 1991-1994 as gaps, and the range strip offers only published years", () => {
  const model = buildEnvironmentModel("climate", facts, parseEnvironmentHash("", "climate", facts));
  expect([model.years[0], model.years.at(-1)]).toEqual([1990, 2024]);
  expect([1991, 1992, 1993, 1994].map(year => model.selected[0].valuesByYear[year])).toEqual([null, null, null, null]);
  expect(model.selected[0].valuesByYear[2024]).toBe(10.3);
  expect(environmentCoverage("climate", facts, model.selected.map(s => s.id)).years).toEqual([1990, 1995, ...Array.from({ length: 25 }, (_, i) => 2000 + i)]);
  // A place keeps one colour under its three headings.
  const all = buildEnvironmentModel("climate", facts, state([]));
  const colorOf = (id: string) => all.series.find(s => s.id === id)!.color;
  expect(colorOf("environment.climate.temperature_anomaly.tbilisi")).toBe(colorOf("environment.climate.temperature.tbilisi"));
  expect(colorOf("environment.climate.precipitation.wettest")).toBe(colorOf("environment.climate.temperature.warmest"));
});

test("negative and decimal values keep their sign and published decimals", () => {
  const model = buildEnvironmentModel("greenhouse-gases", facts, state(["environment.ghg.sector_land"]));
  expect(model.selected[0].valuesByYear[2022]).toBe(-5.8);
  expect([model.unit, model.decimals]).toEqual(["mt_co2e", 1]);
  expect(buildEnvironmentModel("water", facts, state(["environment.water.lost_share"])).decimals).toBe(1);
});

test("the hash keeps the selection, falls back for an unknown one and keeps an explicit empty one", () => {
  expect(parseEnvironmentHash("#sel=unknown", "water", facts).selectedIds).toEqual(["environment.water.gross"]);
  expect(parseEnvironmentHash("#sel=", "water", facts).selectedIds).toEqual([]);
  const picked = changeEnvironmentSelection(parseEnvironmentHash("", "water", facts), "water", ["environment.water.gross", "environment.water.lost"], facts);
  expect(parseEnvironmentHash(`#${serializeEnvironmentHash(picked)}`, "water", facts)).toEqual(picked);
  expect(buildEnvironmentModel("water", facts, parseEnvironmentHash("#sel=", "water", facts)).unit).toBe("million_m3");
});
