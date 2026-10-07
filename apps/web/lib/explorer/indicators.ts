import type { ExplorerTableRow } from "./types";

// Derived statistics for the "ძირითადი ინდიკატორები" panels (DESIGN.md §8.5).
// These lived inline in components/main-explorer/indicators.tsx, where no unit
// test could reach them — while the municipal side computed the same CAGR in
// lib/explorer/municipalData.ts with a passing test. One definition now.

/**
 * The annual rate that compounds `start` into `end` across the period.
 *
 * The exponent is the number of compounding INTERVALS (endYear - startYear),
 * not the number of years the range spans.
 *
 * Returns null rather than a misleading figure when either endpoint is missing
 * or non-positive, or when there is no period to compound over.
 * explorerData.ts and singleYear.ts reject a non-positive start for the same
 * reason; the guard on the END is this function's own, because a fractional
 * root of a negative ratio is not a real number.
 */
export function compoundAnnualGrowth(
  start: number | null,
  end: number | null,
  startYear: number | undefined,
  endYear: number | undefined,
): number | null {
  if (start === null || end === null || startYear === undefined || endYear === undefined) return null;
  // Written as negated `>` rather than `<=` so a NaN endpoint returns null, the
  // way both inlined call sites did. NaN is unordered, so `NaN <= 0` is false
  // while `!(NaN > 0)` is true — `<=` would let a NaN through to the arithmetic
  // and render an empty growth clause instead of omitting the clause entirely.
  if (!(start > 0) || !(end > 0) || !(endYear > startYear)) return null;
  return (end / start) ** (1 / (endYear - startYear)) - 1;
}

export type PeriodDelta = { row: ExplorerTableRow; delta: number };

/**
 * Rows with a meaningful start-to-end increase, biggest first.
 *
 * Rows missing either endpoint have no meaningful period delta, and a delta
 * measured against a non-positive start is mostly the unwind of a correction
 * (e.g. revenue.other_taxes 2020→2021) — both are excluded. A shrinking row
 * keeps its place at the bottom; it is a real, smaller delta.
 */
export function rankPeriodDeltas(
  rows: ExplorerTableRow[],
  startYear: number,
  endYear: number,
): PeriodDelta[] {
  return rows
    .flatMap((row) => {
      const startValue = row.valuesByYear[startYear];
      const endValue = row.valuesByYear[endYear];
      if (
        startValue === undefined ||
        startValue === null ||
        startValue <= 0 ||
        endValue === undefined ||
        endValue === null
      ) {
        return [];
      }
      return [{ row, delta: endValue - startValue }];
    })
    .sort((left, right) => right.delta - left.delta);
}

/**
 * Reviewed residual buckets: rows the mapping could not place with confidence.
 * They stay in tables, series and the period comparison, but a bucket that
 * shrinks as classification improves says nothing about spending, so it never
 * competes in a growth ranking.
 */
const GROWTH_RANKING_EXCLUDED_IDS: ReadonlySet<string> = new Set(["spending.other_unclassified"]);

/**
 * Whether a row may appear in a growth ranking (the movers boards and the
 * biggest-increase / slowest-growth KPIs). Residual buckets never do, and
 * neither does a row that is exactly zero in the end year: "−100%" there means
 * the line was closed or moved elsewhere, not that it grew the least.
 */
export function isGrowthRankable(itemId: string, endValue: number | null | undefined): boolean {
  return !GROWTH_RANKING_EXCLUDED_IDS.has(itemId) && endValue !== 0;
}
