import { periodFromKey, periodKey } from "../data/inflation/periods";
import type { CpiMeasure, CpiSeriesId } from "../data/inflation/types";
import type { ClientCpiFact, ClientInflationTargetRow } from "../servedRows";
import { ACCENT, INK } from "./colors";

// Pure state and data selection for the inflation overview. Components compose
// these; nothing here renders or reads the DOM.

export const INFLATION_TABS = ["yoy", "mom", "index"] as const;
export type InflationTab = (typeof INFLATION_TABS)[number];
export const INFLATION_SERIES = ["cpi", "core", "core_ex_tobacco"] as const;
export type InflationSeriesKey = (typeof INFLATION_SERIES)[number];
export type InflationSelectionKey = InflationSeriesKey | "target";
export const SELECTION_ORDER: readonly InflationSelectionKey[] = ["cpi", "core", "core_ex_tobacco", "target"];

const TAB_MEASURE: Record<InflationTab, CpiMeasure> = { yoy: "yoy_pct", mom: "mom_pct", index: "index_2010" };
const SERIES_DATA_ID: Record<InflationSeriesKey, CpiSeriesId> = { cpi: "cpi.headline", core: "cpi.core", core_ex_tobacco: "cpi.core_ex_tobacco" };

// Headline is ink, like every total; core takes the editorial blue; the target
// is the accent, drawn dashed (DESIGN.md §4.2). Two blues would not separate.
export const INFLATION_COLORS: Record<InflationSelectionKey, string> = {
  cpi: INK,
  core: "#3D5A98",
  core_ex_tobacco: "#A5822B",
  target: ACCENT,
};

export type InflationRange = { kind: "all" } | { kind: "manual"; start: number; end: number };
export type InflationState = {
  tab: InflationTab;
  mode: "line" | "table";
  range: InflationRange;
  selected: InflationSelectionKey[];
  tableSeries: InflationSeriesKey | null;
};

// The target is a reference line, not a series, so "headline only" still holds.
export const DEFAULT_INFLATION_STATE: InflationState = { tab: "yoy", mode: "line", range: { kind: "all" }, selected: ["cpi", "target"], tableSeries: null };

export type InflationIndex = { values: Map<string, Map<number, number>>; sourceIds: Map<string, string> };
export type ResolvedPeriodRange = { min: number; max: number; start: number; end: number };

export function seriesGroup(key: InflationSeriesKey, tab: InflationTab): string {
  return `${SERIES_DATA_ID[key]}:${TAB_MEASURE[tab]}`;
}

export function indexInflationFacts(
  facts: ClientCpiFact[],
  sourceIdBySeriesMeasure: Record<string, string>,
): InflationIndex {
  const values = new Map<string, Map<number, number>>();
  const sourceIds = new Map<string, string>();
  for (const fact of facts) {
    const group = `${fact.seriesId}:${fact.measure}`;
    if (!values.has(group)) values.set(group, new Map());
    values.get(group)!.set(periodFromKey(fact.period), fact.value);
    sourceIds.set(group, sourceIdBySeriesMeasure[group]!);
  }
  return { values, sourceIds };
}

export function seriesValues(index: InflationIndex, key: InflationSeriesKey, tab: InflationTab): Map<number, number> | undefined {
  return index.values.get(seriesGroup(key, tab));
}

function bounds(maps: Array<Map<number, number> | undefined>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const map of maps) {
    for (const period of map?.keys() ?? []) {
      if (period < min) min = period;
      if (period > max) max = period;
    }
  }
  if (min === Infinity) throw new Error("Inflation data has no periods");
  return { min, max };
}

export function tabCoverage(index: InflationIndex, tab: InflationTab): { min: number; max: number } {
  return bounds(INFLATION_SERIES.map((key) => seriesValues(index, key, tab)));
}

export function overallCoverage(index: InflationIndex): { min: number; max: number } {
  return bounds([...index.values.values()]);
}

export function resolveInflationRange(state: InflationState, index: InflationIndex): ResolvedPeriodRange {
  const { min, max } = tabCoverage(index, state.tab);
  if (state.range.kind === "all") return { min, max, start: min, end: max };
  const start = Math.max(min, state.range.start);
  const end = Math.min(max, state.range.end);
  return start > end ? { min, max, start: min, end: max } : { min, max, start, end };
}

/** Spec §8: keep "all" as all, intersect a manual range, fall back when nothing overlaps. */
export function changeInflationTab(state: InflationState, tab: InflationTab, index: InflationIndex): InflationState {
  const next = { ...state, tab };
  if (state.range.kind === "all") return next;
  const { min, max } = tabCoverage(index, tab);
  const start = Math.max(min, state.range.start);
  const end = Math.min(max, state.range.end);
  if (start > end || (start === min && end === max)) return { ...next, range: { kind: "all" } };
  return { ...next, range: { kind: "manual", start, end } };
}

export function rangeFromPatch(range: ResolvedPeriodRange, patch: { start?: number; end?: number }): InflationRange {
  const start = patch.start ?? range.start;
  const end = patch.end ?? range.end;
  return start === range.min && end === range.max ? { kind: "all" } : { kind: "manual", start, end };
}

