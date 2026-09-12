import Decimal from "decimal.js";
import type { ParsedCpiSeries } from "./readGeostatCpi";
import { periodFromKey, periodKey } from "./periods";
import {
  CPI_CATEGORY_MEASURES,
  CPI_SERIES_IDS,
  CPI_SERIES_MEASURES,
  type BasketWeightRow,
  type CpiCategoryFact,
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
