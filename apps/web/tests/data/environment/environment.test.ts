import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import { environmentMirrorCreateRows, loadEnvironmentFactsFromMirror } from "../../../lib/db/mirrorRows";
import type { Prisma } from "../../../lib/generated/prisma/client";
import { assertEnvironmentParity, loadEnvironmentFacts, toClientEnvironmentFact } from "../../../lib/data/environment/importEnvironment";
import { ENVIRONMENT_CSV_HEADERS, REVIEWED_AT, environmentCellValue, prepareEnvironmentData } from "../../../lib/data/environment/prepareEnvironment";
import {
  ENVIRONMENT_INDICATORS, ENVIRONMENT_PUBLIC_SOURCES, ENVIRONMENT_RESEARCH_DIRECTORY, ENVIRONMENT_SOURCES, ENVIRONMENT_UNITS, environmentFactKey, environmentSourceDocumentId, type EnvironmentFact,
} from "../../../lib/data/environment/types";
import { expectedEnvironmentKeys, validateEnvironmentFacts } from "../../../lib/data/environment/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, ENVIRONMENT_RESEARCH_DIRECTORY);
const canonicalFile = path.join(root, "data/imports/environment-annual.csv");
const records = (file: string) => parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = (): EnvironmentFact[] =>
  records(canonicalFile).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id, value: row.value, publishedValue: row.published_value,
    unit: row.unit as EnvironmentFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official", sourceId: row.source_id,
    sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly EnvironmentFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Changes a value and keeps its published text consistent, so only a cross-check can notice. */
const setValue = (fact: EnvironmentFact, value: string) => Object.assign(fact, { value, publishedValue: value });
const plus = (fact: EnvironmentFact, step: number) => setValue(fact, String(Number(fact.value) + step));

