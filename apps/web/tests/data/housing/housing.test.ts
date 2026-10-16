import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { expect, test, vi } from "vitest";
import { BUSINESS_REGIONS } from "../../../lib/data/business/types";
import { assertHousingParity, loadHousingFacts, toClientHousingFact } from "../../../lib/data/housing/importHousing";
import { housingMirrorCreateRows, loadHousingFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { HOUSING_CSV_HEADERS, REVIEWED_AT, prepareHousingData } from "../../../lib/data/housing/prepareHousing";
import {
  HOUSING_DISTRICTS, HOUSING_INDICATORS, HOUSING_MEASURES, HOUSING_PUBLIC_SOURCES, HOUSING_REGIONS, HOUSING_SOURCES, HOUSING_TYPES,
  housingSourceDocumentId, type HousingFact, type HousingIndicator,
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

test("loading serves the same 3,222 values as the canonical file, keeping the trailing space of the 2012 sheet name", async () => {
  const facts = await loadHousingFacts();
  expect(facts).toHaveLength(3222);
  expect(facts).toEqual(await loadFacts());
  expect(find(facts, "housing.completed_count.type_residential", 2012).sourceSheet).toBe("2012 ");
});

test("loading refuses a canonical file whose fingerprint differs from the report", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "housing-"));
  try {
    await fs.mkdir(path.join(dir, "apps/web"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/imports"), { recursive: true });
    await fs.mkdir(path.join(dir, "data/reports"), { recursive: true });
    const csv = await fs.readFile(path.join(root, "data/imports/housing-annual.csv"), "utf8");
    const altered = csv.replace("2025,housing.permits_count.total,11578,11578", "2025,housing.permits_count.total,11579,11579");
    expect(altered).not.toBe(csv);
    await fs.writeFile(path.join(dir, "data/imports/housing-annual.csv"), altered);
    await fs.copyFile(path.join(root, "data/reports/housing-validation.json"), path.join(dir, "data/reports/housing-validation.json"));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(path.join(dir, "apps/web"));
    try {
      await expect(loadHousingFacts()).rejects.toThrow(/fingerprint/);
    } finally {
      cwd.mockRestore();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
  const facts = await loadFacts();
  const at = facts.findIndex(f => f.indicatorId === "housing.completed_count.total" && f.year === 2025);
  expect(facts[at].value).toBe("3393");
  expect(() => assertHousingParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
  const padded = facts.map(f => ({ ...f }));
  padded[at].value = "3393.0";
  expect(() => assertHousingParity(facts, padded)).not.toThrow();
  const changed = facts.map(f => ({ ...f }));
  changed[at].value = "3394";
  changed[at].publishedValue = "3394";
  expect(() => assertHousingParity(facts, changed)).toThrow();
  expect(() => assertHousingParity(facts, facts.slice(1))).toThrow();
});

test("client facts carry numeric values with their unit family and display precision", async () => {
  const facts = await loadFacts();
  expect(toClientHousingFact(find(facts, "housing.permits_area.total", 2025))).toMatchObject({ year: 2025, indicatorId: "housing.permits_area.total", value: 11397190, unit: "area", decimals: 0 });
  expect(toClientHousingFact(find(facts, "housing.price_index.total", 2025))).toMatchObject({ value: 159.4, unit: "index", decimals: 1 });
  expect(toClientHousingFact(find(facts, "housing.permits_count.total", 2025))).toMatchObject({ value: 11578, unit: "count", decimals: 0 });
  expect(toClientHousingFact(find(facts, "housing.price_flat.district_vake", 2025))).toMatchObject({ unit: "price", decimals: 0 });
});

test("the database mirror round-trips exact decimals, the 2012 sheet name and source relations", async () => {
  const facts = await loadFacts();
  const rows = housingMirrorCreateRows(facts, "housing-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const db = (list: typeof rows) => ({ housingFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "housingFact">;
  const mirror = await loadHousingFactsFromMirror(db(rows));
  expect(() => assertHousingParity(facts, mirror)).not.toThrow();
  expect(mirror).toEqual(facts);
  expect(rows[0].importRunId).toBe("housing-run-1");
  expect(rows.every(row => row.sourceDocumentId === `source.${row.sourceId}`)).toBe(true);
  await expect(loadHousingFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
});

test("every archived source has a source-document row", async () => {
  const csv = await fs.readFile(path.join(root, "data/sources/source-documents.csv"));
  const ids = new Set((parse(csv, { columns: true, bom: true }) as Record<string, string>[]).map(r => r.source_id));
  expect(HOUSING_PUBLIC_SOURCES.filter(id => !ids.has(housingSourceDocumentId(id)))).toEqual([]);
});
