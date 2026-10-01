import Decimal from "decimal.js";
import type { ParsedCpiSeries } from "./readGeostatCpi";
import { makePeriod, periodFromKey, periodKey, periodYear } from "./periods";
import {
  CITY_FIRST_PERIOD,
  CITY_SERIES_IDS,
  CPI_CATEGORY_MEASURES,
  CPI_CITY_IDS,
  CPI_CITY_MEASURES,
  CPI_SERIES_IDS,
  CPI_SERIES_MEASURES,
  type BasketWeightRow,
  type CpiCategoryFact,
  type CpiCityFact,
  type CpiFact,
  type InflationTargetRow,
} from "./types";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The spec's bound, set from the one-decimal values Geostat displays. The cells
// store four decimals, and the 2026-08 vintage agrees with its own index within
// 0.0002 pp (data/reports/inflation-cpi-validation.json); a month shifted by one
// row misses by whole points.
export const RECOMPUTE_TOLERANCE_PP = 0.2;
const PLAUSIBLE_RATE_PCT = 50;

export function factKey(fact: Pick<CpiFact, "seriesId" | "measure" | "period">): string {
  return `${fact.seriesId}:${fact.measure}:${fact.period}`;
}

export function validateCpiFacts(facts: CpiFact[]): { lastPeriod: string; counts: Record<string, number>; firstPeriods: Record<string, string> } {
  const seen = new Set<string>();
  const periodsByGroup = new Map<string, number[]>();
  for (const fact of facts) {
    if (!(CPI_SERIES_IDS as readonly string[]).includes(fact.seriesId)) throw new Error(`Unknown CPI series ${fact.seriesId}`);
    if (!CPI_SERIES_MEASURES[fact.seriesId].includes(fact.measure)) throw new Error(`CPI series ${fact.seriesId} does not publish ${fact.measure}`);
    if (!PERIOD.test(fact.period)) throw new Error(`Invalid CPI period ${fact.period}`);
    const key = factKey(fact);
    if (seen.has(key)) throw new Error(`Duplicate CPI observation ${key}`);
    seen.add(key);
    const value = new Decimal(fact.value);
    if (!value.isFinite()) throw new Error(`Non-finite CPI observation ${key}`);
    if (fact.measure === "index_2010" && value.lte(0)) throw new Error(`Non-positive CPI index ${key}`);
    // The mirror stores DECIMAL(20,6); a longer value would only fail parity at import.
    if (value.decimalPlaces() > 6) throw new Error(`CPI observation ${key} has more than 6 decimals: ${fact.value}`);
    // Core is checked by nothing else: a file switched to "=100" form would read as ~100%.
    if (fact.measure !== "index_2010" && value.abs().gte(PLAUSIBLE_RATE_PCT)) throw new Error(`CPI rate ${key} is outside a plausible range: ${fact.value}`);
    if (fact.status !== "published") throw new Error(`Invalid CPI status ${key}`);
    if (!fact.sourceId || !fact.sourceLocator || !DATE.test(fact.lastReviewedAt)) throw new Error(`CPI provenance missing ${key}`);
    const group = `${fact.seriesId}:${fact.measure}`;
    const periods = periodsByGroup.get(group) ?? [];
    periods.push(periodFromKey(fact.period));
    periodsByGroup.set(group, periods);
  }

  const counts: Record<string, number> = {};
  const firstPeriods: Record<string, string> = {};
  let last: number | null = null;
  for (const seriesId of CPI_SERIES_IDS) {
    for (const measure of CPI_SERIES_MEASURES[seriesId]) {
      const group = `${seriesId}:${measure}`;
      const periods = (periodsByGroup.get(group) ?? []).sort((a, b) => a - b);
      if (periods.length === 0) throw new Error(`CPI coverage missing: ${group}`);
      for (let index = 1; index < periods.length; index += 1) {
        if (periods[index] !== periods[index - 1]! + 1) throw new Error(`CPI coverage gap: ${group} after ${periodKey(periods[index - 1]!)}`);
      }
      const end = periods.at(-1)!;
      if (last !== null && end !== last) {
        throw new Error(`CPI series end in different months: ${group} ends ${periodKey(end)}, others ${periodKey(last)}`);
      }
      last = end;
      counts[group] = periods.length;
      firstPeriods[group] = periodKey(periods[0]!);
    }
  }
  return { lastPeriod: periodKey(last!), counts, firstPeriods };
}

