import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import type { BreakRow } from "../../../lib/data/demography/breaks";
import { HEALTH_AREAS, HEALTH_INDICATORS, HEALTH_PUBLIC_SOURCES, HEALTH_SOURCES, HEALTH_UNITS, type HealthFact, type HealthSeriesBreak } from "../../../lib/data/health/types";
import { HEALTH_CSV_HEADERS, prepareHealthData } from "../../../lib/data/health/prepareHealth";
import { expectedHealthKeys, healthDisplayDecimals, healthPublishedValue, validateHealthFacts } from "../../../lib/data/health/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, "docs/Raw Data/Health/geostat-health-annual");
const records = (file: string) => parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = (): HealthFact[] =>
  records(path.join(root, "data/imports/health-annual.csv")).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as HealthFact["indicatorId"], areaId: row.area_id as HealthFact["areaId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as HealthFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "published", sourceId: row.source_id,
    sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly HealthFact[], indicatorId: string, year: number, areaId = "georgia") => facts.find(f => f.indicatorId === indicatorId && f.year === year && f.areaId === areaId)!;
/** Changes a value and keeps its published text consistent, so only a cross-check can notice. */
const setValue = (fact: HealthFact, value: string) => Object.assign(fact, { value, publishedValue: healthPublishedValue(fact.unit, value, fact.sourceNumberFormat) });

