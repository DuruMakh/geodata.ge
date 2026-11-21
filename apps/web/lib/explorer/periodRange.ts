// The selected span of an explorer chart. A period is a number — a calendar year
// on the annual explorers, a month index on the inflation pages — so one set of
// rules serves both.

export type PeriodRange = { kind: "all" } | { kind: "manual"; start: number; end: number };
export type PeriodCoverage = { min: number; max: number };
export type ResolvedPeriodRange = PeriodCoverage & { start: number; end: number };

/** The first and last period across the given series. */
export function periodBounds(maps: Array<Map<number, unknown> | undefined>, emptyMessage: string): PeriodCoverage {
  let min = Infinity;
  let max = -Infinity;
  for (const map of maps) {
    for (const period of map?.keys() ?? []) {
      if (period < min) min = period;
      if (period > max) max = period;
    }
  }
  if (min === Infinity) throw new Error(emptyMessage);
  return { min, max };
}

/** Clamps a manual range to the coverage; one that misses it entirely shows all of it. */
export function resolveRange(range: PeriodRange, { min, max }: PeriodCoverage): ResolvedPeriodRange {
  if (range.kind === "all") return { min, max, start: min, end: max };
  const start = Math.max(min, range.start);
  const end = Math.min(max, range.end);
  return start > end ? { min, max, start: min, end: max } : { min, max, start, end };
}

/**
 * The months a monthly page's hidden crawl tables carry (spec §3.4): whole calendar years up to `count` months, from
 * January of (latest year − 2) through the latest month for 36, so a year row never shows a dash for a published month.
 * Periods here are month indices (year × 12 + month − 1).
 */
export function lastPeriodsRange({ min, max }: PeriodCoverage, count: number): PeriodRange {
  const firstYear = Math.floor(max / 12) - Math.floor(count / 12) + 1;
  return { kind: "manual", start: Math.max(min, firstYear * 12), end: max };
}

/** The months before that window, which a monthly page folds below its first tables; null when the window starts at the first month. */
export function earlierPeriodsRange(coverage: PeriodCoverage, count: number): PeriodRange | null {
  const window = lastPeriodsRange(coverage, count);
  return window.kind === "manual" && window.start > coverage.min ? { kind: "manual", start: coverage.min, end: window.start - 1 } : null;
}

/** A monthly page's crawl range: its window of the latest months, or the earlier months before it (null when there are none). */
export function crawlPeriodsRange(coverage: PeriodCoverage, count: number, months: "latest" | "earlier"): PeriodRange | null {
  return months === "latest" ? lastPeriodsRange(coverage, count) : earlierPeriodsRange(coverage, count);
}

/** A range-strip change. A span that covers everything is stored as "all". */
export function rangeFromPatch(range: ResolvedPeriodRange, patch: { start?: number; end?: number }): PeriodRange {
  const start = patch.start ?? range.start;
  const end = patch.end ?? range.end;
  return start === range.min && end === range.max ? { kind: "all" } : { kind: "manual", start, end };
}

/**
 * Fits a range to the coverage of a newly chosen tab or measure. "all" stays
 * all, and a manual range the new coverage misses becomes all.
 *
 * GDP and inflation also collapse a manual range that now spans the whole
 * coverage back to "all", so a later data year widens the view. Sectors and
 * regional economies deliberately keep it manual
 * (tests/explorer/economicSectors.test.ts pins that).
 */
export function refitRange(range: PeriodRange, coverage: PeriodCoverage, { collapseToAll }: { collapseToAll: boolean }): PeriodRange {
  if (range.kind === "all") return range;
  if (range.end < coverage.min || range.start > coverage.max) return { kind: "all" };
  const { start, end } = resolveRange(range, coverage);
  return collapseToAll && start === coverage.min && end === coverage.max ? { kind: "all" } : { kind: "manual", start, end };
}