// Validation only: the published series are what the site serves.
export function recomputeHeadline(facts: CpiFact[]): { yoy: number; mom: number; avg12: number } {
  const series = (measure: CpiFact["measure"]) =>
    new Map(facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === measure).map((fact) => [periodFromKey(fact.period), Number(fact.value)]));
  const index = series("index_2010");
  const ratio = (period: number, lag: number) => {
    const current = index.get(period);
    const base = index.get(period - lag);
    return current === undefined || base === undefined ? null : (current / base - 1) * 100;
  };
  const mean = (from: number, to: number) => {
    let sum = 0;
    for (let period = from; period <= to; period += 1) {
      const value = index.get(period);
      if (value === undefined) return null;
      sum += value;
    }
    return sum / (to - from + 1);
  };
  const errors = { yoy: 0, mom: 0, avg12: 0 };
  const check = (name: keyof typeof errors, published: Map<number, number>, compute: (period: number) => number | null) => {
    for (const [period, value] of published) {
      const computed = compute(period);
      if (computed === null) throw new Error(`Cannot recompute headline ${name} for ${periodKey(period)}: index missing`);
      errors[name] = Math.max(errors[name], Math.abs(computed - value));
    }
  };
  check("yoy", series("yoy_pct"), (period) => ratio(period, 12));
  check("mom", series("mom_pct"), (period) => ratio(period, 1));
  check("avg12", series("avg12_pct"), (period) => {
    const current = mean(period - 11, period);
    const previous = mean(period - 23, period - 12);
    return current === null || previous === null ? null : (current / previous - 1) * 100;
  });
  for (const [name, error] of Object.entries(errors)) {
    if (error > RECOMPUTE_TOLERANCE_PP) throw new Error(`Headline ${name} differs from the recomputed index by ${error.toFixed(3)} pp (limit ${RECOMPUTE_TOLERANCE_PP})`);
  }
  return errors;
}

export function assertLanguageParity(role: string, english: ParsedCpiSeries[], georgian: ParsedCpiSeries[]): void {
  if (english.length !== georgian.length) throw new Error(`English and Georgian ${role} files differ in series count`);
  english.forEach((series, index) => {
    const other = georgian[index]!;
    const left = series.cells.map((cell) => `${cell.period}=${cell.value}`);
    const right = other.cells.map((cell) => `${cell.period}=${cell.value}`);
    const first = left.findIndex((value, position) => value !== right[position]);
    if (other.seriesId !== series.seriesId || left.length !== right.length || first !== -1) {
      const where = first === -1 ? "in length" : `at ${periodKey(series.cells[first]!.period)}`;
      throw new Error(`English and Georgian ${role} files differ for ${series.seriesId} ${where}`);
    }
  });
}

/** Every change to an already-published month, including a month that disappeared. */
export function findRevisions(previous: CpiFact[], next: CpiFact[]): string[] {
  const nextByKey = new Map(next.map((fact) => [factKey(fact), fact]));
  const problems: string[] = [];
  for (const fact of previous) {
    const current = nextByKey.get(factKey(fact));
    if (!current) problems.push(`${factKey(fact)} removed`);
    else if (!new Decimal(current.value).eq(fact.value)) problems.push(`${factKey(fact)} ${fact.value} → ${current.value}`);
  }
  return problems;
}

// Geostat's policy is no planned revisions, so one is a stop-and-review event,
// never a silent overwrite (spec §4.4).
export function assertNoRevisions(previous: CpiFact[], next: CpiFact[]): void {
  const revisions = findRevisions(previous, next);
  if (revisions.length > 0) {
    throw new Error(`Geostat revised published CPI history; review before accepting (${revisions.length}):\n${revisions.slice(0, 20).join("\n")}`);
  }
}

export function validateTargetRows(rows: InflationTargetRow[]): void {
  if (rows.length === 0) throw new Error("NBG inflation target file is empty");
  rows.forEach((row, index) => {
    if (!PERIOD.test(row.effectiveFrom) || (row.effectiveTo !== null && !PERIOD.test(row.effectiveTo))) {
      throw new Error(`Invalid NBG target period ${row.effectiveFrom}–${row.effectiveTo ?? ""}`);
    }
    const target = new Decimal(row.targetPct);
    if (!target.isFinite() || target.lte(0)) throw new Error(`Invalid NBG target value ${row.targetPct} from ${row.effectiveFrom}`);
    if (!row.sourceId || !DATE.test(row.lastReviewedAt)) throw new Error(`NBG target provenance missing from ${row.effectiveFrom}`);
    const from = periodFromKey(row.effectiveFrom);
    const to = row.effectiveTo === null ? null : periodFromKey(row.effectiveTo);
    if (to !== null && to < from) throw new Error(`NBG target row ends before it starts: ${row.effectiveFrom}`);
    const next = rows[index + 1];
    if (next) {
      if (to === null) throw new Error(`Only the last NBG target row may be open-ended (${row.effectiveFrom})`);
      if (periodFromKey(next.effectiveFrom) !== to + 1) throw new Error(`NBG target rows must be contiguous: ${row.effectiveTo} → ${next.effectiveFrom}`);
    }
  });
}

