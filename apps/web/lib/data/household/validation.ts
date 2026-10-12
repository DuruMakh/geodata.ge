import Decimal from "decimal.js";
import {
  HOUSEHOLD_AREAS, HOUSEHOLD_INDICATORS, HOUSEHOLD_MEASURES, HOUSEHOLD_SOURCES, householdFactKey, householdSourceId,
  type HouseholdFact,
} from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
/** Regions the survey could publish only from 2019, when its sample was enlarged. */
const REGIONS_FROM_2019 = new Set(["region.guria", "region.mtskheta_mtianeti", "region.racha_lechkhumi_kvemo_svaneti", "region.samtskhe_javakheti"]);
const SUM_TOLERANCE = new Decimal("1e-6");
/** The two number formats the source workbooks use; both display one decimal. */
const NUMBER_FORMATS = new Set(["#,##0.0", "0.0"]);

function yearsFor(areaId: string): number[] {
  if (areaId === "georgia") return range(2002, 2025);
  if (areaId.startsWith("settlement.")) return range(2006, 2025);
  return range(REGIONS_FROM_2019.has(areaId) ? 2019 : 2011, 2025);
}

/** Every key the serving package must contain, exactly once. */
export function expectedHouseholdKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of HOUSEHOLD_INDICATORS) for (const areaId of HOUSEHOLD_AREAS) for (const measure of HOUSEHOLD_MEASURES) for (const year of yearsFor(areaId)) keys.add(`${indicatorId}:${areaId}:${measure}:${year}`);
  return keys;
}

/**
 * The number Excel displays for a stored value: 15 significant digits first
 * (a stored 8.4499999999999993 shows as 8.45), then half-up to one decimal.
 */
export function householdPublishedValue(value: string): string {
  return new D(value).toSignificantDigits(15).toDecimalPlaces(1).toFixed(1);
}

/** Printed totals and the parts that must add up to them (served rows only). */
const SUMS: ReadonlyArray<readonly [total: string, parts: readonly string[]]> = [
  ["income.total", ["income.wages", "income.self_employment", "income.agriculture_sales", "income.property", "income.pensions_assistance", "income.remittances", "income.gifts", "income.non_cash"]],
  ["income.other_inflows", ["income.borrowing_dissaving", "income.property_disposal"]],
  ["spending.consumption", ["spending.food", "spending.clothing", "spending.household_goods", "spending.health", "spending.housing_utilities", "spending.transport", "spending.education", "spending.other_consumption", "spending.non_cash"]],
  ["spending.non_consumption", ["spending.agriculture", "spending.transfers", "spending.saving_lending", "spending.property"]],
];

export function validateHouseholdFacts(facts: readonly HouseholdFact[]): void {
  const expected = expectedHouseholdKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = householdFactKey(fact);
    if (!HOUSEHOLD_INDICATORS.includes(fact.indicatorId) || !HOUSEHOLD_AREAS.includes(fact.areaId) || !HOUSEHOLD_MEASURES.includes(fact.measure)) throw new Error(`Invalid household identity: ${key}`);
    if (!expected.has(key)) throw new Error(`Household observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate household observation: ${key}`);
    if (fact.unit !== "gel_month" || fact.basis !== "actual" || fact.valueStatus !== "survey_estimate" || fact.sourceId !== householdSourceId(fact.indicatorId, fact.areaId, fact.measure) || fact.sourceSheet !== "1" || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !NUMBER_FORMATS.has(fact.sourceNumberFormat) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid household source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid household value: ${key}`); }
    if (!value.isFinite() || value.decimalPlaces() > 20) throw new Error(`Household value outside its database precision: ${key}`);
    if (value.isNegative()) throw new Error(`Negative household value: ${key}`);
    if (!new D(householdPublishedValue(fact.value)).eq(fact.publishedValue)) throw new Error(`Household published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete household coverage: ${missing.length} missing, first ${missing[0]}`);
  const v = (indicatorId: string, areaId: string, measure: string, year: number) => values.get(`${indicatorId}:${areaId}:${measure}:${year}`)!;
  // Georgia's 2025 per-household figures that the design quotes.
  for (const [indicatorId, published] of [["income.total", "2025.8"], ["spending.consumption", "1438.7"]] as const) {
    if (householdPublishedValue(v(indicatorId, "georgia", "per_household", 2025).toFixed()) !== published) throw new Error(`Household 2025 ${indicatorId} does not publish ${published}`);
  }
  for (const indicatorId of HOUSEHOLD_INDICATORS) for (const measure of HOUSEHOLD_MEASURES) for (const year of yearsFor("settlement.urban")) {
    const bounds = [v(indicatorId, "settlement.urban", measure, year), v(indicatorId, "settlement.rural", measure, year)], georgia = v(indicatorId, "georgia", measure, year);
    if (georgia.lt(Decimal.min(...bounds)) || georgia.gt(Decimal.max(...bounds))) throw new Error(`Household Georgia value is not between towns and villages: ${indicatorId}:${measure}:${year}`);
  }
  for (const [total, parts] of SUMS) for (const areaId of HOUSEHOLD_AREAS) for (const measure of HOUSEHOLD_MEASURES) for (const year of yearsFor(areaId)) {
    const sum = parts.reduce((acc, part) => acc.plus(v(part, areaId, measure, year)), new D(0));
    if (sum.minus(v(total, areaId, measure, year)).abs().gt(SUM_TOLERANCE)) throw new Error(`Household parts do not add up to ${total}: ${areaId}:${measure}:${year}`);
  }
  if (!HOUSEHOLD_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Household source missing from the serving package");
}
