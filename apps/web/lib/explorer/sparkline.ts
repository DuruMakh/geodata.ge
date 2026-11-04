// Sparkline path geometry (DESIGN.md §7.11). Kept pure so it can be unit-tested
// in the node environment — the component around it is a thin SVG wrapper.

import type { ExplorerTableRow } from "./types";

type Point = { value: number; index: number };

/** The x and y of a series' points in a width × height box, or null when fewer than two points have a value. */
function sparklineScale(values: (number | null)[], width: number, height: number, inset: number) {
  const present: Point[] = [];
  for (const [index, value] of values.entries()) {
    if (value !== null && Number.isFinite(value)) present.push({ value, index });
  }
  if (present.length < 2) return null;

  const count = values.length;
  const min = Math.min(...present.map((point) => point.value));
  const max = Math.max(...present.map((point) => point.value));
  const span = max - min;

  const x = (index: number) => inset + (count <= 1 ? 0 : (index * (width - inset * 2)) / (count - 1));
  // A flat series has no span to scale against; centring it is honest, pinning it
  // to the top or bottom edge would imply a trend that is not there.
  const y = (value: number) => (span === 0 ? height / 2 : inset + ((max - value) / span) * (height - inset * 2));
  return { x, y };
}

/** Where `values[index]` sits on the drawn line, as the path prints it; null when the line is not drawn or the value is missing. */
export function sparklinePoint(values: (number | null)[], index: number, width = 64, height = 16, inset = 1): { x: string; y: string } | null {
  const scale = sparklineScale(values, width, height, inset);
  const value = values[index];
  if (!scale || value === null || value === undefined || !Number.isFinite(value)) return null;
  return { x: scale.x(index).toFixed(1), y: scale.y(value).toFixed(1) };
}

/** The line's runs of consecutive values, one path each; only points `from` ≤ index < `to` are drawn, while every value sets the scale. */
export function buildSparklinePath(
  values: (number | null)[],
  width = 64,
  height = 16,
  inset = 1,
  from = 0,
  to = values.length,
): string[] {
  const scale = sparklineScale(values, width, height, inset);
  if (!scale) return [];
  const { x, y } = scale;

  const segments: string[] = [];
  let run: string[] = [];

  const flush = () => {
    // A one-point run has no line to draw; at 64px a lone dot reads as noise.
    if (run.length > 1) segments.push(run.join(" "));
    run = [];
  };

  for (const [index, value] of values.entries()) {
    if (index < from || index >= to || value === null || !Number.isFinite(value)) {
      flush();
      continue;
    }
    run.push(`${run.length === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`);
  }
  flush();

  return segments;
}

/**
 * A card's sparkline over every year from `first` to `last` (by default the points' own first and last year): a year without a
 * value is a null the line breaks on. Mapping the points instead would close the gap and re-space every later point.
 */
export function annualSeries(points: Iterable<{ year: number; value: number | null }>, first?: number, last?: number): (number | null)[] {
  const values = new Map<number, number | null>();
  for (const { year, value } of points) values.set(year, value);
  const years = [...values.keys()];
  const from = first ?? Math.min(...years), to = last ?? Math.max(...years);
  return Array.from({ length: to - from + 1 }, (_, offset) => values.get(from + offset) ?? null);
}

// The "ყველაზე დიდი წილი" KPI states a percentage, so its sparkline traces that
// percentage rather than the level — which is also why it reads jagged.
export function buildKpiShareSeries(
  row: ExplorerTableRow | null,
  years: number[],
): (number | null)[] {
  return row === null ? years.map(() => null) : years.map((year) => row.shareByYear?.[year] ?? null);
}
