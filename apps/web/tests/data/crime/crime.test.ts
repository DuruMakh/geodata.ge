import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { expect, test } from "vitest";
import type { BreakRow } from "../../../lib/data/demography/breaks";
import { CRIME_INDICATORS, CRIME_PUBLIC_SOURCES, CRIME_RESEARCH_DIRECTORY, CRIME_SOURCES, CRIME_UNITS, crimeFactKey, type CrimeFact, type CrimeSeriesBreak } from "../../../lib/data/crime/types";
import { CRIME_CSV_HEADERS, REVIEWED_AT, prepareCrimeData } from "../../../lib/data/crime/prepareCrime";
import { expectedCrimeKeys, validateCrimeFacts } from "../../../lib/data/crime/validation";

const root = path.resolve(process.cwd(), "../..");
const research = path.join(root, CRIME_RESEARCH_DIRECTORY);
const records = (file: string) => parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
const loadFacts = (): CrimeFact[] =>
  records(path.join(root, "data/imports/crime-annual.csv")).map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as CrimeFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as CrimeFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official", sourceId: row.source_id,
    sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
const find = (facts: readonly CrimeFact[], indicatorId: string, year: number) => facts.find(f => f.indicatorId === indicatorId && f.year === year)!;
/** Changes a value and keeps its published text consistent, so only a cross-check can notice. */
const setValue = (fact: CrimeFact, value: string) => Object.assign(fact, { value, publishedValue: value });
const plusOne = (fact: CrimeFact) => setValue(fact, String(Number(fact.value) + 1));

test("the canonical file carries the package's 1,262 observations and prepare check passes", async () => {
  const report = JSON.parse(fs.readFileSync(path.join(research, "validation-report.json"), "utf8")) as { primary_observation_count: number };
  const facts = loadFacts();
  expect(report.primary_observation_count).toBe(1262);
  expect(facts).toHaveLength(report.primary_observation_count);
  expect(expectedCrimeKeys(root).size).toBe(facts.length);
  expect(new Set(facts.map(f => f.indicatorId))).toEqual(new Set(CRIME_INDICATORS));
  expect(new Set(facts.map(f => f.unit))).toEqual(new Set(CRIME_UNITS));
  expect(new Set(facts.map(f => f.sourceId))).toEqual(new Set(CRIME_SOURCES));
  expect(CRIME_SOURCES.every(id => CRIME_PUBLIC_SOURCES.includes(id))).toBe(true);
  expect(CRIME_PUBLIC_SOURCES).toHaveLength(22);
  expect(new Set(facts.map(crimeFactKey)).size).toBe(facts.length);
  expect(Math.max(...facts.map(f => f.year))).toBe(2025);
  expect(() => validateCrimeFacts(facts, root)).not.toThrow();
  await expect(prepareCrimeData(root, "check")).resolves.toBeUndefined();
});

