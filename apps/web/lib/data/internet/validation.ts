import Decimal from "decimal.js";
import { INTERNET_INDICATORS, INTERNET_SOURCES, internetFactKey, type InternetFact, type InternetMeasure } from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const FIRST_YEAR = 2016;
const LAST_YEAR = 2026;
/** Geostat first asked about smartphones in 2019. */
const SMARTPHONE_FIRST_YEAR = 2019;
/** Regions Geostat could not print before it enlarged the sample in 2020 (2016–2019 they sit in "Other regions", or in Imereti for Racha). */
const LATE_REGIONS: readonly string[] = ["region_kvemo_kartli", "region_samtskhe_javakheti", "region_guria", "region_mtskheta_mtianeti", "region_racha_lechkhumi_kvemo_svaneti"];
/** The table each measure is read from; every table's data sits on its one sheet, "1". */
const SOURCES: Record<string, string> = {
  homes_internet: "geostat_ict_homes_internet", homes_computer: "geostat_ict_homes_computer",
  used_3m: "geostat_ict_last_internet_use", never_used: "geostat_ict_last_internet_use", daily: "geostat_ict_internet_frequency",
  bought_online: "geostat_ict_ecommerce", activity: "geostat_ict_purposes", egov: "geostat_ict_public_services",
  own_mobile: "geostat_ict_own_mobile", own_smartphone: "geostat_ict_own_smartphone", computer_3m: "geostat_ict_last_computer_use",
};
/** What Geostat prints, as published. */
const ANCHORS: readonly (readonly [string, number, string])[] = [
  ["internet.homes_internet.total", 2016, "70.1"], ["internet.homes_internet.total", 2026, "93.5"],
  ["internet.homes_internet.region_tbilisi", 2026, "98.2"], ["internet.homes_internet.rural", 2026, "89.0"],
  ["internet.homes_internet.region_guria", 2026, "91.1"], ["internet.used_3m.total", 2026, "89.6"],
  ["internet.bought_online.total", 2026, "38.6"], ["internet.bought_online.age_15_29", 2026, "63.0"],
  ["internet.activity_banking.total", 2026, "61.0"], ["internet.own_mobile.total", 2026, "93.3"],
];
const parts = (indicatorId: string) => indicatorId.split(".") as [string, InternetMeasure, string];
const sourceOf = (measure: InternetMeasure) => SOURCES[measure] ?? SOURCES[measure.split("_")[0]];

/** The years an indicator is served, as the research package's coverage.csv lists them. */
function servedYears(measure: InternetMeasure, group: string): number[] {
  const first = measure === "own_smartphone" ? SMARTPHONE_FIRST_YEAR : LATE_REGIONS.includes(group) ? 2020 : FIRST_YEAR;
  return range(first, LAST_YEAR);
}

/** Every key the serving package must contain, exactly once. */
export function expectedInternetKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of INTERNET_INDICATORS) {
    const [, measure, group] = parts(indicatorId);
    for (const year of servedYears(measure, group)) keys.add(`${indicatorId}:${year}`);
  }
  return keys;
}

export function validateInternetFacts(facts: readonly InternetFact[]): void {
  const expected = expectedInternetKeys();
  const seen = new Set<string>();
  for (const fact of facts) {
    const key = internetFactKey(fact);
    if (!INTERNET_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid internet identity: ${key}`);
    if (fact.year > LAST_YEAR) throw new Error(`Internet observation after 2026: ${key}`);
    if (!expected.has(key)) throw new Error(`Internet observation outside the approved coverage: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate internet observation: ${key}`);
    if (fact.unit !== "percent" || fact.basis !== "actual" || fact.valueStatus !== "survey_estimate" || fact.sourceId !== sourceOf(parts(fact.indicatorId)[1])
      || fact.sourceSheet !== "1" || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid internet source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid internet value: ${key}`); }
    if (!value.isFinite() || value.lt(0) || value.gt(100) || value.decimalPlaces() > 30) throw new Error(`Internet share outside its range or database precision: ${key}`);
    // Round half-up from the value as Excel displays it (15 significant digits).
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(1)) throw new Error(`Internet published value does not match its stored value: ${key}`);
    seen.add(key);
  }
  const missing = [...expected].filter(key => !seen.has(key));
  if (missing.length) throw new Error(`Incomplete internet coverage: ${missing.length} missing, first ${missing[0]}`);
  for (const [indicatorId, year, published] of ANCHORS) if (facts.find(f => f.indicatorId === indicatorId && f.year === year)!.publishedValue !== published) throw new Error(`Internet anchor value changed: ${indicatorId}:${year}`);
  if (!INTERNET_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Internet source missing from the serving package");
}
