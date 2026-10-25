// Pure layout of the revenue and deficit charts (chapters 03 and 05): which year labels fit, where
// bars sit, the deficit axis range, runs of planned years. No DOM; the chart engines draw from these.

/** Plot padding [top, right, bottom, left]: the right edge holds the band labels, so phones keep a narrow one. */
export function revenuePads(width: number): [number, number, number, number] {
  return width < 620 ? [26, 46, 28, 40] : [26, 196, 28, 44];
}

/**
 * Indices of the years named under the revenue axis: the first, every 4th after it, and the last.
 * A 4th-year pick fewer than 3 steps before the last gives way to the last.
 */
export function yearLabelIndices(count: number): number[] {
  if (count <= 0) return [];
  const last = count - 1;
  const picks: number[] = [];
  for (let i = 0; i < last; i += 4) if (last - i >= 3) picks.push(i);
  picks.push(last);
  return picks;
}

/** Indices of the years divisible by five, the deficit axis labels. */
export function fiveYearIndices(years: readonly number[]): number[] {
  const out: number[] = [];
  years.forEach((year, i) => {
    if (year % 5 === 0) out.push(i);
  });
  return out;
}

/** Maximal runs of consecutive planned years as [firstIndex, lastIndex] pairs. */
export function plannedRuns(planned: readonly boolean[]): [first: number, last: number][] {
  const runs: [number, number][] = [];
  let start = -1;
  planned.forEach((isPlanned, i) => {
    if (isPlanned && start < 0) start = i;
    if (!isPlanned && start >= 0) {
      runs.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, planned.length - 1]);
  return runs;
}

/**
 * The span of a planned run on the revenue x axis, as [fromIndex, toIndex]: from the actual year before it
 * (the line leading to the first planned value is part of the plan) to its last year.
 */
export function plannedSpan(run: [first: number, last: number]): [from: number, to: number] {
  return [Math.max(0, run[0] - 1), run[1]];
}

/** Bars of width `width` split into `count` equal slots from `left`: slot width, bar width (66% of the slot, 2..20 px) and slot centres. */
export function barSlots(left: number, width: number, count: number): { slot: number; bar: number; center(i: number): number } {
  const slot = count > 0 ? width / count : width;
  return { slot, bar: Math.max(2, Math.min(20, slot * 0.66)), center: (i) => left + slot * (i + 0.5) };
}

/** Index of the slot under `px`, or -1 outside the `count` slots. */
export function slotIndexAt(px: number, left: number, slot: number, count: number): number {
  const i = Math.floor((px - left) / slot);
  return i >= 0 && i < count ? i : -1;
}

/** Index of the year point nearest `px` along an axis of `count` points over `width`; -1 more than `margin` outside it. */
export function pointIndexAt(px: number, left: number, width: number, count: number, margin: number): number {
  if (count <= 0 || px < left - margin || px > left + width + margin) return -1;
  if (count === 1) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(((px - left) / width) * (count - 1))));
}

/**
 * Axis range of the deficit chart in percent of GDP: down past the deepest value and up past the highest, in
 * steps of 2, at least -4..2. `ticks` are the even gridlines without zero (the zero line is the axis itself).
 */
export function deficitScale(values: readonly number[]): { lo: number; hi: number; ticks: number[] } {
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 0;
  const lo = Math.min(-4, Math.floor((low - 0.5) / 2) * 2);
  const hi = Math.max(2, Math.ceil((high + 0.3) / 2) * 2);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 2) if (v !== 0) ticks.push(v);
  return { lo, hi, ticks };
}

/** y pixel of `value` on an axis running from `hi` at `top` to `lo` at `top + height`. */
export function valueY(value: number, lo: number, hi: number, top: number, height: number): number {
  return top + ((hi - value) / (hi - lo)) * height;
}

/** The fiscal rule line of the deficit chart, percent of GDP. */
export const DEFICIT_RULE_PCT = -3;

/** Below this width the regions chart puts each region's name above its row instead of beside it. */
export const REGIONS_NARROW_WIDTH = 560;

/** Height of the regions chart: 28 px per region (40 px when narrow, with the name above) plus 56 px for the rate line and the axis. */
export function regionsHeight(count: number, narrow: boolean): number {
  return count * (narrow ? 40 : 28) + 56;
}

/** Top of the regions chart's axis: the next multiple of 5 above the highest rate (17.5 gives 20, 20 gives 25). */
export function regionsAxisTop(maxRate: number): number {
  return (Math.floor(maxRate / 5) + 1) * 5;
}

/** Below this width the wages chart puts each sector's name above its row instead of beside it. */
export const DUMBBELL_NARROW_WIDTH = 640;

/** Height of the wages chart: 27 px per sector (44 px when narrow, with the name above) plus 40 px for the axis. */
export function dumbbellHeight(count: number, narrow: boolean): number {
  return count * (narrow ? 44 : 27) + 40;
}

/** Top of the wages chart's axis, in GEL: the next multiple of 2,000 above the highest wage (5,900 gives 6,000, 6,000 gives 8,000). */
export function wagesAxisTop(maxWage: number): number {
  return (Math.floor(maxWage / 2000) + 1) * 2000;
}

/** The sector whose women's and men's average wages are furthest apart (in GEL, whichever earns more). */
export function largestWageGap<T extends { women: number; men: number }>(sectors: readonly T[]): T {
  if (!sectors.length) throw new Error("Wages chapter: no sectors");
  return sectors.reduce((best, sector) => (Math.abs(sector.women - sector.men) > Math.abs(best.women - best.men) ? sector : best));
}

/** Below this width the partners chart narrows the column between the bars that holds the country names. */
export const TRADE_NARROW_WIDTH = 560;

/** Top of the partners chart's axis, in billions: the next whole billion above the largest one-way flow (2.79 gives 3, 3 gives 4). */
export function partnersAxisTop(maxBillions: number): number {
  return Math.floor(maxBillions) + 1;
}

/** Indices of the years named under the trade lines' axis: the first year and every tenth year after it. */
export function tradeYearTicks(years: readonly number[]): number[] {
  return years.flatMap((year, i) => ((year - years[0]) % 10 === 0 ? [i] : []));
}

/** Index of the year in which imports exceed exports by the most, -1 when they never do. */
export function widestDeficitIndex(exports: readonly number[], imports: readonly number[]): number {
  let widest = -1;
  let gap = 0;
  imports.forEach((value, i) => {
    if (value - exports[i] > gap) {
      gap = value - exports[i];
      widest = i;
    }
  });
  return widest;
}

/** US dollars in billions. */
export const toBillions = (usd: number) => usd / 1_000_000_000;

/** "2004" for a single year, "2004–2007" for a range. */
export function yearRange(first: number, last: number): string {
  return first === last ? String(first) : `${first}–${last}`;
}