export const WEIGHT_SUM_TOLERANCE_PCT = 0.001;

export function categoryFactKey(fact: Pick<CpiCategoryFact, "categoryId" | "measure" | "period">): string {
  return `${fact.categoryId}:${fact.measure}:${fact.period}`;
}

/**
 * Unlike the national series (validateCpiFacts), a category may start late, end
 * early or skip months — 04.2 and 08.1 end in 2011, 09.6 starts in 2020, 12.5 and
 * 12.6 skip interior months. Gaps are recorded, not rejected (spec §3.4).
 */
export function validateCategoryFacts(facts: CpiCategoryFact[]): { lastPeriod: string; categoryCount: number; gaps: string[] } {
  const seen = new Set<string>();
  const divisions = new Set<string>();
  const periodsByGroup = new Map<string, number[]>();
  for (const fact of facts) {
    if (fact.level === 2) divisions.add(fact.categoryId);
    if (!PERIOD.test(fact.period)) throw new Error(`Invalid category period ${fact.period}`);
    if (!(CPI_CATEGORY_MEASURES as readonly string[]).includes(fact.measure)) throw new Error(`Unknown category measure ${fact.measure}`);
    const key = categoryFactKey(fact);
    if (seen.has(key)) throw new Error(`Duplicate category observation ${key}`);
    seen.add(key);
    const value = new Decimal(fact.value);
    if (!value.isFinite()) throw new Error(`Non-finite category observation ${key}`);
    if (value.decimalPlaces() > 6) throw new Error(`Category observation ${key} has more than 6 decimals: ${fact.value}`);
    if (value.abs().gte(PLAUSIBLE_RATE_PCT * 8)) throw new Error(`Category rate ${key} is outside a plausible range: ${fact.value}`);
    if (fact.status !== "published") throw new Error(`Invalid category status ${key}`);
    if (!fact.sourceId || !fact.sourceLocator || !DATE.test(fact.lastReviewedAt)) throw new Error(`Category provenance missing ${key}`);
    const group = `${fact.categoryId}:${fact.measure}`;
    periodsByGroup.set(group, [...(periodsByGroup.get(group) ?? []), periodFromKey(fact.period)]);
  }
  for (const fact of facts) {
    if (fact.level === 3 && (fact.parentId === null || !divisions.has(fact.parentId))) {
      throw new Error(`Category ${fact.categoryId} has no parent division in the data`);
    }
  }
  // COICOP has exactly 12 divisions (spec §4.4). Only the workbook reader enforced
  // this, so a CSV or mirror missing one would have passed the serving-path check.
  if (divisions.size !== 12) throw new Error(`Expected 12 COICOP divisions, found ${divisions.size}`);

  const gaps: string[] = [];
  let last = -Infinity;
  for (const [group, periods] of periodsByGroup) {
    periods.sort((a, b) => a - b);
    for (let index = 1; index < periods.length; index += 1) {
      if (periods[index] !== periods[index - 1]! + 1) gaps.push(`${group} after ${periodKey(periods[index - 1]!)}`);
    }
    last = Math.max(last, periods.at(-1)!);
  }
  if (!Number.isFinite(last)) throw new Error("Category coverage is empty");
  return { lastPeriod: periodKey(last), categoryCount: new Set(facts.map((fact) => fact.categoryId)).size, gaps: gaps.sort() };
}

