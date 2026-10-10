import Decimal from "decimal.js";
import { POVERTY_GROUPS, POVERTY_INDICATORS, POVERTY_SOURCES, povertyFactKey, type PovertyFact, type PovertyIndicator } from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
const SETTLEMENT = ["georgia", "settlement.urban", "settlement.rural"] as const;
/** Each indicator's published groups and years (research package coverage.csv). */
const COVERAGE: Record<PovertyIndicator, { groups: readonly string[]; years: number[] }> = {
  "poverty.absolute": { groups: POVERTY_GROUPS, years: range(2004, 2025) },
  "poverty.relative_60": { groups: SETTLEMENT, years: range(2004, 2025) },
  "poverty.relative_40": { groups: SETTLEMENT, years: range(2004, 2025) },
  "poverty.international_300": { groups: ["georgia"], years: range(2004, 2024) },
  "poverty.international_420": { groups: ["georgia"], years: range(2004, 2024) },
  "poverty.international_830": { groups: ["georgia"], years: range(2004, 2024) },
  "gini.total_income": { groups: ["georgia"], years: range(2006, 2025) },
  "gini.cash_inflows": { groups: ["georgia"], years: range(2006, 2025) },
  "gini.total_inflows": { groups: ["georgia"], years: range(2006, 2025) },
  "gini.consumption_expenditure": { groups: ["georgia"], years: range(2006, 2025) },
  "gini.cash_expenditure": { groups: ["georgia"], years: range(2006, 2025) },
  "gini.total_expenditure": { groups: ["georgia"], years: range(2006, 2025) },
};
const sourceFor = (indicatorId: string) => indicatorId.startsWith("gini.") ? "geostat_gini" : indicatorId === "poverty.absolute" ? "geostat_poverty_absolute" : indicatorId.startsWith("poverty.relative") ? "geostat_poverty_relative" : "geostat_poverty_international";

/** Every key the serving package must contain, exactly once. */
export function expectedPovertyKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of POVERTY_INDICATORS) for (const groupId of COVERAGE[indicatorId].groups) for (const year of COVERAGE[indicatorId].years) keys.add(`${indicatorId}:${groupId}:${year}`);
  return keys;
}

export function povertyDisplayDecimals(numberFormat: string): number {
  const match = /^(?:#,##)?0\.(0+)$/.exec(numberFormat);
  if (!match) throw new Error(`Unexpected poverty number format: ${numberFormat}`);
  return match[1].length;
}

export function validatePovertyFacts(facts: readonly PovertyFact[]): void {
  const expected = expectedPovertyKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = povertyFactKey(fact);
    if (!POVERTY_INDICATORS.includes(fact.indicatorId) || !POVERTY_GROUPS.includes(fact.groupId)) throw new Error(`Invalid poverty identity: ${key}`);
    if (!expected.has(key)) throw new Error(`Poverty observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate poverty observation: ${key}`);
    const unit = fact.indicatorId.startsWith("gini.") ? "index" : "percent";
    if (fact.unit !== unit || fact.basis !== "actual" || fact.valueStatus !== "survey_estimate" || fact.sourceId !== sourceFor(fact.indicatorId) || fact.sourceSheet !== "1" || !/^[A-Z]+\d+$/.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid poverty source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid poverty value: ${key}`); }
    if (!value.isFinite() || value.lt(0) || value.gt(unit === "index" ? 1 : 100) || value.decimalPlaces() > 20) throw new Error(`Poverty value outside its range or database precision: ${key}`);
    const decimals = povertyDisplayDecimals(fact.sourceNumberFormat);
    if (value.toDecimalPlaces(decimals).toFixed(decimals) !== fact.publishedValue) throw new Error(`Poverty published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete poverty coverage: ${missing.length} missing, first ${missing[0]}`);
  const v = (indicatorId: string, groupId: string, year: number) => values.get(`${indicatorId}:${groupId}:${year}`)!;
  const within = (indicatorId: string, year: number, groups: readonly string[]) => {
    const bounds = groups.map(groupId => v(indicatorId, groupId, year)), georgia = v(indicatorId, "georgia", year);
    if (georgia.lt(Decimal.min(...bounds)) || georgia.gt(Decimal.max(...bounds))) throw new Error(`Poverty Georgia rate is not between its groups: ${indicatorId}:${year}`);
  };
  for (const year of COVERAGE["poverty.absolute"].years) {
    for (const groups of [["settlement.urban", "settlement.rural"], ["sex.female", "sex.male"], ["age.0_17", "age.18_64", "age.65_plus"]]) within("poverty.absolute", year, groups);
    for (const indicatorId of ["poverty.relative_60", "poverty.relative_40"]) within(indicatorId, year, ["settlement.urban", "settlement.rural"]);
    for (const groupId of SETTLEMENT) if (v("poverty.relative_40", groupId, year).gt(v("poverty.relative_60", groupId, year))) throw new Error(`Poverty under 40% exceeds under 60%: ${groupId}:${year}`);
  }
  for (const year of COVERAGE["poverty.international_300"].years) {
    const [low, middle, high] = ["300", "420", "830"].map(line => v(`poverty.international_${line}`, "georgia", year));
    if (low.gt(middle) || middle.gt(high)) throw new Error(`Poverty international lines out of order: ${year}`);
  }
  if (!POVERTY_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Poverty source missing from the serving package");
}
