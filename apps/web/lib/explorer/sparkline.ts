// Sparkline path geometry (DESIGN.md §7.11). Kept pure so it can be unit-tested
// in the node environment — the component around it is a thin SVG wrapper.

import type { ExplorerTableRow } from "./types";

type Point = { value: number; index: number };

export function buildSparklinePath(
  values: (number | null)[],
  width = 64,
  height = 16,
  inset = 1,
): string[] {
  const present: Point[] = [];
  for (const [index, value] of values.entries()) {
    if (value !== null && Number.isFinite(value)) present.push({ value, index });
  }
  if (present.length < 2) return [];

  const count = values.length;
  const min = Math.min(...present.map((point) => point.value));
  const max = Math.max(...present.map((point) => point.value));
  const span = max - min;

  const x = (index: number) => inset + (count <= 1 ? 0 : (index * (width - inset * 2)) / (count - 1));
  // A flat series has no span to scale against; centring it is honest, pinning it
  // to the top or bottom edge would imply a trend that is not there.
  const y = (value: number) => (span === 0 ? height / 2 : inset + ((max - value) / span) * (height - inset * 2));

  const segments: string[] = [];
  let run: string[] = [];

  const flush = () => {
    // A one-point run has no line to draw; at 64px a lone dot reads as noise.
    if (run.length > 1) segments.push(run.join(" "));
    run = [];
  };

  for (const [index, value] of values.entries()) {
    if (value === null || !Number.isFinite(value)) {
      flush();
      continue;
    }
    run.push(`${run.length === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`);
  }
  flush();

  return segments;
}

// The "ყველაზე დიდი წილი" KPI states a percentage, so its sparkline traces that
// percentage rather than the level — which is also why it reads jagged.
export function buildKpiShareSeries(
  row: ExplorerTableRow | null,
  totalRow: ExplorerTableRow | null,
  years: number[],
): (number | null)[] {
  if (row === null || totalRow === null) return years.map(() => null);

  return years.map((year) => {
    const value = row.valuesByYear[year];
    const total = totalRow.valuesByYear[year];
    if (value === null || value === undefined) return null;
    if (total === null || total === undefined || total === 0) return null;
    return value / total;
  });
}