test("the canonical file carries the package's 2,125 observations and prepare check passes", async () => {
  const report = JSON.parse(fs.readFileSync(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  const facts = loadFacts();
  expect(report.primary_observation_count).toBe(2125);
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(expectedEnvironmentKeys(root).size).toBe(facts.length);
  // Geostat prints no timber cut in Tbilisi, so that one indicator has no rows.
  expect([...new Set(ENVIRONMENT_INDICATORS)].filter(id => !facts.some(f => f.indicatorId === id))).toEqual(["environment.forest.timber_cut.region_tbilisi"]);
  expect(new Set(facts.map(f => f.unit))).toEqual(new Set(ENVIRONMENT_UNITS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(ENVIRONMENT_SOURCES));
  expect(ENVIRONMENT_PUBLIC_SOURCES).toHaveLength(46);
  expect(new Set(facts.map(environmentFactKey)).size).toBe(facts.length);
  expect([Math.min(...facts.map(f => f.year)), Math.max(...facts.map(f => f.year))]).toEqual([1990, 2025]);
  expect(() => validateEnvironmentFacts(facts, root)).not.toThrow();
  await expect(prepareEnvironmentData(root, "check")).resolves.toBeUndefined();
});

test("every row is the package row without its decimals column, plus the review date", () => {
  const canonical = records(canonicalFile);
  const original = records(path.join(research, "environment-annual.csv"));
  expect(Object.keys(canonical[0])).toEqual(ENVIRONMENT_CSV_HEADERS);
  expect(canonical.map(({ last_reviewed_at, ...row }) => row)).toEqual(original.map(({ decimals, ...row }) => row));
  // The dropped column is what the published text already says.
  expect(original.every(row => Number(row.decimals) === (row.published_value.split(".")[1]?.length ?? 0))).toBe(true);
  expect(new Set(canonical.map(row => row.last_reviewed_at))).toEqual(new Set([REVIEWED_AT]));
  expect(fs.readFileSync(canonicalFile).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
});

test("a cell is its rounded number, a footnoted number, or a nil dash only in the logging table", () => {
  const number = (v: number): XLSX.CellObject => ({ t: "n", v });
  const text = (v: string): XLSX.CellObject => ({ t: "s", v });
  expect(environmentCellValue(number(-6.699999999999999), "geostat_env_ghg")).toBe("-6.7");
  expect(environmentCellValue(number(31), "geostat_env_air_quality")).toBe("31");
  expect(environmentCellValue(text("47*"), "geostat_env_air_quality")).toBe("47");
  expect(environmentCellValue(text("-"), "geostat_env_illegal_logging")).toBe("0");
  for (const placeholder of ["-", "…", "...", ""]) expect(environmentCellValue(text(placeholder), "geostat_env_waste")).toBeUndefined();
  expect(environmentCellValue(text("…"), "geostat_env_illegal_logging")).toBeUndefined();
  expect(environmentCellValue(undefined, "geostat_env_ghg")).toBeUndefined();
});

test.each([
  ["an altered published value", (facts: EnvironmentFact[]) => { facts[0].publishedValue = "1"; }, /published value/],
  ["a duplicate observation", (facts: EnvironmentFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: EnvironmentFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 1999 greenhouse gas row", (facts: EnvironmentFact[]) => { facts.push({ ...find(facts, "environment.ghg.total", 2000), year: 1999 }); }, /outside the approved coverage/],
  ["a 1996 climate row, a year Geostat does not print", (facts: EnvironmentFact[]) => { facts.push({ ...find(facts, "environment.climate.temperature.georgia", 1995), year: 1996 }); }, /outside the approved coverage/],
  ["a 0 written over a station's … year", (facts: EnvironmentFact[]) => { facts.push(setValue({ ...find(facts, "environment.aq.pm10_avg.tbilisi_a4", 2025), year: 2024 }, "0")); }, /outside the approved coverage/],
  ["a 2026 row", (facts: EnvironmentFact[]) => { facts.push({ ...find(facts, "environment.water.lost", 2025), year: 2026 }); }, /outside the approved coverage/],
  ["an unknown indicator", (facts: EnvironmentFact[]) => { facts.push({ ...facts[0], indicatorId: "environment.ghg.unknown" }); }, /Invalid environment identity/],
  ["sectors that no longer add up", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.ghg.sector_energy", 2010), 1); }, /sectors do not add up: 2010/],
  ["energy parts that no longer add up", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.ghg.energy_transport", 2015), 1); }, /Energy emissions do not add up: 2015/],
  ["gases that no longer add up", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.ghg.gas_hfcs", 2020), 500); }, /Greenhouse gases do not add up: 2020/],
  ["a land-use net that no longer adds up", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.ghg.net", 2005), 1); }, /Total and land use do not add up: 2005/],
  ["air sources that no longer add up", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.air.co.stationary", 2024), 1); }, /co sources do not add up: 2024/],
  ["water losses that no longer add up", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.water.net", 2025), 1); }, /losses and net volume do not add up: 2025/],
  ["waste regions that no longer add up", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.waste.collected.region_imereti", 2024), 1); }, /Waste regions do not add up: 2024/],
  ["timber areas that no longer add up", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.forest.timber_cut.region_kakheti", 2024), 3); }, /timber_cut areas do not add up: 2024/],
  ["an altered anchor value", (facts: EnvironmentFact[]) => { plus(find(facts, "environment.aq.pm10_days.kutaisi_b1", 2025), 1); }, /anchor/],
  ["a trailing zero", (facts: EnvironmentFact[]) => { setValue(find(facts, "environment.aq.pm10_days.kutaisi_b1", 2024), `${find(facts, "environment.aq.pm10_days.kutaisi_b1", 2024).value}.0`); }, /Invalid environment value/],
  ["more than 12 significant digits", (facts: EnvironmentFact[]) => { setValue(find(facts, "environment.aq.pm10_days.kutaisi_b1", 2024), "12.3456789012345"); }, /Invalid environment value/],
  ["a placeholder value", (facts: EnvironmentFact[]) => { setValue(find(facts, "environment.aq.pm10_days.kutaisi_b1", 2024), "…"); }, /Invalid environment value/],
  ["a calculated status", (facts: EnvironmentFact[]) => { (facts[0] as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a planned basis", (facts: EnvironmentFact[]) => { (facts[0] as { basis: string }).basis = "planned"; }, /source contract/],
  ["a wrong unit", (facts: EnvironmentFact[]) => { find(facts, "environment.ghg.gas_sf6", 2020).unit = "mt_co2e"; }, /source contract/],
  ["a wrong source", (facts: EnvironmentFact[]) => { find(facts, "environment.water.lost_share", 2025).sourceId = "geostat_env_water_supply"; }, /source contract/],
] as const)("validation rejects %s", (_, mutate, error) => {
  const facts = loadFacts().map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateEnvironmentFacts(facts, root)).toThrow(error);
});

test("a real zero and a negative are values, and a gap is no row", () => {
  const facts = loadFacts();
  expect(facts.filter(f => f.indicatorId.startsWith("environment.forest.illegal_logging.") && f.value === "0").length).toBeGreaterThan(0);
  expect(find(facts, "environment.ghg.sector_land", 2022).value).toBe("-5.8");
  expect(facts.some(f => f.indicatorId === "environment.aq.pm10_avg.tbilisi_a4" && f.year === 2024)).toBe(false);
});

describe("loading and parity", () => {
  test("loadEnvironmentFacts serves the canonical rows and rejects a file that no longer matches its acceptance fingerprint", async () => {
    await expect(loadEnvironmentFacts()).resolves.toHaveLength(2125);
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), "environment-"));
    try {
      for (const relative of ["data/imports/environment-annual.csv", "data/reports/environment-validation.json", path.join(ENVIRONMENT_RESEARCH_DIRECTORY, "coverage.csv")]) {
        fs.mkdirSync(path.dirname(path.join(copy, relative)), { recursive: true });
        fs.copyFileSync(path.join(root, relative), path.join(copy, relative));
      }
      await expect(loadEnvironmentFacts(copy)).resolves.toHaveLength(2125);
      fs.appendFileSync(path.join(copy, "data/imports/environment-annual.csv"), "\n");
      await expect(loadEnvironmentFacts(copy)).rejects.toThrow(/fingerprint/);
    } finally {
      fs.rmSync(copy, { recursive: true, force: true });
    }
  });

  test("prepare rejects a package value that is not its workbook cell", async () => {
    const copy = fs.mkdtempSync(path.join(os.tmpdir(), "environment-"));
    try {
      fs.cpSync(research, path.join(copy, ENVIRONMENT_RESEARCH_DIRECTORY), { recursive: true });
      const file = path.join(copy, ENVIRONMENT_RESEARCH_DIRECTORY, "environment-annual.csv");
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("2000,environment.ghg.total,11.4,11.4,", "2000,environment.ghg.total,11.5,11.5,"));
      await expect(prepareEnvironmentData(copy, "check")).rejects.toThrow(/source cell mismatch: geostat_env_ghg:B-3:C10/);
    } finally {
      fs.rmSync(copy, { recursive: true, force: true });
    }
  });

  test("parity accepts equal decimals written differently and rejects a changed or missing value", async () => {
    const facts = await loadEnvironmentFacts();
    expect(() => assertEnvironmentParity(facts, facts.map(f => ({ ...f })))).not.toThrow();
    const padded = facts.map(f => ({ ...f }));
    Object.assign(find(padded, "environment.ghg.sector_land", 2022), { value: "-5.80", publishedValue: "-5.800" });
    expect(() => assertEnvironmentParity(facts, padded)).not.toThrow();
    const changed = facts.map(f => ({ ...f }));
    plus(find(changed, "environment.aq.pm10_days.kutaisi_b1", 2025), 1);
    expect(() => assertEnvironmentParity(facts, changed)).toThrow();
    expect(() => assertEnvironmentParity(facts, facts.slice(1))).toThrow();
  });

  test("client facts carry the published number with its printed decimals and nothing internal", async () => {
    const facts = await loadEnvironmentFacts();
    expect(toClientEnvironmentFact(find(facts, "environment.ghg.sector_land", 2022))).toEqual({
      year: 2022, indicatorId: "environment.ghg.sector_land", sourceId: "geostat_env_ghg", unit: "mt_co2e", value: -5.8, decimals: 1,
    });
    expect(toClientEnvironmentFact(find(facts, "environment.aq.pm10_avg.tbilisi_a1", 2025))).toMatchObject({ value: 31, decimals: 0 });
    expect(facts.every(f => toClientEnvironmentFact(f).value === Number(f.publishedValue))).toBe(true);
    expect(Object.keys(toClientEnvironmentFact(facts[0])).sort()).toEqual(["decimals", "indicatorId", "sourceId", "unit", "value", "year"]);
  });

  test("the database mirror round-trips exact decimals and source relations for every unit", async () => {
    const facts = await loadEnvironmentFacts();
    // The database returns Decimal(40, 30) values; Decimal keeps "-5.8" and "376215" as written.
    const rows = environmentMirrorCreateRows(facts, "environment-run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
    const db = (list: typeof rows) => ({ environmentFact: { findMany: async () => list } }) as unknown as Pick<Prisma.TransactionClient, "environmentFact">;
    const mirror = await loadEnvironmentFactsFromMirror(db(rows));
    expect(() => assertEnvironmentParity(facts, mirror)).not.toThrow();
    const byKey = new Map(mirror.map(f => [environmentFactKey(f), f]));
    for (const unit of ENVIRONMENT_UNITS) {
      const fact = facts.find(f => f.unit === unit)!;
      expect(byKey.get(environmentFactKey(fact)), unit).toEqual(fact);
      expect(toClientEnvironmentFact(byKey.get(environmentFactKey(fact))!), unit).toEqual(toClientEnvironmentFact(fact));
    }
    expect(rows[0].importRunId).toBe("environment-run-1");
    expect(rows.every(row => row.sourceDocumentId === environmentSourceDocumentId(row.sourceId))).toBe(true);
    await expect(loadEnvironmentFactsFromMirror(db([{ ...rows[0], sourceDocumentId: "source.other" }]))).rejects.toThrow(/source relation/);
  });
});
