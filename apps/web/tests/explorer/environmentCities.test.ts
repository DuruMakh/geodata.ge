import { beforeAll, expect, test } from "vitest";
import { loadEnvironmentFacts, toClientEnvironmentFact } from "../../lib/data/environment/importEnvironment";
import { ENVIRONMENT_CITIES, type ClientEnvironmentFact } from "../../lib/data/environment/types";
import { OTHER_COLOR } from "../../lib/explorer/colors";
import {
  AIR_QUALITY_PATH, buildEnvironmentCityModel, changeEnvironmentCitySelection, environmentCityDefaultSelection, environmentCityForSlug, environmentCityHref,
  environmentCitySeries, neighbourEnvironmentCities, parseEnvironmentCityHash,
} from "../../lib/explorer/environmentCities";
import { serializeEnvironmentHash } from "../../lib/explorer/environment";

let facts: ClientEnvironmentFact[];
beforeAll(async () => { facts = (await loadEnvironmentFacts()).map(toClientEnvironmentFact); });

test("nine city pages in Geostat's order, wrapping at the ends", () => {
  expect(environmentCityHref("rustavi")).toBe(`${AIR_QUALITY_PATH}/rustavi`);
  expect(AIR_QUALITY_PATH).toBe("/explorer/environment/air-quality");
  expect(ENVIRONMENT_CITIES.map(city => environmentCityForSlug(city))).toEqual([...ENVIRONMENT_CITIES]);
  expect(environmentCityForSlug("gori")).toBeNull();
  expect(neighbourEnvironmentCities("tbilisi")).toEqual({ previous: "mestia", next: "kutaisi" });
  expect(neighbourEnvironmentCities("mestia")).toEqual({ previous: "telavi", next: "tbilisi" });
});

test("Tbilisi's PM10 heading lists its five stations, then the dashed grey limit", () => {
  const pm10 = environmentCitySeries("tbilisi", facts).filter(s => s.heading === "pm10Avg");
  expect(pm10.map(s => s.id)).toEqual([...["a1", "a2", "a3", "a4", "a5"].map(code => `environment.aq.pm10_avg.tbilisi_${code}`), "environment.aq.pm10_limit.tbilisi"]);
  expect(pm10.at(-1)).toMatchObject({ stroke: "dashed", reference: false, color: OTHER_COLOR });
  expect([...new Set(environmentCitySeries("tbilisi", facts).map(s => s.heading))]).toEqual(["pm10Avg", "pm25Avg", "no2Avg", "pm10Days"]);
  expect(environmentCityDefaultSelection("tbilisi", facts)).toEqual(pm10.map(s => s.id));
});

test("a city lists only what it published, and a limit only with its station rows", () => {
  for (const city of ENVIRONMENT_CITIES) {
    const ids = new Set(facts.map(f => f.indicatorId));
    const series = environmentCitySeries(city, facts);
    expect(series.every(s => ids.has(s.id)), city).toBe(true);
    for (const limit of series.filter(s => s.id.includes("_limit."))) expect(series.some(s => s.heading === limit.heading && !s.id.includes("_limit.")), limit.id).toBe(true);
  }
  const mestia = environmentCitySeries("mestia", facts);
  expect(mestia.some(s => s.id.startsWith("environment.aq.no2_avg."))).toBe(facts.some(f => f.indicatorId === "environment.aq.no2_avg.mestia_i1"));
});

test("Zestaponi's manual station has four averages, no limit, and defaults to dust", () => {
  const series = environmentCitySeries("zestaponi", facts);
  expect([...new Set(series.map(s => s.heading))]).toEqual(["tspAvg", "so2Avg", "no2Avg", "mno2Avg"]);
  expect(series.some(s => s.id.includes("_limit."))).toBe(false);
  expect(environmentCityDefaultSelection("zestaponi", facts)).toEqual(["environment.aq.tsp_avg.zestaponi_e1"]);
});

test("a Tbilisi selection carried to Kutaisi falls back to Kutaisi's default", () => {
  const tbilisi = changeEnvironmentCitySelection("tbilisi", parseEnvironmentCityHash("", "tbilisi", facts), ["environment.aq.no2_avg.tbilisi_a2"], facts);
  expect(parseEnvironmentCityHash(`#${serializeEnvironmentHash(tbilisi)}`, "kutaisi", facts).selectedIds).toEqual(environmentCityDefaultSelection("kutaisi", facts));
  expect(parseEnvironmentCityHash(`#${serializeEnvironmentHash(tbilisi)}`, "tbilisi", facts).selectedIds).toEqual(["environment.aq.no2_avg.tbilisi_a2"]);
});

test("Kutaisi's PM2.5 limit is 25 to 2019 and 20 from 2020, only where Kutaisi has PM2.5 values", () => {
  const limit = facts.filter(f => f.indicatorId === "environment.aq.pm25_limit.kutaisi");
  expect(limit.filter(f => f.year <= 2019).every(f => f.value === 25)).toBe(true);
  expect(limit.filter(f => f.year >= 2020).every(f => f.value === 20)).toBe(true);
  expect(limit.some(f => f.year <= 2019) && limit.some(f => f.year >= 2020)).toBe(true);
  const measured = new Set(facts.filter(f => /^environment\.aq\.pm25_avg\.kutaisi_/.test(f.indicatorId)).map(f => f.year));
  expect(new Set(limit.map(f => f.year))).toEqual(measured);
});

test("a station keeps its colour under every measure, and stations of a city differ", () => {
  const model = buildEnvironmentCityModel("rustavi", facts, parseEnvironmentCityHash("#sel=", "rustavi", facts));
  const colorOf = (id: string) => model.series.find(s => s.id === id)!.color;
  expect(colorOf("environment.aq.pm25_avg.rustavi_d1")).toBe(colorOf("environment.aq.pm10_avg.rustavi_d1"));
  expect(colorOf("environment.aq.pm10_avg.rustavi_d2")).not.toBe(colorOf("environment.aq.pm10_avg.rustavi_d1"));
  const pm10 = buildEnvironmentCityModel("rustavi", facts, parseEnvironmentCityHash("", "rustavi", facts));
  expect(pm10.selected.find(s => s.id === "environment.aq.pm10_avg.rustavi_d1")!.valuesByYear[2025]).toBe(51);
  expect(pm10.selected.find(s => s.id === "environment.aq.pm10_limit.rustavi")!.valuesByYear[2025]).toBe(40);
});