export function validateBasketWeights(weights: BasketWeightRow[], categoryIds: Set<string>): { years: number[]; maxSumErrorPct: number } {
  if (weights.length === 0) throw new Error("Basket weights are empty");
  const levels = new Map<string, Decimal>();
  const years = new Set<number>();
  for (const row of weights) {
    if (!categoryIds.has(row.categoryId)) throw new Error(`Basket weight for ${row.categoryId} has no price data`);
    const value = new Decimal(row.weightPct);
    if (!value.isFinite() || value.lt(0) || value.gt(100)) throw new Error(`Invalid basket weight ${row.weightPct} for ${row.categoryId}`);
    if (value.decimalPlaces() > 6) throw new Error(`Basket weight for ${row.categoryId} has more than 6 decimals`);
    if (!row.sourceId || !DATE.test(row.lastReviewedAt)) throw new Error(`Basket weight provenance missing for ${row.categoryId}`);
    years.add(row.year);
    const level = row.categoryId.includes("_") ? 3 : 2;
    const key = `${level}:${row.year}`;
    levels.set(key, (levels.get(key) ?? new Decimal(0)).plus(value));
  }
  let maxSumErrorPct = 0;
  for (const [key, total] of levels) {
    const error = total.minus(100).abs().toNumber();
    if (error > WEIGHT_SUM_TOLERANCE_PCT) throw new Error(`Basket weights for level ${key} sum to ${total.toFixed(6)}, not 100`);
    maxSumErrorPct = Math.max(maxSumErrorPct, error);
  }
  return { years: [...years].sort((a, b) => a - b), maxSumErrorPct };
}

export function findCategoryRevisions(previous: CpiCategoryFact[], next: CpiCategoryFact[]): string[] {
  const nextByKey = new Map(next.map((fact) => [categoryFactKey(fact), fact]));
  const problems: string[] = [];
  for (const fact of previous) {
    const current = nextByKey.get(categoryFactKey(fact));
    if (!current) problems.push(`${categoryFactKey(fact)} removed`);
    else if (!new Decimal(current.value).eq(fact.value)) problems.push(`${categoryFactKey(fact)} ${fact.value} → ${current.value}`);
  }
  return problems;
}

export function assertNoCategoryRevisions(previous: CpiCategoryFact[], next: CpiCategoryFact[]): void {
  const revisions = findCategoryRevisions(previous, next);
  if (revisions.length > 0) {
    throw new Error(`Geostat revised published category history; review before accepting (${revisions.length}):\n${revisions.slice(0, 20).join("\n")}`);
  }
}

// City facts (spec 2026-09-26 §4.3). Unlike categories, a city series may start
// late but never has a hole; unlike the national series, two late starts are
// expected and named, so any other late start fails as a changed layout.
const EXPECTED_CITY_LATE_STARTS: Readonly<Record<string, string>> = {
  "city.zugdidi:yoy_pct": "2016-12",
  "city.zugdidi:avg12_pct": "2017-12",
};

export function cityFactKey(fact: Pick<CpiCityFact, "cityId" | "seriesId" | "measure" | "period">): string {
  return `${fact.cityId}:${fact.seriesId}:${fact.measure}:${fact.period}`;
}