test("every row is the package row, plus the review date", () => {
  const canonical = records(path.join(root, "data/imports/crime-annual.csv"));
  const original = records(path.join(research, "crime-annual.csv"));
  expect(Object.keys(canonical[0])).toEqual(CRIME_CSV_HEADERS);
  expect(canonical.map(({ last_reviewed_at, ...row }) => row)).toEqual(original);
  expect(new Set(canonical.map(row => row.last_reviewed_at))).toEqual(new Set([REVIEWED_AT]));
  expect(fs.readFileSync(path.join(root, "data/imports/crime-annual.csv")).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
});

test("the series breaks are the package's two counting changes, copied as is", () => {
  const copy = path.join(root, "data/imports/crime-series-breaks.csv");
  expect(fs.readFileSync(copy)).toEqual(fs.readFileSync(path.join(research, "crime-series-breaks.csv")));
  const breaks: CrimeSeriesBreak[] = records(copy).map((row): BreakRow => ({ breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note }));
  expect(breaks.map(b => b.breakId)).toEqual(["registration_2018", "drunk_driving_coverage_2025"]);
  expect(breaks[0].appliesTo).toHaveLength(12);
  expect(breaks[1].appliesTo).toEqual(["crime.road.accidents_drunk"]);
  expect(breaks.every(b => b.appliesTo.every(id => (CRIME_INDICATORS as readonly string[]).includes(id)))).toBe(true);
});

test.each([
  ["an altered published value", (facts: CrimeFact[]) => { facts[0].publishedValue = "1"; }, /published value/],
  ["a duplicate observation", (facts: CrimeFact[]) => { facts.push({ ...facts[0] }); }, /Duplicate/],
  ["a missing observation", (facts: CrimeFact[]) => { facts.pop(); }, /Incomplete/],
  ["a 2014 recorded-crimes row", (facts: CrimeFact[]) => { facts.push({ ...find(facts, "crime.recorded.total", 2015), year: 2014 }); }, /outside the approved coverage/],
  ["a 2013 victims row", (facts: CrimeFact[]) => { facts.push({ ...find(facts, "crime.victims.total", 2011), year: 2013 }); }, /outside the approved coverage/],
  ["a 2009 pretrial prison row", (facts: CrimeFact[]) => { facts.push({ ...find(facts, "crime.prison.pretrial", 2010), year: 2009 }); }, /outside the approved coverage/],
  ["a 2002 drunk-driving row", (facts: CrimeFact[]) => { facts.push({ ...find(facts, "crime.road.accidents_drunk", 2003), year: 2002 }); }, /outside the approved coverage/],
  ["a 2026 row", (facts: CrimeFact[]) => { facts.push({ ...find(facts, "crime.recorded.total", 2025), year: 2026 }); }, /outside the approved coverage/],
  ["an unknown indicator", (facts: CrimeFact[]) => { facts.push({ ...facts[0], indicatorId: "crime.recorded.unknown" as CrimeFact["indicatorId"] }); }, /Invalid crime identity/],
  ["convicted types that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.convicted.type_theft", 2025)); }, /convicts by type do not add up/i],
  ["convicted ages that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.convicted.age_30_49", 2001)); }, /convicts by age do not add up/i],
  ["convicted sexes that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.convicted.sex_men", 2010)); }, /convicts by sex do not add up/i],
  ["convicted sentences that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.convicted.sentence_fine", 2025)); }, /convicts by sentence do not add up/i],
  ["recorded groups that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.recorded.property", 2018)); }, /recorded crime groups do not add up/i],
  ["prison sexes that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.prison.women", 2001)); }, /women and men do not add up/],
  ["prison ages that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.prison.juveniles", 2025)); }, /adults and juveniles do not add up/],
  ["prison convicted and defendants that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.prison.pretrial", 2010)); }, /convicted and defendants do not add up/],
  ["victims by citizenship that do not add up", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.victims.citizenship_foreign", 2025)); }, /victims by citizenship do not add up/i],
  ["an altered anchor value", (facts: CrimeFact[]) => { plusOne(find(facts, "crime.road.killed", 2025)); }, /anchor/],
  ["a calculated status", (facts: CrimeFact[]) => { (facts[0] as { valueStatus: string }).valueStatus = "calculated"; }, /source contract/],
  ["a planned basis", (facts: CrimeFact[]) => { (facts[0] as { basis: string }).basis = "planned"; }, /source contract/],
  ["a wrong unit", (facts: CrimeFact[]) => { facts[0].unit = "persons"; }, /source contract/],
  ["a wrong source", (facts: CrimeFact[]) => { find(facts, "crime.victims.total", 2025).sourceId = "geostat_crime_road"; }, /source contract/],
  ["a fraction", (facts: CrimeFact[]) => { setValue(find(facts, "crime.road.killed", 2020), "10.5"); }, /Invalid crime value/],
  ["a negative value", (facts: CrimeFact[]) => { setValue(find(facts, "crime.road.killed", 2020), "-1"); }, /Invalid crime value/],
  ["a placeholder value", (facts: CrimeFact[]) => { setValue(find(facts, "crime.road.killed", 2020), "..."); }, /Invalid crime value/],
] as const)("validation rejects %s", (_, mutate, error) => {
  const facts = loadFacts().map(f => ({ ...f }));
  mutate(facts);
  expect(() => validateCrimeFacts(facts, root)).toThrow(error);
});

test("a real zero is a value, and a gap is no row", () => {
  const facts = loadFacts();
  expect(facts.filter(f => f.value === "0").length).toBeGreaterThan(0);
  expect(facts.some(f => f.indicatorId === "crime.victims.total" && f.year >= 2012 && f.year <= 2014)).toBe(false);
  expect(facts.some(f => f.indicatorId === "crime.road.accidents_drunk" && f.year === 2002)).toBe(false);
  expect(() => validateCrimeFacts(facts, root)).not.toThrow();
});
