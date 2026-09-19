import { makePeriod, periodMonth, periodYear } from "../data/inflation/periods";

// The year × month grid behind ცხრილი (spec §7.1). Colour is never the only cue:
// every cell prints its value, and a legend names the bins.

export type GridCell = { kind: "empty" } | { kind: "missing" } | { kind: "value"; value: number; bin: number | null };
export type GridRow = { year: number; cells: GridCell[]; summary: GridCell | null };

export const YOY_BINS = [0, 3, 6, 10] as const;
export const MOM_BINS = [0, 0.5, 1, 2] as const;
// Contributions are percentage points, so they need their own bins: a 1.7 pp
// contribution is large where a 1.7% price change is not.
export const CONTRIBUTION_BINS = [0, 0.25, 0.75, 1.5] as const;

// Deflation, then four warm steps to the accent. Each pair is checked ≥ 4.5:1
// in tests; the accent step carries paper text.
export const GRID_TINTS = [
  { background: "#DCE4F2", text: "#1E1B16" },
  { background: "#F1EADC", text: "#1E1B16" },
  { background: "#EBCDBB", text: "#1E1B16" },
  { background: "#D9967C", text: "#1E1B16" },
  { background: "#B3402A", text: "#F7F2E9" },
] as const;

/** The one-decimal value a reader sees; −0.0 reads as 0.0, so it prints and bins as zero. */
export function displayedValue(value: number): number {
  return Number(value.toFixed(1)) + 0;
}

export function binFor(value: number, edges: readonly number[]): number {
  const index = edges.findIndex((edge) => value < edge);
  return index === -1 ? edges.length : index;
}

export function legendLabels(edges: readonly number[]): string[] {
  return [`< ${edges[0]}%`, ...edges.slice(0, -1).map((edge, index) => `${edge}–${edges[index + 1]}%`), `≥ ${edges.at(-1)}%`];
}

/** The unit is passed in: `%` is language-neutral, `პპ` / `pp` is not. */
export function legendLabelsPp(edges: readonly number[], unit: string): string[] {
  return [`< ${edges[0]} ${unit}`, ...edges.slice(0, -1).map((edge, index) => `${edge}–${edges[index + 1]} ${unit}`), `≥ ${edges.at(-1)} ${unit}`];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.x contrast ratio between two #RRGGBB colours. */
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

/** Geostat's December 12-month average is the calendar-year average inflation. */
export function decemberAverages(avg12: Map<number, number> | undefined): Map<number, number> {
  const result = new Map<number, number>();
  for (const [period, value] of avg12 ?? []) if (periodMonth(period) === 12) result.set(periodYear(period), value);
  return new Map([...result].sort((a, b) => a[0] - b[0]));
}

export function buildMonthGrid(input: {
  values: Map<number, number>;
  range: { start: number; end: number };
  edges: readonly number[] | null;
  summaryByYear?: Map<number, number>;
}): GridRow[] {
  const { values, range, edges, summaryByYear } = input;
  const periods = [...values.keys()];
  if (periods.length === 0) return [];
  const first = Math.min(...periods);
  const last = Math.max(...periods);
  const topYear = Math.min(periodYear(range.end), periodYear(last));
  const bottomYear = Math.max(periodYear(range.start), periodYear(first));
  const valueCell = (value: number, tinted: boolean): GridCell => ({ kind: "value", value, bin: tinted && edges ? binFor(displayedValue(value), edges) : null });

  const rows: GridRow[] = [];
  for (let year = topYear; year >= bottomYear; year -= 1) {
    const cells = Array.from({ length: 12 }, (_, offset): GridCell => {
      const period = makePeriod(year, offset + 1);
      if (period < range.start || period > range.end || period > last) return { kind: "empty" };
      const value = values.get(period);
      return value === undefined ? { kind: "missing" } : valueCell(value, true);
    });
    const summaryValue = summaryByYear?.get(year);
    const summary = summaryByYear === undefined ? null : summaryValue === undefined ? { kind: "empty" as const } : valueCell(summaryValue, false);
    rows.push({ year, cells, summary });
  }
  return rows;
}