export function validateCityFacts(facts: CpiCityFact[]): { lastPeriod: string; counts: Record<string, number>; firstPeriods: Record<string, string> } {
  const seen = new Set<string>();
  const periodsByGroup = new Map<string, number[]>();
  for (const fact of facts) {
    const key = cityFactKey(fact);
    if (!(CPI_CITY_IDS as readonly string[]).includes(fact.cityId)) throw new Error(`Unknown city ${fact.cityId}`);
    if (!CITY_SERIES_IDS.includes(fact.seriesId)) throw new Error(`Unknown city series ${fact.seriesId}`);
    if (!(CPI_CITY_MEASURES as readonly string[]).includes(fact.measure)) throw new Error(`Unknown city measure ${fact.measure}`);
    if (fact.measure === "avg12_pct" && fact.seriesId !== "cpi.headline") throw new Error(`City series ${fact.seriesId} does not publish avg12_pct`);
    if (!PERIOD.test(fact.period)) throw new Error(`Invalid city period ${fact.period}`);
    if (fact.period < CITY_FIRST_PERIOD) throw new Error(`City observation ${key} is before ${CITY_FIRST_PERIOD}`);
    if (seen.has(key)) throw new Error(`Duplicate city observation ${key}`);
    seen.add(key);
    const value = new Decimal(fact.value);
    if (!value.isFinite()) throw new Error(`Non-finite city observation ${key}`);
    if (value.decimalPlaces() > 6) throw new Error(`City observation ${key} has more than 6 decimals: ${fact.value}`);
    if (value.abs().gte(PLAUSIBLE_RATE_PCT * 8)) throw new Error(`City rate ${key} is outside a plausible range: ${fact.value}`);
    if (fact.status !== "published") throw new Error(`Invalid city status ${key}`);
    if (!fact.sourceId || !fact.sourceLocator || !DATE.test(fact.lastReviewedAt)) throw new Error(`City provenance missing ${key}`);
    const group = `${fact.cityId}:${fact.seriesId}:${fact.measure}`;
    periodsByGroup.set(group, [...(periodsByGroup.get(group) ?? []), periodFromKey(fact.period)]);
  }

  const counts: Record<string, number> = {};
  const firstPeriods: Record<string, string> = {};
  let last: number | null = null;
  for (const cityId of CPI_CITY_IDS) {
    for (const measure of CPI_CITY_MEASURES) {
      for (const seriesId of measure === "avg12_pct" ? ["cpi.headline"] : CITY_SERIES_IDS) {
        const group = `${cityId}:${seriesId}:${measure}`;
        const periods = (periodsByGroup.get(group) ?? []).sort((a, b) => a - b);
        if (periods.length === 0) throw new Error(`City coverage missing: ${group}`);
        for (let index = 1; index < periods.length; index += 1) {
          if (periods[index] !== periods[index - 1]! + 1) throw new Error(`City coverage gap: ${group} after ${periodKey(periods[index - 1]!)}`);
        }
        const expectedFirst = EXPECTED_CITY_LATE_STARTS[`${cityId}:${measure}`] ?? CITY_FIRST_PERIOD;
        if (periodKey(periods[0]!) !== expectedFirst) throw new Error(`City series ${group} starts ${periodKey(periods[0]!)}, expected ${expectedFirst}`);
        const end = periods.at(-1)!;
        if (last !== null && end !== last) throw new Error(`City series end in different months: ${group} ends ${periodKey(end)}, others ${periodKey(last)}`);
        last = end;
        counts[group] = periods.length;
        firstPeriods[group] = periodKey(periods[0]!);
      }
    }
  }
  return { lastPeriod: periodKey(last!), counts, firstPeriods };
}

export function findCityRevisions(previous: CpiCityFact[], next: CpiCityFact[]): string[] {
  const nextByKey = new Map(next.map((fact) => [cityFactKey(fact), fact]));
  const problems: string[] = [];
  for (const fact of previous) {
    const current = nextByKey.get(cityFactKey(fact));
    if (!current) problems.push(`${cityFactKey(fact)} removed`);
    else if (!new Decimal(current.value).eq(fact.value)) problems.push(`${cityFactKey(fact)} ${fact.value} → ${current.value}`);
  }
  return problems;
}

export function assertNoCityRevisions(previous: CpiCityFact[], next: CpiCityFact[]): void {
  const revisions = findCityRevisions(previous, next);
  if (revisions.length > 0) {
    throw new Error(`Geostat revised published city history; review before accepting (${revisions.length}):\n${revisions.slice(0, 20).join("\n")}`);
  }
}

/** A price level chained from month-on-month changes: 100 in the month before the first. Validation only. */
export function chainIndex(mom: Map<number, number>): Map<number, number> {
  const periods = [...mom.keys()].sort((a, b) => a - b);
  const index = new Map<number, number>();
  if (periods.length === 0) return index;
  let level = 100;
  index.set(periods[0]! - 1, level);
  for (const period of periods) {
    level *= 1 + mom.get(period)! / 100;
    index.set(period, level);
  }
  return index;
}

// A tripwire for a shifted column, not an accuracy claim: the 2026-08 vintage
// agrees with its own m/m chain within ≤ 0.0004 pp in every city.
export const CITY_CONSISTENCY_TOLERANCE_PP = 0.01;

export function cityConsistencyError(series: { yoy: Map<number, number>; mom: Map<number, number>; avg12: Map<number, number> }): { maxPp: number; comparisons: number } {
  const index = chainIndex(series.mom);
  let maxPp = 0;
  let comparisons = 0;
  for (const [period, value] of series.yoy) {
    const now = index.get(period);
    const before = index.get(period - 12);
    if (now === undefined || before === undefined) continue;
    maxPp = Math.max(maxPp, Math.abs((now / before - 1) * 100 - value));
    comparisons += 1;
  }
  for (const [period, value] of series.avg12) {
    let now = 0;
    let before = 0;
    let complete = true;
    for (let offset = 0; offset < 12 && complete; offset += 1) {
      const a = index.get(period - offset);
      const b = index.get(period - offset - 12);
      if (a === undefined || b === undefined) complete = false;
      else {
        now += a;
        before += b;
      }
    }
    if (!complete) continue;
    maxPp = Math.max(maxPp, Math.abs((now / before - 1) * 100 - value));
    comparisons += 1;
  }
  return { maxPp, comparisons };
}