export function targetForPeriod(targets: ClientInflationTargetRow[], period: number): number | null {
  const row = targets.find((entry) => periodFromKey(entry.effectiveFrom) <= period && (entry.effectiveTo === null || period <= periodFromKey(entry.effectiveTo)));
  return row ? row.targetPct : null;
}

export function buildInflationLines(index: InflationIndex, targets: ClientInflationTargetRow[], state: InflationState, range: ResolvedPeriodRange) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const lines = state.selected.flatMap((key) => {
    if (key === "target") return state.tab === "yoy" ? [{ key, values: periods.map((period) => targetForPeriod(targets, period)) }] : [];
    const values = seriesValues(index, key, state.tab);
    return values ? [{ key: key as InflationSelectionKey, values: periods.map((period) => values.get(period) ?? null) }] : [];
  });
  return { periods, lines };
}

function lastInRange(values: Map<number, number> | undefined, range: ResolvedPeriodRange): { period: number; value: number } | null {
  if (!values) return null;
  for (let period = range.end; period >= range.start; period -= 1) {
    const value = values.get(period);
    if (value !== undefined) return { period, value };
  }
  return null;
}

export function panelValue(index: InflationIndex, targets: ClientInflationTargetRow[], key: InflationSelectionKey, state: InflationState, range: ResolvedPeriodRange): number | null {
  if (key === "target") return state.tab === "yoy" ? targetForPeriod(targets, range.end) : null;
  return lastInRange(seriesValues(index, key, state.tab), range)?.value ?? null;
}

export function toggleSelection(state: InflationState, key: InflationSelectionKey): InflationState {
  const next = state.selected.includes(key) ? state.selected.filter((entry) => entry !== key) : [...state.selected, key];
  return { ...state, selected: SELECTION_ORDER.filter((entry) => next.includes(entry)) };
}

export function tableSeriesOptions(index: InflationIndex, state: InflationState): InflationSeriesKey[] {
  return state.selected.filter((key): key is InflationSeriesKey => key !== "target" && seriesValues(index, key, state.tab) !== undefined);
}

export function effectiveTableSeries(index: InflationIndex, state: InflationState): InflationSeriesKey | null {
  const options = tableSeriesOptions(index, state);
  return state.tableSeries !== null && options.includes(state.tableSeries) ? state.tableSeries : options[0] ?? null;
}

/** Spec §6: the indicators always describe the latest published month. */
export function latestIndicators(index: InflationIndex, targets: ClientInflationTargetRow[]) {
  const yoy = seriesValues(index, "cpi", "yoy");
  if (!yoy || yoy.size === 0) return null;
  const period = bounds([yoy]).max;
  const coreYoy = seriesValues(index, "core", "yoy");
  const mom = seriesValues(index, "cpi", "mom");
  const avg12 = index.values.get("cpi.headline:avg12_pct");
  const window = Array.from({ length: 36 }, (_, offset) => period - 35 + offset);
  const spark = (values: Map<number, number> | undefined) => window.map((entry) => values?.get(entry) ?? null);
  return {
    period,
    yoy: yoy.get(period)!,
    coreYoy: coreYoy?.get(period) ?? null,
    mom: mom?.get(period) ?? null,
    avg12: avg12?.get(period) ?? null,
    target: targetForPeriod(targets, period),
    sparks: { coreYoy: spark(coreYoy), mom: spark(mom), avg12: spark(avg12) },
  };
}

const RANGE_PARAM = /^(\d{4}-\d{2})-(\d{4}-\d{2})$/;

export function parseInflationHash(hash: string): InflationState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const tab = INFLATION_TABS.find((entry) => entry === params.get("i")) ?? DEFAULT_INFLATION_STATE.tab;
  let range: InflationRange = { kind: "all" };
  const match = RANGE_PARAM.exec(params.get("r") ?? "");
  if (match) {
    try {
      const a = periodFromKey(match[1]!);
      const b = periodFromKey(match[2]!);
      range = { kind: "manual", start: Math.min(a, b), end: Math.max(a, b) };
    } catch {
      range = { kind: "all" };
    }
  }
  const requested = params.has("sel") ? (params.get("sel") ?? "").split(",") : DEFAULT_INFLATION_STATE.selected;
  const selected = SELECTION_ORDER.filter((key) => requested.includes(key));
  const tableSeries = INFLATION_SERIES.find((key) => key === params.get("t")) ?? null;
  return { tab, mode: params.get("m") === "table" ? "table" : "line", range, selected, tableSeries };
}

export function serializeInflationHash(state: InflationState): string {
  const params = new URLSearchParams({ i: state.tab, m: state.mode });
  if (state.range.kind === "manual") params.set("r", `${periodKey(state.range.start)}-${periodKey(state.range.end)}`);
  params.set("sel", state.selected.join(","));
  if (state.tableSeries !== null) params.set("t", state.tableSeries);
  return params.toString();
}
