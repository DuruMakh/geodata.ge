import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { BUSINESS_REGIONS } from "../../../lib/data/business/types";
import { REVIEWED_AT, TRANSPORT_CSV_HEADERS, prepareTransportData } from "../../../lib/data/transport/prepareTransport";
import {
  TRANSPORT_INDICATORS, TRANSPORT_MEASURES, TRANSPORT_PUBLIC_SOURCES, TRANSPORT_REGIONS, TRANSPORT_SOURCES,
  type TransportFact, type TransportIndicator,
} from "../../../lib/data/transport/types";
import { expectedTransportKeys, transportDisplayDecimals, validateTransportFacts } from "../../../lib/data/transport/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Transport/geostat-transport-annual");
const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = async (): Promise<TransportFact[]> =>
  (await readCsv(path.join(root, "data/imports/transport-annual.csv"))).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as TransportIndicator, value: row.value, publishedValue: row.published_value,
    unit: row.unit as TransportFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly TransportFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Moves an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const plus = (f: TransportFact, amount: string) => {
  const decimals = transportDisplayDecimals(f.indicatorId);
  const value = new Decimal(f.value).plus(amount);
  return Object.assign(f, { value: value.toFixed(), publishedValue: value.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals) });
};

test("the committed canonical files match a fresh preparation from the research package", async () => {
  await expect(prepareTransportData(root, "check")).resolves.toBeUndefined();
}, 120_000);

test("serves every reviewed value of the research package over its coverage", async () => {
  const facts = await loadFacts();
  const report = JSON.parse(await fs.readFile(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(facts).toHaveLength(4301);
  expect(TRANSPORT_INDICATORS).toHaveLength(452);
  expect(TRANSPORT_MEASURES).toHaveLength(8);
  expect(TRANSPORT_REGIONS).toEqual(BUSINESS_REGIONS);
  expect(TRANSPORT_SOURCES).toHaveLength(13);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(TRANSPORT_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(TRANSPORT_SOURCES));
  expect(facts.every(f => f.basis === "actual" && f.valueStatus === "official" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(find(facts, "transport.fleet.cars", 2025).publishedValue).toBe("1650.0");
  expect(find(facts, "transport.passenger_km_per_person.total", 2025).publishedValue).toBe("2858");
  expect(find(facts, "transport.passenger_km.sea", 2020)).toMatchObject({ value: "0", publishedValue: "0.0" });
  expect(find(facts, "transport.registered.total_owner_companies", 2025).sourceSheet).toBe(" type of owner ");
  expect(Math.max(...facts.map(f => f.year))).toBe(2025);
});

test("the research package's archived sources are all inventoried", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(research, "source-manifest.json"), "utf8")) as { source_id: string }[];
  expect(new Set(manifest.map(s => s.source_id))).toEqual(new Set(TRANSPORT_PUBLIC_SOURCES));
  expect(manifest).toHaveLength(TRANSPORT_PUBLIC_SOURCES.length);
});

test("the expected keys are the package's coverage, without its unavailable years", async () => {
  const keys = new Set<string>();
  for (const row of await readCsv(path.join(research, "coverage.csv"))) {
    const unavailable = row.unavailable_years ? row.unavailable_years.split(";").map(Number) : [];
    for (let year = Number(row.first_year); year <= Number(row.last_year); year++) if (!unavailable.includes(year)) keys.add(`${row.indicator_id}:${year}`);
  }
  expect(expectedTransportKeys()).toEqual(keys);
  expect(expectedTransportKeys().size).toBe(4301);
  expect(expectedTransportKeys().has("transport.fleet.cars:2004")).toBe(false);
  expect(expectedTransportKeys().has("transport.tonne_km.sea:2011")).toBe(true);
  expect(expectedTransportKeys().has("transport.registered.total_fuel_diesel_gas:2021")).toBe(false);
});

test("display precision is whole numbers for km per person and one decimal otherwise", () => {
  expect(transportDisplayDecimals("transport.passenger_km_per_person.total")).toBe(0);
  expect(transportDisplayDecimals("transport.passengers.metro")).toBe(1);
  expect(transportDisplayDecimals("transport.road_km.total")).toBe(1);
});

test("the canonical file is UTF-8 with a BOM and the agreed header", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/transport-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(TRANSPORT_CSV_HEADERS.join(","));
});

test.each([
  ["an altered published value", (facts: TransportFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a duplicate observation", (facts: TransportFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: TransportFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2026 row", (facts: TransportFact[]) => { facts.push({ ...find(facts, "transport.fleet.cars", 2025), year: 2026 }); }, /after 2025/],
  ["a 2016 fuel row", (facts: TransportFact[]) => { facts.push({ ...find(facts, "transport.fleet.cars_fuel_petrol", 2017), year: 2016 }); }, /outside the approved coverage/],
  ["a buses hybrid row", (facts: TransportFact[]) => { facts.push({ ...find(facts, "transport.fleet.buses_fuel_electric", 2025), indicatorId: "transport.fleet.buses_fuel_hybrid" }); }, /identity/],
  ["a 2015 sea tonne-km row", (facts: TransportFact[]) => { facts.push({ ...find(facts, "transport.tonne_km.sea", 2012), year: 2015 }); }, /outside the approved coverage/],
  ["regions not adding up", (facts: TransportFact[]) => { plus(find(facts, "transport.registered.region_tbilisi", 2020), "1"); }, /registered\.total by region do not add up/],
  ["fuels drifting from a recorded difference", (facts: TransportFact[]) => { plus(find(facts, "transport.fleet.buses_fuel_diesel", 2020), "-0.2"); }, /fleet\.buses by fuel do not add up/],
  ["cumulative age rows added as bands", (facts: TransportFact[]) => { plus(find(facts, "transport.fleet.cars_age_up_to_10", 2025), "1"); }, /fleet\.cars by age do not add up/],
  ["a calculated status", (facts: TransportFact[]) => { (find(facts, "transport.fleet.cars", 2020) as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a value from another sheet", (facts: TransportFact[]) => { find(facts, "transport.registered.total_owner_companies", 2025).sourceSheet = "fuel type"; }, /source contract/],
  ["a changed anchor", (facts: TransportFact[]) => { plus(find(facts, "transport.passengers.metro", 2025), "0.1"); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  validateTransportFacts(facts);
  mutate(facts);
  expect(() => validateTransportFacts(facts)).toThrow(error);
});
