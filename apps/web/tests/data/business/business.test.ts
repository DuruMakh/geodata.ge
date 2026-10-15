import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test, vi } from "vitest";
import { assertBusinessParity, loadBusinessFacts, toClientBusinessFact } from "../../../lib/data/business/importBusiness";
import { businessMirrorCreateRows, loadBusinessFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { BUSINESS_CSV_HEADERS, REVIEWED_AT, prepareBusinessData } from "../../../lib/data/business/prepareBusiness";
import { BUSINESS_INDICATORS, BUSINESS_PUBLIC_SOURCES, BUSINESS_SOURCES, businessSourceDocumentId, type BusinessFact, type BusinessIndicator } from "../../../lib/data/business/types";
import { businessDisplayDecimals, expectedBusinessKeys, validateBusinessFacts } from "../../../lib/data/business/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Business/geostat-business-annual");
const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = async (): Promise<BusinessFact[]> =>
  (await readCsv(path.join(root, "data/imports/business-annual.csv"))).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as BusinessIndicator, value: row.value, publishedValue: row.published_value,
    unit: row.unit as BusinessFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly BusinessFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Sets an exact value and keeps its published rounding consistent, so only the rule under test fails. */
const setValue = (f: BusinessFact, value: string) => {
  const decimals = businessDisplayDecimals(f.indicatorId);
  return Object.assign(f, { value, publishedValue: new Decimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals) });
};
const plus = (f: BusinessFact, amount: string) => setValue(f, new Decimal(f.value).plus(amount).toFixed());

test("the committed canonical files match a fresh preparation from the research package", async () => {
  await expect(prepareBusinessData(root, "check")).resolves.toBeUndefined();
}, 60_000);

