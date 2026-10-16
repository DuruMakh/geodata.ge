import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import {
  CRIME_INDICATORS, CRIME_RESEARCH_DIRECTORY, CRIME_SOURCES, CRIME_UNITS, crimeFactKey,
  type CrimeFact, type CrimeIndicator, type CrimeUnit,
} from "./types";

const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const named = (prefix: string) => CRIME_INDICATORS.filter(id => id.startsWith(prefix));
const RECORDED_GROUPS = named("crime.recorded.").filter(id => id !== "crime.recorded.total");

/** Years that a series prints between its first and last served year but carries no value for: no row, never a zero. */
const GAPS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ["crime.road.accidents_drunk", [2002]],
  ["crime.victims.", range(2012, 2014)],
];

/** Every key the serving package must contain, exactly once, from the research package's `coverage.csv`. */
export function expectedCrimeKeys(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Set<string> {
  const file = path.join(/* turbopackIgnore: true */ repositoryRoot, CRIME_RESEARCH_DIRECTORY, "coverage.csv");
  const keys = new Set<string>();
  for (const line of parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]) {
    const first = Number(line.first_year), last = Number(line.last_year);
    // `unavailable_years` is a `;`-separated list of years and ranges, such as "2012-2014" or "2002".
    const unavailable = new Set((line.unavailable_years ? line.unavailable_years.split(";") : []).flatMap(part => {
      const [from, to = from] = part.split("-").map(Number);
      return range(from, to);
    }));
    const years = range(first, last).filter(year => !unavailable.has(year));
    if (!(CRIME_INDICATORS as readonly string[]).includes(line.indicator_id) || Number(line.observations) !== years.length) {
      throw new Error(`Invalid crime coverage line: ${line.indicator_id}`);
    }
    for (const year of years) keys.add(`${line.indicator_id}:${year}`);
  }
  return keys;
}

const TYPES = "geostat_crime_convicts_types", AGE_SEX = "geostat_crime_convicts_age_sex", PENALTIES = "geostat_crime_convicts_penalties";
/** The workbook and unit each indicator is read in. */
function contractOf(indicatorId: CrimeIndicator): { sourceId: string; unit: CrimeUnit } {
  const [, topic, item] = indicatorId.split(".");
  if (topic === "recorded") return { sourceId: "geostat_crime_recorded", unit: "crimes" };
  if (topic === "convicted") {
    if (item.startsWith("age_") || item.startsWith("sex_")) return { sourceId: AGE_SEX, unit: "persons" };
    return { sourceId: item.startsWith("sentence_") ? PENALTIES : TYPES, unit: "persons" };
  }
  if (topic === "prison") return { sourceId: "geostat_crime_prison", unit: "persons" };
  if (topic === "victims") return { sourceId: "geostat_crime_victims", unit: "persons" };
  return { sourceId: "geostat_crime_road", unit: item.startsWith("accidents") ? "accidents" : "persons" };
}

/** The design spec's anchor values (published text), which a rule change must not move. */
const ANCHORS: ReadonlyArray<readonly [CrimeIndicator, number, string]> = [
  ["crime.recorded.total", 2015, "35096"], ["crime.recorded.total", 2018, "58412"], ["crime.recorded.total", 2025, "54134"],
  ["crime.recorded.property", 2025, "17251"], ["crime.convicted.total", 2001, "8897"], ["crime.convicted.total", 2025, "22767"],
  ["crime.convicted.sentence_prison", 2025, "5793"], ["crime.prison.total", 2011, "24114"], ["crime.prison.total", 2025, "11153"],
  ["crime.victims.total", 2025, "17209"], ["crime.road.accidents", 2025, "5969"], ["crime.road.killed", 2025, "469"],
  ["crime.road.injured", 2025, "8191"],
];

export function validateCrimeFacts(facts: readonly CrimeFact[], repositoryRoot?: string): void {
  const expected = expectedCrimeKeys(repositoryRoot);
  const seen = new Map<string, number>();
  for (const fact of facts) {
    const key = crimeFactKey(fact);
    if (!CRIME_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid crime identity: ${key}`);
    if (!expected.has(key)) throw new Error(`Crime observation outside the approved coverage: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate crime observation: ${key}`);
    const contract = contractOf(fact.indicatorId);
    if (
      !CRIME_UNITS.includes(fact.unit) || fact.unit !== contract.unit || fact.basis !== "actual" || fact.valueStatus !== "official" ||
      fact.sourceId !== contract.sourceId || !CRIME_SOURCES.includes(fact.sourceId) || !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)
    ) throw new Error(`Invalid crime source contract: ${key}`);
    // Every served cell is a whole count; a fraction, a sign or a Geostat placeholder is no value.
    if (!/^\d{1,15}$/.test(fact.value)) throw new Error(`Invalid crime value: ${key}`);
    if (fact.publishedValue !== fact.value) throw new Error(`Crime published value does not match its stored value: ${key}`);
    seen.set(key, Number(fact.value));
  }
  const missing = [...expected].filter(key => !seen.has(key));
  if (missing.length) throw new Error(`Incomplete crime coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const id of CRIME_SOURCES) if (!facts.some(f => f.sourceId === id)) throw new Error(`Crime source missing from the serving package: ${id}`);
  for (const [prefix, years] of GAPS) {
    for (const fact of facts) if (fact.indicatorId.startsWith(prefix) && years.includes(fact.year)) throw new Error(`Crime value served in a gap year: ${crimeFactKey(fact)}`);
  }

  const value = (indicator: string, year: number) => seen.get(`${indicator}:${year}`)!;
  const sum = (indicators: readonly string[], year: number) => indicators.reduce((total, id) => total + value(id, year), 0);
  const yearsOf = (indicator: string) => facts.filter(f => f.indicatorId === indicator).map(f => f.year);
  for (const year of yearsOf("crime.recorded.total")) {
    if (sum(RECORDED_GROUPS, year) !== value("crime.recorded.total", year)) throw new Error(`Recorded crime groups do not add up to all recorded crimes: ${year}`);
  }
  for (const year of yearsOf("crime.convicted.total")) {
    for (const kind of ["type", "age", "sex", "sentence"]) {
      if (sum(named(`crime.convicted.${kind}_`), year) !== value("crime.convicted.total", year)) throw new Error(`Convicts by ${kind} do not add up to the total: ${year}`);
    }
  }
  for (const year of yearsOf("crime.prison.total")) {
    const total = value("crime.prison.total", year);
    if (value("crime.prison.women", year) + value("crime.prison.men", year) !== total) throw new Error(`Prison women and men do not add up to the total: ${year}`);
    if (value("crime.prison.adults", year) + value("crime.prison.juveniles", year) !== total) throw new Error(`Prison adults and juveniles do not add up to the total: ${year}`);
    if (year >= 2010 && value("crime.prison.sentenced", year) + value("crime.prison.pretrial", year) !== total) throw new Error(`Prison convicted and defendants do not add up to the total: ${year}`);
  }
  for (const year of yearsOf("crime.victims.total")) {
    for (const kind of ["sex", "age", "citizenship"]) {
      if (sum(named(`crime.victims.${kind}_`), year) !== value("crime.victims.total", year)) throw new Error(`Victims by ${kind} do not add up to the total: ${year}`);
    }
  }
  for (const [indicator, year, text] of ANCHORS) {
    if (String(seen.get(`${indicator}:${year}`)) !== text) throw new Error(`Crime anchor value changed: ${indicator}:${year}`);
  }
}
