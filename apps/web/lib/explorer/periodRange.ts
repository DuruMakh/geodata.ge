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