test("serves every reviewed value of the research package over its coverage", async () => {
  const facts = await loadFacts();
  const report = JSON.parse(await fs.readFile(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(BUSINESS_INDICATORS).toHaveLength(284);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(BUSINESS_INDICATORS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(BUSINESS_SOURCES));
  expect(facts.every(f => f.basis === "actual" && f.valueStatus === "official" && f.lastReviewedAt === REVIEWED_AT)).toBe(true);
  expect(find(facts, "business.turnover.total", 2025).publishedValue).toBe("253725.5");
  expect(find(facts, "business.turnover.size_large", 2025).publishedValue).toBe("173004.5");
  expect(find(facts, "business.active.total", 2024).publishedValue).toBe("249236");
  expect(Math.max(...facts.map(f => f.year))).toBe(2025);
});

test("the expected keys are the package's coverage, without its unavailable years", async () => {
  const keys = new Set<string>();
  for (const row of await readCsv(path.join(research, "coverage.csv"))) {
    const unavailable = row.unavailable_years ? row.unavailable_years.split(";").map(Number) : [];
    for (let year = Number(row.first_year); year <= Number(row.last_year); year++) if (!unavailable.includes(year)) keys.add(`${row.indicator_id}:${year}`);
  }
  expect(expectedBusinessKeys()).toEqual(keys);
  expect(expectedBusinessKeys().has("business.death_rate.sector_a:2016")).toBe(false);
  expect(expectedBusinessKeys().has("business.death_rate.total:2016")).toBe(true);
});

test("published values round from the value as Excel displays it", async () => {
  const facts = await loadFacts();
  expect(find(facts, "business.turnover.sector_a", 2004)).toMatchObject({ value: "25.863899825519319", publishedValue: "25.9" });
  expect(find(facts, "business.employed.size_medium", 2006)).toMatchObject({ value: "99592.295662591016", publishedValue: "99592" });
});

test("the canonical file is UTF-8 with a BOM and the agreed header", async () => {
  const bytes = await fs.readFile(path.join(root, "data/imports/business-annual.csv"));
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(bytes.toString("utf8").slice(1).split("\n")[0]).toBe(BUSINESS_CSV_HEADERS.join(","));
});

test("the 2006 survey-scope break covers every sales and jobs series", async () => {
  const rows = await readCsv(path.join(root, "data/imports/business-series-breaks.csv"));
  expect(rows.map(r => [r.break_id, r.reference_date])).toEqual([["survey_scope_2006", "2006-01-01"]]);
  expect(new Set(rows[0].applies_to.split(";"))).toEqual(new Set(BUSINESS_INDICATORS.filter(id => /^business\.(turnover|employed)\./.test(id))));
});

test.each([
  ["an altered published value", (facts: BusinessFact[]) => { facts[0].publishedValue = "0.99"; }, /published value/],
  ["a duplicate observation", (facts: BusinessFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: BusinessFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2005 survey region row", (facts: BusinessFact[]) => { facts.push({ ...find(facts, "business.turnover.region_guria", 2006), year: 2005 }); }, /region before 2006/],
  ["a 2026 row", (facts: BusinessFact[]) => { facts.push({ ...find(facts, "business.turnover.total", 2025), year: 2026 }); }, /after 2025/],
  ["a 2013 active-firms row", (facts: BusinessFact[]) => { facts.push({ ...find(facts, "business.active.total", 2014), year: 2013 }); }, /outside the approved coverage/],
  ["sizes not adding up to the total", (facts: BusinessFact[]) => { plus(find(facts, "business.turnover.size_small", 2020), "10"); }, /turnover sizes do not add up/],
  ["regions drifting from their recorded difference", (facts: BusinessFact[]) => { plus(find(facts, "business.turnover.region_guria", 2025), "0.1"); }, /turnover regions do not add up/],
  ["firm sections not adding up exactly", (facts: BusinessFact[]) => { plus(find(facts, "business.active.sector_unknown", 2020), "1"); }, /active sections do not add up/],
  ["a birth rate that disagrees with births per active firm", (facts: BusinessFact[]) => { setValue(find(facts, "business.birth_rate.total", 2020), "30.0"); }, /birth_rate is not births per 100 active firms/],
  ["a calculated status", (facts: BusinessFact[]) => { (find(facts, "business.turnover.total", 2020) as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a section O row", (facts: BusinessFact[]) => { facts.push({ ...find(facts, "business.active.sector_n", 2020), indicatorId: "business.active.sector_o" as BusinessIndicator }); }, /identity/],
  ["a changed anchor", (facts: BusinessFact[]) => { setValue(find(facts, "business.turnover.size_large", 2025), "173004.0"); }, /anchor/],
] as const)("validation rejects %s", async (_, mutate, error) => {
  const facts = (await loadFacts()).map(f => ({ ...f }));
  validateBusinessFacts(facts);
  mutate(facts);
  expect(() => validateBusinessFacts(facts)).toThrow(error);
});

test("loading serves the same 4,643 values as the canonical file", async () => {
  const facts = await loadBusinessFacts();
  expect(facts).toHaveLength(4643);
  expect(facts).toEqual(await loadFacts());
});

test("loading refuses a canonical file whose fingerprint differs from the report", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "business-"));
  try {
    await fs.mkdir(path.join(dir, "apps/web"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/imports"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/reports"), { recursive: true });
    const csv = await fs.readFile(path.join(root, "data/imports/business-annual.csv"), "utf8");
    const altered = csv.replace("253725.5", "253725.6");
    expect(altered).not.toBe(csv);
    await fs.writeFile(path.join(dir, "data/imports/business-annual.csv"), altered);
    await fs.copyFile(path.join(root, "data/reports/business-validation.json"), path.join(dir, "data/reports/business-validation.json"));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(path.join(dir, "apps/web"));
    try {
      await expect(loadBusinessFacts()).rejects.toThrow(/fingerprint/);
    } finally {
      cwd.mockRestore();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
  const facts = await loadFacts();
  const employed = facts.findIndex(f => f.indicatorId === "business.employed.total" && f.year === 2025);
  expect(facts[employed].value).toBe("899026");
  expect(() => assertBusinessParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
  const padded = facts.map(f => ({ ...f }));
  padded[employed].value = "899026.0";
  expect(() => assertBusinessParity(facts, padded)).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  changed[employed].value = "899027";
  changed[employed].publishedValue = "899027";
  expect(() => assertBusinessParity(facts, changed)).toThrow();
  expect(() => assertBusinessParity(facts, facts.slice(1))).toThrow();
});

test("client facts carry numeric values in lari, persons, firms or percent with their display precision", async () => {
  const facts = await loadFacts();
  expect(toClientBusinessFact(find(facts, "business.turnover.total", 2025))).toMatchObject({ year: 2025, indicatorId: "business.turnover.total", value: 253725500000, unit: "gel", decimals: 1 });
  expect(toClientBusinessFact(find(facts, "business.employed.total", 2025))).toMatchObject({ value: 899026, unit: "persons", decimals: 0 });
  expect(toClientBusinessFact(find(facts, "business.active.total", 2024))).toMatchObject({ value: 249236, unit: "enterprises", decimals: 0 });
  const rate = find(facts, "business.birth_rate.total", 2020);
  expect(toClientBusinessFact(rate)).toMatchObject({ value: Number(rate.publishedValue), unit: "percent", decimals: 1 });
});

test("the database mirror round-trips exact decimals and source relations", async () => {
  const facts = await loadFacts();
  const rows = businessMirrorCreateRows(facts, "business-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ businessFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "businessFact">;
  const mirror = await loadBusinessFactsFromMirror(db(rows));
  expect(() => assertBusinessParity(facts, mirror)).not.toThrow();
  expect(rows[0].importRunId).toBe("business-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadBusinessFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

test("every archived source has a source-document row", async () => {
  const csv = await fs.readFile(path.join(root, "data/sources/source-documents.csv"));
  const ids = new Set((parse(csv, { columns: true, bom: true }) as Record<string, string>[]).map(r => r.source_id));
  expect(BUSINESS_PUBLIC_SOURCES.filter(id => !ids.has(businessSourceDocumentId(id)))).toEqual([]);
});
