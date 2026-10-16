import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import {
  HEALTH_AREAS, HEALTH_INDICATORS, HEALTH_RESEARCH_DIRECTORY, HEALTH_SOURCES, HEALTH_UNITS, healthFactKey,
  type HealthArea, type HealthFact, type HealthIndicator, type HealthUnit,
} from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const SPECIALITIES = HEALTH_INDICATORS.filter(id => id.startsWith("health.staff.doctors_"));
const CAUSES = HEALTH_INDICATORS.filter(id => id.startsWith("health.deaths.") && id !== "health.deaths.total");
const REGIONS = HEALTH_AREAS.filter(area => area !== "georgia");

/** Every key the serving package must contain, exactly once, from the research package's `coverage.csv`. */
export function expectedHealthKeys(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Set<string> {
  const file = path.join(/* turbopackIgnore: true */ repositoryRoot, HEALTH_RESEARCH_DIRECTORY, "coverage.csv");
  const keys = new Set<string>();
  for (const line of parse(fs.readFileSync(file), { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]) {
    const first = Number(line.first_year), last = Number(line.last_year);
    // A served series has no gaps, so its observation count is its year span.
    if (!(HEALTH_INDICATORS as readonly string[]).includes(line.indicator_id) || !(HEALTH_AREAS as readonly string[]).includes(line.area_id) || Number(line.observations) !== last - first + 1) {
      throw new Error(`Invalid health coverage line: ${line.indicator_id}:${line.area_id}`);
    }
    for (const year of range(first, last)) keys.add(`${line.indicator_id}:${line.area_id}:${year}`);
  }
  return keys;
}

const COUNT_FORMATS = ["General", "0", "#\\ ##0", "##\\ ###", "#,##0"];
const THOUSAND_FORMATS = ["General", "0", "0.0", "#\\ ##0", "#,##0"];
const RATE_FORMATS = ["0.0", "#,##0.0"];

/**
 * The value as Geostat publishes it. Excel keeps 15 significant digits, so the stored value is cut to 15 first.
 * A rate follows its one-decimal format, half up (the death-rate cells hold unrounded doubles). A count with a
 * fixed format follows its zero decimals, half up; a `General` count shows the stored value. A figure in
 * thousands keeps the three decimals Geostat stores (one person, unit or visit), whatever its `0.0` or
 * whole-number format shows. This is `display()` in the package's `prepare.py`.
 */
export function healthPublishedValue(unit: HealthUnit, value: string, numberFormat: string): string {
  const shown = new D(value).toSignificantDigits(15);
  const unexpected = () => new Error(`Unexpected health number format for ${unit}: ${numberFormat}`);
  if (unit === "per_1000_population") {
    if (!RATE_FORMATS.includes(numberFormat)) throw unexpected();
    return shown.toFixed(1);
  }
  if (unit === "persons" || unit === "units") {
    if (!COUNT_FORMATS.includes(numberFormat)) throw unexpected();
    return numberFormat === "General" ? shown.toFixed() : shown.toFixed(0);
  }
  if (!THOUSAND_FORMATS.includes(numberFormat)) throw unexpected();
  return shown.toFixed();
}

/** Decimals of the value the rule above publishes: the unit decides as much as the cell's format. */
export function healthDisplayDecimals(numberFormat: string, value: string, unit: HealthUnit): number {
  const published = healthPublishedValue(unit, value, numberFormat);
  return published.includes(".") ? published.length - published.indexOf(".") - 1 : 0;
}

const PHYSICIANS = "geostat_health_physicians", NURSES = "geostat_health_nurses", MAIN = "geostat_health_main", GROUPS = "geostat_health_morbidity_groups";
const CASE_SOURCES: Record<string, string> = {
  tuberculosis: "geostat_health_tuberculosis", hiv: "geostat_health_hiv", diabetes: "geostat_health_diabetes", anaemia: "geostat_health_anaemia",
  syphilis: "geostat_health_sti", gonorrhoea: "geostat_health_sti",
};
/** The workbook and unit each indicator is read in. */
function contractOf(indicatorId: HealthIndicator): { sourceId: string; unit: HealthUnit } {
  const [, topic, item] = indicatorId.split(".");
  if (topic === "staff") return { sourceId: item.startsWith("doctors") ? PHYSICIANS : NURSES, unit: "persons" };
  if (topic === "facilities") return { sourceId: MAIN, unit: item === "beds" ? "units_thousand" : "units" };
  if (topic === "visits") return { sourceId: MAIN, unit: "visits_thousand" };
  if (topic === "deaths") return { sourceId: "geostat_deaths_by_cause_region", unit: "persons" };
  if (topic === "death_rate") return { sourceId: "geostat_death_rate_region", unit: "per_1000_population" };
  return CASE_SOURCES[item] ? { sourceId: CASE_SOURCES[item], unit: "persons" } : { sourceId: GROUPS, unit: "persons_thousand" };
}

/** The design spec's anchor values (published text), which a rule change must not move. */
const ANCHORS: ReadonlyArray<readonly [HealthIndicator, HealthArea, number, string]> = [
  ["health.staff.doctors", "georgia", 2025, "22491"], ["health.staff.nurses", "georgia", 2025, "21262"],
  ["health.facilities.hospitals", "georgia", 2025, "232"], ["health.facilities.beds", "georgia", 2025, "15.232"],
  ["health.visits.outpatient", "georgia", 2025, "16760.072"], ["health.illness.respiratory", "georgia", 2025, "500.359"],
  ["health.illness.tuberculosis", "georgia", 2025, "933"], ["health.illness.hiv", "georgia", 2025, "562"],
  ["health.deaths.total", "georgia", 2025, "44319"], ["health.deaths.circulatory", "georgia", 2025, "16711"],
  ["health.deaths.covid19", "georgia", 2021, "11286"], ["health.deaths.total", "region.guria", 2025, "1567"],
  ["health.death_rate.total", "region.racha_lechkhumi_kvemo_svaneti", 2025, "19.7"],
];

export function validateHealthFacts(facts: readonly HealthFact[], repositoryRoot?: string): void {
  const expected = expectedHealthKeys(repositoryRoot);
  const seen = new Map<string, Decimal>();
  const published = new Map<string, string>();
  for (const fact of facts) {
    const key = healthFactKey(fact);
    if (!HEALTH_INDICATORS.includes(fact.indicatorId) || !HEALTH_AREAS.includes(fact.areaId)) throw new Error(`Invalid health identity: ${key}`);
    if (!expected.has(key)) throw new Error(`Health observation outside the approved coverage: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate health observation: ${key}`);
    const contract = contractOf(fact.indicatorId);
    if (
      !HEALTH_UNITS.includes(fact.unit) || fact.unit !== contract.unit || fact.basis !== "actual" || fact.valueStatus !== "published" ||
      fact.sourceId !== contract.sourceId || !HEALTH_SOURCES.includes(fact.sourceId) || !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)
    ) throw new Error(`Invalid health source contract: ${key}`);
    if (!/^-?\d+(\.\d+)?$/.test(fact.value)) throw new Error(`Invalid health value: ${key}`);
    const value = new D(fact.value);
    if (value.isNegative() || value.decimalPlaces() > 20) throw new Error(`Health value outside its range or database precision: ${key}`);
    // The rule is `display()` in the package's prepare.py; a published value that differs is a changed value.
    if (healthPublishedValue(fact.unit, fact.value, fact.sourceNumberFormat) !== fact.publishedValue) throw new Error(`Health published value does not match its stored value: ${key}`);
    seen.set(key, value);
    published.set(key, fact.publishedValue);
  }
  const missing = [...expected].filter(key => !seen.has(key));
  if (missing.length) throw new Error(`Incomplete health coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const id of HEALTH_SOURCES) if (!facts.some(f => f.sourceId === id)) throw new Error(`Health source missing from the serving package: ${id}`);

  const value = (indicator: string, area: string, year: number) => seen.get(`${indicator}:${area}:${year}`);
  for (const year of range(2002, 2025)) {
    const parts = SPECIALITIES.reduce((sum, id) => sum.plus(value(id, "georgia", year)!), new D(0));
    if (!parts.eq(value("health.staff.doctors", "georgia", year)!)) throw new Error(`Health doctor specialities do not add up to doctors: ${year}`);
  }
  for (const area of HEALTH_AREAS) {
    for (const year of range(2014, 2025)) {
      // Covid-19 has no value before 2020: it counts as 0 inside this check only.
      const causes = CAUSES.reduce((sum, id) => sum.plus(value(id, area, year) ?? 0), new D(0));
      if (!causes.eq(value("health.deaths.total", area, year)!)) throw new Error(`Health causes do not add up to all deaths: ${area} ${year}`);
    }
  }
  for (const indicator of ["health.deaths.total", ...CAUSES]) {
    for (const year of range(2014, 2025)) {
      const georgia = value(indicator, "georgia", year);
      if (georgia === undefined) continue;
      if (!REGIONS.reduce((sum, area) => sum.plus(value(indicator, area, year)!), new D(0)).eq(georgia)) throw new Error(`Health regions do not add up to Georgia: ${indicator} ${year}`);
    }
  }
  for (const [indicator, area, year, text] of ANCHORS) {
    if (published.get(`${indicator}:${area}:${year}`) !== text) throw new Error(`Health anchor value changed: ${indicator}:${area}:${year}`);
  }
}