export type ImpliedCityWeights = { year: number; months: number; weights: Record<string, number>; maxResidualPp: number };

// Geostat does not publish city weights (metadata §18.5). The national index is a
// weighted mean of the city indices, re-weighted each December, so within a year
// each month's national movement since December is Σ w · (the city's movement).
// These weights are a check that the cities add up to the national figure —
// never a published number (spec §3.5).
export const IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP = 0.01;

function solveLeastSquares(rows: number[][], targets: number[]): number[] {
  const size = rows[0]!.length;
  const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => rows.reduce((sum, row) => sum + row[i]! * row[j]!, 0)));
  const vector = Array.from({ length: size }, (_, i) => rows.reduce((sum, row, k) => sum + row[i]! * targets[k]!, 0));
  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) if (Math.abs(matrix[row]![col]!) > Math.abs(matrix[pivot]![col]!)) pivot = row;
    [matrix[col], matrix[pivot]] = [matrix[pivot]!, matrix[col]!];
    [vector[col], vector[pivot]] = [vector[pivot]!, vector[col]!];
    for (let row = 0; row < size; row += 1) {
      if (row === col) continue;
      const factor = matrix[row]![col]! / matrix[col]![col]!;
      for (let c = col; c < size; c += 1) matrix[row]![c] = matrix[row]![c]! - factor * matrix[col]![c]!;
      vector[row] = vector[row]! - factor * vector[col]!;
    }
  }
  return vector.map((value, i) => value / matrix[i]![i]!);
}

export function fitImpliedCityWeights(
  nationalMom: Map<number, number>,
  cityMom: ReadonlyMap<string, Map<number, number>>,
  fromYear: number,
): { years: ImpliedCityWeights[]; skippedYears: number[] } {
  const national = chainIndex(nationalMom);
  const ids = [...cityMom.keys()];
  const cities = ids.map((id) => chainIndex(cityMom.get(id)!));
  const lastYear = periodYear(Math.max(...nationalMom.keys()));
  const years: ImpliedCityWeights[] = [];
  const skippedYears: number[] = [];
  for (let year = fromYear; year <= lastYear; year += 1) {
    const base = makePeriod(year - 1, 12);
    const rows: number[][] = [];
    const targets: number[] = [];
    for (let month = 1; month <= 12; month += 1) {
      const period = makePeriod(year, month);
      const ratios = cities.map((index) => (index.has(period) && index.has(base) ? index.get(period)! / index.get(base)! : null));
      if (!national.has(period) || !national.has(base) || ratios.some((ratio) => ratio === null)) continue;
      rows.push(ratios as number[]);
      targets.push(national.get(period)! / national.get(base)!);
    }
    // More equations than unknowns, or the weights are not determined.
    if (rows.length <= ids.length) {
      skippedYears.push(year);
      continue;
    }
    const solved = solveLeastSquares(rows, targets);
    const maxResidualPp = Math.max(...rows.map((row, k) => Math.abs(row.reduce((sum, ratio, i) => sum + ratio * solved[i]!, 0) - targets[k]!) * 100));
    years.push({ year, months: rows.length, weights: Object.fromEntries(ids.map((id, i) => [id, solved[i]!])), maxResidualPp });
  }
  return { years, skippedYears };
}

export function assertImpliedCityWeights(fit: { years: ImpliedCityWeights[] }): void {
  if (fit.years.length === 0) throw new Error("City weights: no year has enough months to check that the cities add up to the national index");
  for (const entry of fit.years) {
    if (entry.maxResidualPp > IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP) {
      throw new Error(`City weights ${entry.year}: the cities miss the national index by ${entry.maxResidualPp.toFixed(4)} pp (residual limit ${IMPLIED_WEIGHT_RESIDUAL_LIMIT_PP})`);
    }
    const values = Object.values(entry.weights);
    if (values.some((weight) => !(weight > 0 && weight < 1))) throw new Error(`City weights ${entry.year}: a weight falls outside (0, 1)`);
    const sum = values.reduce((total, weight) => total + weight, 0);
    if (Math.abs(sum - 1) > 0.001) throw new Error(`City weights ${entry.year}: weights sum to ${sum.toFixed(4)}, not 1`);
  }
}
