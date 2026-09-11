import Decimal from "decimal.js";
import type { ParsedCpiSeries } from "./readGeostatCpi";
import { periodFromKey, periodKey } from "./periods";
import { CPI_SERIES_IDS, CPI_SERIES_MEASURES, type CpiFact, type InflationTargetRow } from "./types";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The 2026-09-10 files agree with their own index within 0.15 pp across every
// month — rounding only. 0.2 leaves room for rounding, never for a wrong row.
export const RECOMPUTE_TOLERANCE_PP = 0.2;

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
