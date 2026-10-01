// apps/web/lib/factQuery/inflationData.ts
//
// Coverage and derived values for the inflation dataset, read from the snapshot.
// Pure and memoised per snapshot: the category table is about 28,000 rows and
// these are asked for on every inflation call.
import { buildContributionIndex } from "../data/inflation/contributions";
import { periodFromKey, periodKey } from "../data/inflation/periods";
import { categoryFactInput } from "../data/inflation/types";
import { NATIONAL_SERIES, TARGET_SERIES, TARGET_SERIES_ID, type InflationMeasure } from "./inflationSeries";
import type { FactQuerySnapshot } from "./types";

export type PeriodRange = [first: string, last: string];

export type SeriesCoverage = {
  periodsByMeasure: Partial<Record<InflationMeasure, PeriodRange>>;
  years: number[];
  weightYears: number[];
};

function memo<T>(cache: WeakMap<FactQuerySnapshot, T>, snapshot: FactQuerySnapshot, build: () => T): T {
  let value = cache.get(snapshot);
  if (value === undefined) {
    value = build();
    cache.set(snapshot, value);
  }
  return value;
}

/** Every month from `from` to `to`, inclusive, as YYYY-MM. Empty when `from` is later. */
export function periodsBetween(from: string, to: string): string[] {
  const periods: string[] = [];
  for (let period = periodFromKey(from); period <= periodFromKey(to); period += 1) periods.push(periodKey(period));
  return periods;
}

export function yearOfPeriod(period: string): number {
  return Number(period.slice(0, 4));
}

function rangeOf(periods: Iterable<string>): PeriodRange | null {
  let first: string | null = null;
  let last: string | null = null;
  for (const period of periods) {
    if (first === null || period < first) first = period;
    if (last === null || period > last) last = period;
  }
  return first === null || last === null ? null : [first, last];
}

const contributionCache = new WeakMap<FactQuerySnapshot, Map<string, Map<number, number>>>();

/** The site's own contribution arithmetic (lib/data/inflation/contributions.ts), built once per snapshot. */
export function contributionIndex(snapshot: FactQuerySnapshot): Map<string, Map<number, number>> {
  return memo(contributionCache, snapshot, () =>
    buildContributionIndex(snapshot.inflation.categories.map(categoryFactInput), snapshot.inflation.weights),
  );
}

const coverageCache = new WeakMap<FactQuerySnapshot, Map<string, SeriesCoverage>>();

/**
 * Per requestable series: the month span of each measure, every year with a
 * value, and the years with a basket weight. The target spans from its first
 * reviewed month to the last published headline month, because the target in
 * force carries forward.
 */
export function inflationSeriesCoverage(snapshot: FactQuerySnapshot): Map<string, SeriesCoverage> {
  return memo(coverageCache, snapshot, () => {
    const periods = new Map<string, Map<InflationMeasure, string[]>>();
    const add = (seriesId: string, measure: InflationMeasure, period: string) => {
      const byMeasure = periods.get(seriesId) ?? new Map<InflationMeasure, string[]>();
      periods.set(seriesId, byMeasure);
      const list = byMeasure.get(measure) ?? [];
      byMeasure.set(measure, list);
      list.push(period);
    };
    for (const fact of snapshot.inflation.facts) add(fact.seriesId, fact.measure, fact.period);
    for (const fact of snapshot.inflation.categories) add(fact.categoryId, fact.measure, fact.period);
    for (const [seriesId, byPeriod] of contributionIndex(snapshot)) {
      for (const period of byPeriod.keys()) add(seriesId, "contribution_pp", periodKey(period));
    }
    const headline = rangeOf(snapshot.inflation.facts.filter((f) => f.seriesId === "cpi.headline" && f.measure === "yoy_pct").map((f) => f.period));
    const targets = rangeOf(snapshot.inflation.targets.map((row) => row.effectiveFrom));
    if (headline !== null && targets !== null && targets[0] <= headline[1]) {
      for (const period of periodsBetween(targets[0], headline[1])) add(TARGET_SERIES_ID, "target_pct", period);
    }

    const ids = [...Object.keys(NATIONAL_SERIES), TARGET_SERIES_ID, ...snapshot.inflation.groups.map((group) => group.id)];
    const result = new Map<string, SeriesCoverage>();
    for (const id of ids) {
      const byMeasure = periods.get(id) ?? new Map<InflationMeasure, string[]>();
      const weightYears = [...new Set(snapshot.inflation.weights.filter((w) => w.categoryId === id).map((w) => w.year))].sort((a, b) => a - b);
      const years = new Set<number>(weightYears);
      for (const list of byMeasure.values()) for (const period of list) years.add(yearOfPeriod(period));
      result.set(id, {
        periodsByMeasure: Object.fromEntries([...byMeasure].map(([measure, list]) => [measure, rangeOf(list)!])),
        years: [...years].sort((a, b) => a - b),
        weightYears,
      });
    }
    return result;
  });
}

/** Where a monthly measure is published anywhere in the dataset; requests outside it are refused. */
export function measurePeriodRange(snapshot: FactQuerySnapshot, measure: InflationMeasure): PeriodRange | null {
  return rangeOf([...inflationSeriesCoverage(snapshot).values()].flatMap((coverage) => coverage.periodsByMeasure[measure] ?? []));
}

export function weightYearRange(snapshot: FactQuerySnapshot): [number, number] {
  const years = snapshot.inflation.weights.map((row) => row.year);
  return [Math.min(...years), Math.max(...years)];
}

/** Catalogue entries for describe_coverage. The residual is never listed: its value depends on the request. */
export function inflationCatalogueSeries(snapshot: FactQuerySnapshot) {
  const coverage = inflationSeriesCoverage(snapshot);
  const entry = (seriesId: string, labelKa: string, level: string, parentSeriesId: string | null) => {
    const series = coverage.get(seriesId)!;
    const periods = rangeOf((Object.values(series.periodsByMeasure) as PeriodRange[]).flat());
    return {
      seriesId,
      labelKa,
      level,
      parentSeriesId,
      availability: "served" as const,
      years: series.years,
      ...(periods !== null ? { periods } : {}),
      periodsByMeasure: series.periodsByMeasure as Record<string, PeriodRange>,
      ...(series.weightYears.length > 0 ? { yearsByMeasure: { basket_weight_pct: series.weightYears } } : {}),
    };
  };
  return [
    ...Object.entries(NATIONAL_SERIES).map(([id, series]) => entry(id, series.labelKa, "national", null)),
    entry(TARGET_SERIES_ID, TARGET_SERIES.labelKa, "reference", null),
    ...snapshot.inflation.groups.map((group) => entry(group.id, group.labelKa, group.level, group.parentId)),
  ];
}

export function inflationDatasetPeriods(snapshot: FactQuerySnapshot): PeriodRange {
  return rangeOf([...snapshot.inflation.facts, ...snapshot.inflation.categories].map((fact) => fact.period))!;
}

/** First and last month of any city value, per city (describe_coverage). Late starts per series come back as missing cells. */
export function inflationEntityPeriods(snapshot: FactQuerySnapshot): Map<string, PeriodRange> {
  const result = new Map<string, PeriodRange>();
  for (const city of snapshot.inflation.cityEntities) {
    const range = rangeOf(snapshot.inflation.cities.filter((fact) => fact.cityId === city.id).map((fact) => fact.period));
    if (range !== null) result.set(city.id, range);
  }
  return result;
}