test("the canonical file carries the package's 4,204 observations", async () => {
  const report = JSON.parse(fs.readFileSync(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  const facts = loadFacts();
  expect(report.primary_observation_count).toBe(4204);
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(expectedHealthKeys().size).toBe(facts.length);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(HEALTH_INDICATORS));
  expect(new Set(facts.map(f => f.areaId))).toEqual(new Set(HEALTH_AREAS));
  expect(new Set(facts.map(f => f.unit))).toEqual(new Set(HEALTH_UNITS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(HEALTH_SOURCES));
  expect(HEALTH_SOURCES.every(id => HEALTH_PUBLIC_SOURCES.includes(id))).toBe(true);
  expect(HEALTH_PUBLIC_SOURCES).toHaveLength(36);
  expect(() => validateHealthFacts(facts)).not.toThrow();
  await expect(prepareHealthData(root, "check")).resolves.toBeUndefined();
});

test("every row is the package row, plus the review date", () => {
  const canonical = records(path.join(root, "data/imports/health-annual.csv"));
  const original = records(path.join(research, "health-annual.csv"));
  expect(Object.keys(canonical[0])).toEqual(HEALTH_CSV_HEADERS);
  expect(canonical.map(({ last_reviewed_at, ...row }) => row)).toEqual(original);
  expect(new Set(canonical.map(row => row.last_reviewed_at))).toEqual(new Set(["2026-10-15"]));
  expect(fs.readFileSync(path.join(root, "data/imports/health-annual.csv")).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
});

test("the series breaks are the package's four counting changes, copied as is", () => {
  const copy = path.join(root, "data/imports/health-series-breaks.csv");
  expect(fs.readFileSync(copy)).toEqual(fs.readFileSync(path.join(research, "health-series-breaks.csv")));
  const breaks: HealthSeriesBreak[] = records(copy).map((row): BreakRow => ({ breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note }));
  expect(breaks.map(b => b.breakId)).toEqual(["staff_definitions_2012", "staff_register_2020", "icd10_groups_2006", "new_cases_electronic_2020"]);
  expect(breaks.every(b => b.appliesTo.every(id => (HEALTH_INDICATORS as readonly string[]).includes(id)))).toBe(true);
});

test("all-deaths values equal the Population page's deaths where both exist", () => {
  const population = new Map(records(path.join(root, "data/imports/demography-vital-annual.csv")).filter(row => row.series_id === "demography.deaths").map(row => [`${row.geography_id}:${row.year}`, row.value]));
  let checked = 0;
  for (const fact of loadFacts().filter(f => f.indicatorId === "health.deaths.total")) {
    const other = population.get(`${fact.areaId === "georgia" ? "country.georgia" : fact.areaId}:${fact.year}`);
    if (other === undefined) continue; // the Population pages serve no regional 2014
    expect(new Decimal(other).eq(fact.value), `${fact.areaId} ${fact.year}`).toBe(true);
    checked += 1;
  }
  expect(checked).toBe(12 + 11 * 11);
});

describe("the published value rule", () => {
  test.each([
    ["#\\ ##0", "22491", "persons", 0],
    ["0.0", "44.2", "per_1000_population", 1],
    ["General", "500.359", "persons_thousand", 3],
    ["0.0", "500.35899999999998", "persons_thousand", 3],
    ["#,##0", "15.232", "units_thousand", 3],
    ["General", "934", "persons", 0],
  ] as const)("%s %s %s shows %i decimals", (format, value, unit, decimals) => {
    expect(healthDisplayDecimals(format, value, unit)).toBe(decimals);
  });
  test("rates and counts round half up, thousands keep the stored value to 15 digits", () => {
    expect(healthPublishedValue("per_1000_population", "10.45", "#,##0.0")).toBe("10.5");
    expect(healthPublishedValue("per_1000_population", "11.260579422224215", "#,##0.0")).toBe("11.3");
    expect(healthPublishedValue("per_1000_population", "13", "0.0")).toBe("13.0");
    expect(healthPublishedValue("persons", "2.5", "#\\ ##0")).toBe("3");
    expect(healthPublishedValue("persons", "1234", "General")).toBe("1234");
    expect(healthPublishedValue("units_thousand", "7.0919999999999996", "0.0")).toBe("7.092");
    expect(healthPublishedValue("visits_thousand", "16760.072", "#\\ ##0")).toBe("16760.072");
  });
  test("rejects a number format the unit does not use", () => {
    expect(() => healthPublishedValue("persons", "1", "0.0")).toThrow(/number format/);
    expect(() => healthPublishedValue("per_1000_population", "1", "General")).toThrow(/number format/);
    expect(() => healthPublishedValue("persons_thousand", "1", "0.00")).toThrow(/number format/);
  });
});

test.each([
  ["an altered published value", (facts: HealthFact[]) => { facts[0].publishedValue = "0.1"; }, /published value/],
  ["a duplicate observation", (facts: HealthFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: HealthFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2013 all-deaths row", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.deaths.total", 2014), year: 2013 }); }, /outside the approved coverage/],
  ["a 2019 covid19 deaths row", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.deaths.covid19", 2020), year: 2019 }); }, /outside the approved coverage/],
  ["a 2026 illness row", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.illness.diabetes", 2025), year: 2026 }); }, /outside the approved coverage/],
  ["a diabetes row before 2016", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.illness.diabetes", 2016), year: 2015 }); }, /outside the approved coverage/],
  ["an unknown indicator", (facts: HealthFact[]) => { facts.push({ ...facts[0], indicatorId: "health.illness.covid19" as HealthFact["indicatorId"] }); }, /Invalid health identity/],
  ["a regional staff row", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.staff.doctors", 2025), areaId: "region.guria" }); }, /outside the approved coverage/],
  ["an Abkhazia area", (facts: HealthFact[]) => { facts.push({ ...find(facts, "health.deaths.total", 2025), areaId: "region.abkhazia" as HealthFact["areaId"] }); }, /Invalid health identity/],
  ["causes that do not add up", (facts: HealthFact[]) => { setValue(find(facts, "health.deaths.circulatory", 2025, "region.guria"), "999"); }, /causes do not add up/],
  ["regions that do not add up", (facts: HealthFact[]) => {
    setValue(find(facts, "health.deaths.total", 2025), String(Number(find(facts, "health.deaths.total", 2025).value) + 1));
    setValue(find(facts, "health.deaths.ill_defined", 2025), String(Number(find(facts, "health.deaths.ill_defined", 2025).value) + 1));
  }, /regions do not add up/],
  ["specialities that do not add up to doctors", (facts: HealthFact[]) => { setValue(find(facts, "health.staff.doctors_surgery", 2010), String(Number(find(facts, "health.staff.doctors_surgery", 2010).value) + 1)); }, /specialities do not add up/],
  ["an altered anchor value", (facts: HealthFact[]) => { setValue(find(facts, "health.facilities.hospitals", 2025), "233"); }, /anchor/],
  ["a calculated status", (facts: HealthFact[]) => { (facts[0] as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a planned basis", (facts: HealthFact[]) => { (facts[0] as { basis: string }).basis = "planned"; }, /source contract/],
  ["a wrong unit", (facts: HealthFact[]) => { facts[0].unit = "persons"; }, /source contract/],
  ["a wrong source", (facts: HealthFact[]) => { find(facts, "health.staff.nurses", 2020).sourceId = "geostat_health_physicians"; }, /source contract/],
  ["a negative value", (facts: HealthFact[]) => { Object.assign(find(facts, "health.facilities.hospitals", 2020), { value: "-1", publishedValue: "-1" }); }, /range/],
  ["a non-numeric value", (facts: HealthFact[]) => { find(facts, "health.facilities.hospitals", 2020).value = "n/a"; }, /Invalid health value/],
  ["a non-numeric published value", (facts: HealthFact[]) => { facts[0].publishedValue = "n/a"; }, /published value/],
] as const)("validation rejects %s", (_, mutate, error) => {
  const facts = loadFacts().map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateHealthFacts(facts)).toThrow(error);
});

test("a real zero is a value", () => {
  const facts = loadFacts();
  expect(facts.filter(f => f.value === "0").length).toBeGreaterThan(0);
  expect(() => validateHealthFacts(facts)).not.toThrow();
});
