import Decimal from "decimal.js";
import { WAGES_DIMENSIONS, WAGES_GROUPS, WAGES_INDICATORS, WAGES_SECTORS, WAGES_SOURCES, wagesFactKey, type WagesDimension, type WagesFact, type WagesIndicator } from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const LAST_YEAR = 2025;
const ACTIVITY_START = 2014;
const MEDIAN_START = 2018;
const TOTAL_START: Record<WagesDimension, number> = { national: 1995, sex: 1999, ownership: 2000, business_sector: 2006, region: 2010 };
const ALL = WAGES_SECTORS as readonly string[];
const without = (...omit: string[]) => ALL.filter(id => !omit.includes(id.slice(-1)));
/** Sections each group publishes (methodology: "Not every section is published in every group"). */
const SECTIONS: Record<string, readonly string[]> = {
  georgia: ALL, women: ALL, men: ALL, public: without("b", "k"), non_public: without("o"),
  business: without("k", "o"), non_business: ["a", "k", "m", "o", "p", "q", "r", "s"].map(letter => `sector.${letter}`),
};
/** Published "…" cells inside the served scope: public-sector mining, every activity year. */
const UNAVAILABLE = new Set(range(ACTIVITY_START, LAST_YEAR).map(year => `average_monthly_nominal_earnings:ownership:public:sector.b:${year}`));

/** Every key the serving package must contain, exactly once. */
export function expectedWagesKeys(): Set<string> {
  const keys = new Set<string>();
  const add = (indicatorId: WagesIndicator, dimension: WagesDimension, groupId: string, sectorId: string, years: number[]) =>
    years.forEach(year => keys.add(wagesFactKey({ indicatorId, dimension, groupId, sectorId: sectorId as WagesFact["sectorId"], year })));
  for (const dimension of WAGES_DIMENSIONS) for (const groupId of WAGES_GROUPS[dimension]) {
    add("average_monthly_nominal_earnings", dimension, groupId, "total", range(TOTAL_START[dimension], LAST_YEAR));
    for (const sectorId of SECTIONS[groupId] ?? []) add("average_monthly_nominal_earnings", dimension, groupId, sectorId, range(ACTIVITY_START, LAST_YEAR));
  }
  for (const sectorId of ["total", ...ALL]) add("median_monthly_earnings", "national", "georgia", sectorId, range(MEDIAN_START, LAST_YEAR));
  for (const key of UNAVAILABLE) keys.add(key);
  return keys;
}

export function wagesDisplayDecimals(numberFormat: string): number {
  const match = /^(?:#\\ ##)?0(?:\.(0+))?$/.exec(numberFormat);
  if (!match) throw new Error(`Unexpected wages number format: ${numberFormat}`);
  return match[1]?.length ?? 0;
}

export function validateWagesFacts(facts: readonly WagesFact[]): void {
  const expected = expectedWagesKeys();
  const seen = new Set<string>();
  for (const fact of facts) {
    const key = wagesFactKey(fact);
    if (!WAGES_INDICATORS.includes(fact.indicatorId) || !WAGES_DIMENSIONS.includes(fact.dimension) || !WAGES_GROUPS[fact.dimension].includes(fact.groupId) || (fact.sectorId !== "total" && !ALL.includes(fact.sectorId))) throw new Error(`Invalid wages identity: ${key}`);
    if (!expected.has(key)) throw new Error(`Wages observation outside the approved coverage: ${key}`);
    if (seen.has(key)) throw new Error(`Duplicate wages observation: ${key}`);
    seen.add(key);
    if (fact.unit !== "gel" || fact.basis !== "actual" || !WAGES_SOURCES.includes(fact.sourceId) || !fact.sourceSheet || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid wages source contract: ${key}`);
    if (UNAVAILABLE.has(key)) {
      if (fact.valueStatus !== "unavailable" || fact.value !== null || fact.publishedValue !== null || fact.sourceNumberFormat !== null) throw new Error(`Wages unavailable cell must stay unavailable: ${key}`);
      continue;
    }
    const status = fact.indicatorId === "median_monthly_earnings" ? "administrative" : "survey_estimate";
    if (fact.valueStatus !== status || fact.value === null || fact.publishedValue === null || fact.sourceNumberFormat === null) throw new Error(`Invalid wages value status: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid wages value: ${key}`); }
    if (!value.isFinite() || value.lte(0) || value.gte(1_000_000) || value.decimalPlaces() > 20) throw new Error(`Wages value outside its plausible range or database precision: ${key}`);
    if (!value.toDecimalPlaces(wagesDisplayDecimals(fact.sourceNumberFormat)).eq(fact.publishedValue)) throw new Error(`Wages published value does not match its stored value: ${key}`);
  }
  const missing = [...expected].filter(key => !seen.has(key));
  if (missing.length) throw new Error(`Incomplete wages coverage: ${missing.length} missing, first ${missing[0]}`);
}
