import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import os from "node:os";
import { expect, test, vi } from "vitest";
import { HOUSING_REGIONS } from "../../../lib/data/housing/types";
import { assertInternetParity, loadInternetFacts, toClientInternetFact } from "../../../lib/data/internet/importInternet";
import { internetMirrorCreateRows, loadInternetFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { INTERNET_CSV_HEADERS, REVIEWED_AT, prepareInternetData } from "../../../lib/data/internet/prepareInternet";
import {
  INTERNET_INDICATORS, INTERNET_PUBLIC_SOURCES, INTERNET_REGIONS, INTERNET_SOURCES, internetSourceDocumentId, type InternetFact, type InternetIndicator,
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

test("loading serves the same 1,055 values as the canonical file", async () => {
  const facts = await loadInternetFacts();
  expect(facts).toHaveLength(1055);
  expect(facts).toEqual(await loadFacts());
});

test("loading refuses a canonical file whose fingerprint differs from the report", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "internet-"));
  try {
    await fs.mkdir(path.join(dir, "apps/web"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/imports"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/reports"), { recursive: true });
    const csv = await fs.readFile(path.join(root, "data/imports/internet-annual.csv"), "utf8");
    const altered = csv.replace("2016,internet.homes_internet.total,70.0516890004974,70.1", "2016,internet.homes_internet.total,70.0516890004975,70.1");
    expect(altered).not.toBe(csv);
    await fs.writeFile(path.join(dir, "data/imports/internet-annual.csv"), altered);
    await fs.copyFile(path.join(root, "data/reports/internet-validation.json"), path.join(dir, "data/reports/internet-validation.json"));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(path.join(dir, "apps/web"));
    try {
      await expect(loadInternetFacts()).rejects.toThrow(/fingerprint/);
    } finally {
      cwd.mockRestore();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
  const facts = await loadFacts();
  const at = facts.findIndex(f => f.indicatorId === "internet.own_mobile.total" && f.year === 2026);
  expect(facts[at].publishedValue).toBe("93.3");
  expect(() => assertInternetParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
  const padded = facts.map(f => ({ ...f }));
  padded[at].publishedValue = "93.30";
  expect(() => assertInternetParity(facts, padded)).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  setValue(changed[at], "93.4");
  expect(() => assertInternetParity(facts, changed)).toThrow();
  expect(() => assertInternetParity(facts, facts.slice(1))).toThrow();
});

test("client facts carry the published one-decimal shares", async () => {
  const facts = await loadFacts();
  expect(toClientInternetFact(find(facts, "internet.own_mobile.total", 2026))).toEqual({ year: 2026, indicatorId: "internet.own_mobile.total", sourceId: "geostat_ict_own_mobile", value: 93.3, unit: "percent", decimals: 1 });
  expect(toClientInternetFact(find(facts, "internet.homes_internet.total", 2016))).toMatchObject({ value: 70.1, unit: "percent", decimals: 1 });
});

test("the database mirror round-trips exact decimals and source relations", async () => {
  const facts = await loadFacts();
  const rows = internetMirrorCreateRows(facts, "internet-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ internetFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "internetFact">;
  const mirror = await loadInternetFactsFromMirror(db(rows));
  expect(() => assertInternetParity(facts, mirror)).not.toThrow();
  expect(mirror).toEqual(facts);
  expect(rows[0].importRunId).toBe("internet-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadInternetFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

test("every archived source has a source-document row", async () => {
  const csv = await fs.readFile(path.join(root, "data/sources/source-documents.csv"));
  const ids = new Set((parse(csv, { columns: true, bom: true }) as Record<string, string>[]).map(r => r.source_id));
  expect(INTERNET_PUBLIC_SOURCES.filter(id => !ids.has(internetSourceDocumentId(id)))).toEqual([]);
});
