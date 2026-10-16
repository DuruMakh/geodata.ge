import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { BUSINESS_REGIONS } from "../../../lib/data/business/types";
import { HOUSING_CSV_HEADERS, REVIEWED_AT, prepareHousingData } from "../../../lib/data/housing/prepareHousing";
import {
  HOUSING_DISTRICTS, HOUSING_INDICATORS, HOUSING_MEASURES, HOUSING_PUBLIC_SOURCES, HOUSING_REGIONS, HOUSING_SOURCES, HOUSING_TYPES,
  type HousingFact, type HousingIndicator,
} from "../../../lib/data/housing/types";
import { expectedHousingKeys, housingDisplayDecimals, validateHousingFacts } from "../../../lib/data/housing/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Housing/geostat-housing-annual");
const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = async (): Promise<HousingFact[]> =>
  (await readCsv(path.join(root, "data/imports/housing-annual.csv"))).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as HousingIndicator, value: row.value, publishedValue: row.published_value,
    unit: row.unit as HousingFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly HousingFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Sets an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const setValue = (f: HousingFact, value: string) => {
  const decimals = housingDisplayDecimals(f.indicatorId);
  return Object.assign(f, { value, publishedValue: new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals) });
};
const plus = (f: HousingFact, amount: string) => setValue(f, new Decimal(f.value).plus(amount).toFixed());

test("the committed canonical files match a fresh preparation from the research package", async () => {
  await expect(prepareHousingData(root, "check")).resolves.toBeUndefined();
}, 120_000);

test("serves every reviewed value of the research package over its coverage", async () => {
  const facts = await loadFacts();
  const report = JSON.parse(await fs.readFile(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(facts).toHaveLength(3222);
  expect(HOUSING_INDICATORS).toHaveLength(181);
  expect(HOUSING_MEASURES).toHaveLength(7);
  expect(HOUSING_TYPES).toHaveLength(17);
  expect(HOUSING_DISTRICTS).toHaveLength(10);
  expect(HOUSING_REGIONS).toEqual(BUSINESS_REGIONS);
  expect(HOUSING_SOURCES).toHaveLength(6);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(HOUSING_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(HOUSING_SOURCES));
  expect(facts.every(f => f.basis === "actual" && f.valueStatus === "official" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(find(facts, "housing.permits_count.total", 2025).publishedValue).toBe("11578");
  expect(find(facts, "housing.completed_area.total", 2025).publishedValue).toBe("3509126");
  expect(find(facts, "housing.price_index.total", 2025).publishedValue).toBe("159.4");
  expect(find(facts, "housing.price_flat.district_vake", 2025)).toMatchObject({ value: "5873.77", publishedValue: "5874" });
  expect(Math.max(...facts.map(f => f.year))).toBe(2025);
});

test("the research package's archived sources are all inventoried", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(research, "source-manifest.json"), "utf8")) as { source_id: string }[];
  expect(new Set(manifest.map(s => s.source_id))).toEqual(new Set(HOUSING_PUBLIC_SOURCES));
  expect(manifest).toHaveLength(HOUSING_PUBLIC_SOURCES.length);
});

test("the expected keys are the package's coverage, without its unavailable years", async () => {
  const keys = new Set<string>();
  for (const row of await readCsv(path.join(research, "coverage.csv"))) {
    const unavailable = row.unavailable_years ? row.unavailable_years.split(";").map(Number) : [];
    for (let year = Number(row.first_year); year <= Number(row.last_year); year++) if (!unavailable.includes(year)) keys.add(`${row.indicator_id}:${year}`);
  }
  expect(expectedHousingKeys()).toEqual(keys);
  expect(expectedHousingKeys().size).toBe(3222);
  expect(expectedHousingKeys().has("housing.completed_count.region_kakheti_residential:2006")).toBe(false);
  expect(expectedHousingKeys().has("housing.completed_count.region_kakheti:2006")).toBe(true);
  expect(expectedHousingKeys().has("housing.permits_count.type_holiday_camps:2022")).toBe(true);
});

test("display precision is one decimal for the index and none otherwise", () => {
  expect(housingDisplayDecimals("housing.price_index.flats")).toBe(1);
  expect(housingDisplayDecimals("housing.price_flat.district_vake")).toBe(0);
  expect(housingDisplayDecimals("housing.permits_area.total")).toBe(0);
});

test("the canonical file is UTF-8 with a BOM and the agreed header", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/housing-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(HOUSING_CSV_HEADERS.join(","));
});

test.each([
  ["an altered published value", (facts: HousingFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a duplicate observation", (facts: HousingFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: HousingFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2026 row", (facts: HousingFact[]) => { facts.push({ ...find(facts, "housing.permits_count.total", 2025), year: 2026 }); }, /after 2025/],
  ["a 2005 row", (facts: HousingFact[]) => { facts.push({ ...find(facts, "housing.permits_count.total", 2006), year: 2005 }); }, /outside the approved coverage/],
  ["a 2019 price index row", (facts: HousingFact[]) => { facts.push({ ...find(facts, "housing.price_index.total", 2020), year: 2019 }); }, /outside the approved coverage/],
  ["a 2020 district price row", (facts: HousingFact[]) => { facts.push({ ...find(facts, "housing.price_flat.district_vake", 2021), year: 2020 }); }, /outside the approved coverage/],
  ["a completed holiday camps row", (facts: HousingFact[]) => { facts.push({ ...find(facts, "housing.completed_count.type_other", 2022), indicatorId: "housing.completed_count.type_holiday_camps" }); }, /identity/],
  ["a completed residential row for a gap year", (facts: HousingFact[]) => { facts.push({ ...find(facts, "housing.completed_count.region_kakheti_residential", 2007), year: 2006 }); }, /outside the approved coverage/],
  ["regions not adding up in numbers", (facts: HousingFact[]) => { plus(find(facts, "housing.permits_count.region_guria", 2020), "1"); }, /permits_count regions do not add up/],
  ["regions drifting by a square metre in an ordinary year", (facts: HousingFact[]) => { plus(find(facts, "housing.permits_area.region_guria", 2020), "2"); }, /permits_area regions do not add up/],
  ["regions drifting from the recorded 2024 difference", (facts: HousingFact[]) => { plus(find(facts, "housing.permits_area.region_guria", 2024), "1"); }, /permits_area regions do not add up/],
  ["the recorded 2024 completed difference removed", (facts: HousingFact[]) => { plus(find(facts, "housing.completed_area.region_guria", 2024), "-1"); }, /completed_area regions do not add up/],
  ["types not adding up", (facts: HousingFact[]) => { plus(find(facts, "housing.completed_count.type_trade", 2020), "1"); }, /completed_count types do not add up/],
  ["a residential count above its region", (facts: HousingFact[]) => { setValue(find(facts, "housing.permits_count.region_guria_residential", 2020), "100000"); }, /residential/],
  ["a calculated status", (facts: HousingFact[]) => { (find(facts, "housing.permits_count.total", 2020) as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a price from another sheet", (facts: HousingFact[]) => { find(facts, "housing.price_flat.district_vake", 2025).sourceSheet = "Detached houses"; }, /source contract/],
  ["a changed anchor", (facts: HousingFact[]) => { setValue(find(facts, "housing.price_index.total", 2025), "159.3"); }, /anchor/],
  ["a changed workbook anchor", (facts: HousingFact[]) => { setValue(find(facts, "housing.price_flat.district_vake", 2025), "5874"); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  validateHousingFacts(facts);
  mutate(facts);
  expect(() => validateHousingFacts(facts)).toThrow(error);
});
