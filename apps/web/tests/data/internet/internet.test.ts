import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { HOUSING_REGIONS } from "../../../lib/data/housing/types";
import { INTERNET_CSV_HEADERS, REVIEWED_AT, prepareInternetData } from "../../../lib/data/internet/prepareInternet";
import {
  INTERNET_INDICATORS, INTERNET_PUBLIC_SOURCES, INTERNET_REGIONS, INTERNET_SOURCES, type InternetFact, type InternetIndicator,
} from "../../../lib/data/internet/types";
import { expectedInternetKeys, validateInternetFacts } from "../../../lib/data/internet/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Internet/geostat-ict-households-annual");
const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = async (): Promise<InternetFact[]> =>
  (await readCsv(path.join(root, "data/imports/internet-annual.csv"))).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as InternetIndicator, value: row.value, publishedValue: row.published_value,
    unit: row.unit as "percent", basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly InternetFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Sets an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const setValue = (f: InternetFact, value: string) => Object.assign(f, { value, publishedValue: new Decimal(value).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1) });

test("the committed canonical files match a fresh preparation from the research package", async () => {
  await expect(prepareInternetData(root, "check")).resolves.toBeUndefined();
}, 120_000);

test("serves every reviewed value of the research package over its coverage", async () => {
  const facts = await loadFacts();
  const report = JSON.parse(await fs.readFile(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number; indicator_count: number };
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(facts).toHaveLength(1055);
  expect(INTERNET_INDICATORS).toHaveLength(report.indicator_count);
  expect(INTERNET_REGIONS).toEqual(HOUSING_REGIONS);
  expect(INTERNET_SOURCES).toHaveLength(10);
  expect(INTERNET_PUBLIC_SOURCES).toHaveLength(36);
  expect([...new Set(facts.map(f => f.indicatorId))]).toEqual(INTERNET_INDICATORS);
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(INTERNET_SOURCES));
  expect(facts.every(f => f.unit === "percent" && f.basis === "actual" && f.valueStatus === "survey_estimate" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(find(facts, "internet.homes_internet.total", 2026).publishedValue).toBe("93.5");
  expect(find(facts, "internet.own_mobile.total", 2026)).toMatchObject({ value: "93.34998070175611", publishedValue: "93.3" });
  expect(Math.min(...facts.map(f => f.year))).toBe(2016);
  expect(Math.max(...facts.map(f => f.year))).toBe(2026);
});

test("the research package's archived sources are all inventoried", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(research, "source-manifest.json"), "utf8")) as { source_id: string }[];
  expect(new Set(manifest.map(s => s.source_id))).toEqual(new Set(INTERNET_PUBLIC_SOURCES));
  expect(manifest).toHaveLength(INTERNET_PUBLIC_SOURCES.length);
});

test("the expected keys are the package's coverage", async () => {
  const keys = new Set<string>();
  for (const row of await readCsv(path.join(research, "coverage.csv"))) {
    for (let year = Number(row.first_year); year <= Number(row.last_year); year++) keys.add(`${row.indicator_id}:${year}`);
  }
  expect(expectedInternetKeys()).toEqual(keys);
  expect(expectedInternetKeys().size).toBe(1055);
  expect(expectedInternetKeys().has("internet.homes_internet.region_guria:2019")).toBe(false);
  expect(expectedInternetKeys().has("internet.homes_internet.region_imereti:2016")).toBe(true);
  expect(expectedInternetKeys().has("internet.own_smartphone.total:2018")).toBe(false);
});

test("the canonical file is UTF-8 with a BOM and the agreed header", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/internet-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(INTERNET_CSV_HEADERS.join(","));
});

test.each([
  ["an altered published value", (facts: InternetFact[]) => { facts[0].publishedValue = "0.9"; }, /published value/],
  ["a duplicate observation", (facts: InternetFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: InternetFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2027 row", (facts: InternetFact[]) => { facts.push({ ...find(facts, "internet.used_3m.total", 2026), year: 2027 }); }, /after 2026/],
  ["a 2015 row", (facts: InternetFact[]) => { facts.push({ ...find(facts, "internet.used_3m.total", 2016), year: 2015 }); }, /outside the approved coverage/],
  ["a 2018 smartphone row", (facts: InternetFact[]) => { facts.push({ ...find(facts, "internet.own_smartphone.total", 2019), year: 2018 }); }, /outside the approved coverage/],
  ["a 2019 Guria row", (facts: InternetFact[]) => { facts.push({ ...find(facts, "internet.homes_internet.region_guria", 2020), year: 2019 }); }, /outside the approved coverage/],
  ["a daily row for children", (facts: InternetFact[]) => { facts.push({ ...find(facts, "internet.daily.total", 2020), indicatorId: "internet.daily.age_6_14" }); }, /identity/],
  ["a regional row of a people measure", (facts: InternetFact[]) => { facts.push({ ...find(facts, "internet.used_3m.total", 2020), indicatorId: "internet.used_3m.region_tbilisi" }); }, /identity/],
  ["an official status", (facts: InternetFact[]) => { (find(facts, "internet.used_3m.total", 2020) as { valueStatus: string }).valueStatus = "official"; }, /source contract/],
  ["a value from another table", (facts: InternetFact[]) => { find(facts, "internet.own_mobile.total", 2020).sourceId = "geostat_ict_own_smartphone"; }, /source contract/],
  ["a share above 100", (facts: InternetFact[]) => { setValue(find(facts, "internet.used_3m.total", 2020), "100.5"); }, /range/],
  ["a changed anchor", (facts: InternetFact[]) => { setValue(find(facts, "internet.homes_internet.total", 2026), "93.4"); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  validateInternetFacts(facts);
  mutate(facts);
  expect(() => validateInternetFacts(facts)).toThrow(error);
});
