import { buildContributionIndex } from "../data/inflation/contributions";
import { periodFromKey, periodKey } from "../data/inflation/periods";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "../data/inflation/types";

// Pure state and data selection for the inflation categories section, mirroring
// lib/explorer/inflationOverview.ts. Components compose these; nothing here
// renders or reads the DOM.

export const CATEGORY_TABS = ["yoy", "mom", "contrib"] as const;
export type CategoryTab = (typeof CATEGORY_TABS)[number];

export const DIVISION_IDS = Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`);

/** The residual segment's id. Not a category: it is what the selection leaves over. */
export const RESIDUAL_ID = "cpi.cat.residual";

export type CategoryRange = { kind: "all" } | { kind: "manual"; start: number; end: number };
export type CategoryState = {
  tab: CategoryTab;
  mode: "chart" | "table";
  range: CategoryRange;
  selected: string[];
  expanded: string[];
  tableSeries: string | null;
};

// The section exists for the decomposition, so it lands there even though the two
// rate tabs are listed first (spec §6). All twelve divisions start selected: the
// reader removes what they do not want rather than the page hiding data (spec §1.2).
export const DEFAULT_CATEGORY_STATE: CategoryState = {
  tab: "contrib",
  mode: "chart",
  range: { kind: "all" },
  selected: DIVISION_IDS,
  expanded: [],
  tableSeries: null,
};

export type CategoryNode = { categoryId: string; level: 2 | 3; children: string[] };
export type CategoryIndex = {
  /** `${categoryId}:${measure}` → period → published change. */
  values: Map<string, Map<number, number>>;
  contributions: Map<string, Map<number, number>>;
  tree: CategoryNode[];
  weights: Map<string, Map<number, number>>;
  order: string[];
};
export type ResolvedPeriodRange = { min: number; max: number; start: number; end: number };

const TAB_MEASURE: Record<"yoy" | "mom", "yoy_pct" | "mom_pct"> = { yoy: "yoy_pct", mom: "mom_pct" };

/** Divisions ascending, each division's subgroups directly after it. */
function coicopOrder(categoryId: string): [number, number] {
  const [division, subgroup] = categoryId.replace("cpi.cat.", "").split("_");
  return [Number(division), subgroup === undefined ? 0 : Number(subgroup)];
}

function byCoicop(a: string, b: string): number {
  const [divisionA, subA] = coicopOrder(a);
  const [divisionB, subB] = coicopOrder(b);
  return divisionA - divisionB || subA - subB;
}

export function buildCategoryIndex(facts: ServedCpiCategoryFact[], weights: ServedBasketWeightRow[]): CategoryIndex {
  const values = new Map<string, Map<number, number>>();
  const levels = new Map<string, 2 | 3>();
  const children = new Map<string, string[]>();
  for (const fact of facts) {
    const group = `${fact.categoryId}:${fact.measure}`;
    if (!values.has(group)) values.set(group, new Map());
    values.get(group)!.set(periodFromKey(fact.period), fact.value);
    levels.set(fact.categoryId, fact.level);
    if (fact.level === 3 && fact.parentId !== null) {
      const siblings = children.get(fact.parentId) ?? [];
      if (!siblings.includes(fact.categoryId)) children.set(fact.parentId, [...siblings, fact.categoryId]);
    }
  }

  const weightMap = new Map<string, Map<number, number>>();
  for (const row of weights) {
    if (!weightMap.has(row.categoryId)) weightMap.set(row.categoryId, new Map());
    weightMap.get(row.categoryId)!.set(row.year, row.weightPct);
  }

  const order = [...levels.keys()].sort(byCoicop);
  const tree = order
    .filter((categoryId) => levels.get(categoryId) === 2)
    .map((categoryId) => ({
      categoryId,
      level: 2 as const,
      children: (children.get(categoryId) ?? []).sort(byCoicop),
    }));

  return { values, contributions: buildContributionIndex(facts, weights), tree, weights: weightMap, order };
}

export function categoryValues(index: CategoryIndex, categoryId: string, tab: CategoryTab): Map<number, number> | undefined {
  if (tab === "contrib") return index.contributions.get(categoryId);
  return index.values.get(`${categoryId}:${TAB_MEASURE[tab]}`);
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
  if (min === Infinity) throw new Error("Category data has no periods");
  return { min, max };
}

export function categoryCoverage(index: CategoryIndex, tab: CategoryTab): { min: number; max: number } {
  if (tab === "contrib") return bounds([...index.contributions.values()]);
  const measure = TAB_MEASURE[tab];
  return bounds([...index.values].filter(([group]) => group.endsWith(`:${measure}`)).map(([, map]) => map));
}

export function resolveCategoryRange(state: CategoryState, index: CategoryIndex): ResolvedPeriodRange {
  const { min, max } = categoryCoverage(index, state.tab);
  if (state.range.kind === "all") return { min, max, start: min, end: max };
  const start = Math.max(min, state.range.start);
  const end = Math.min(max, state.range.end);
  return start > end ? { min, max, start: min, end: max } : { min, max, start, end };
}

/** Spec §8: keep "all" as all, intersect a manual range, fall back when nothing overlaps. */
export function changeCategoryTab(state: CategoryState, tab: CategoryTab, index: CategoryIndex): CategoryState {
  const next = { ...state, tab };
  if (state.range.kind === "all") return next;
  const { min, max } = categoryCoverage(index, tab);
  const start = Math.max(min, state.range.start);
  const end = Math.min(max, state.range.end);
  if (start > end || (start === min && end === max)) return { ...next, range: { kind: "all" } };
  return { ...next, range: { kind: "manual", start, end } };
}

export function rangeFromPatch(range: ResolvedPeriodRange, patch: { start?: number; end?: number }): CategoryRange {
  const start = patch.start ?? range.start;
  const end = patch.end ?? range.end;
  return start === range.min && end === range.max ? { kind: "all" } : { kind: "manual", start, end };
}

export function toggleCategory(state: CategoryState, categoryId: string, index: CategoryIndex): CategoryState {
  const next = state.selected.includes(categoryId)
    ? state.selected.filter((entry) => entry !== categoryId)
    : [...state.selected, categoryId];
  const known = new Set(index.order);
  return { ...state, selected: next.filter((entry) => known.has(entry)).sort(byCoicop) };
}

export function toggleExpanded(state: CategoryState, categoryId: string): CategoryState {
  return {
    ...state,
    expanded: state.expanded.includes(categoryId)
      ? state.expanded.filter((entry) => entry !== categoryId)
      : [...state.expanded, categoryId],
  };
}

/**
 * The residual is the published headline minus the selected contributions, so the
 * stack always closes on the figure Geostat published — whether the whole basket
 * is selected or three subgroups are. It absorbs both the unselected categories
 * and the basket-rebasing approximation (spec §4.6).
 */
export function buildStackModel(
  index: CategoryIndex,
  state: CategoryState,
  range: ResolvedPeriodRange,
  headline: Map<number, number>,
) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const segments = state.selected
    .filter((categoryId) => index.contributions.has(categoryId))
    .map((categoryId) => ({
      categoryId,
      values: periods.map((period) => index.contributions.get(categoryId)?.get(period) ?? null),
    }));
  const headlineValues = periods.map((period) => headline.get(period) ?? null);
  const residual = periods.map((period, position) => {
    const published = headlineValues[position];
    if (published === null) return 0;
    return published - segments.reduce((sum, segment) => sum + (segment.values[position] ?? 0), 0);
  });
  return { periods, segments, residual, headline: headlineValues };
}

export function buildCategoryLines(index: CategoryIndex, state: CategoryState, range: ResolvedPeriodRange) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const lines = state.selected.flatMap((categoryId) => {
    const values = categoryValues(index, categoryId, state.tab);
    return values ? [{ key: categoryId, values: periods.map((period) => values.get(period) ?? null) }] : [];
  });
  return { periods, lines };
}

function lastInRange(values: Map<number, number> | undefined, range: ResolvedPeriodRange): number | null {
  if (!values) return null;
  for (let period = range.end; period >= range.start; period -= 1) {
    const value = values.get(period);
    if (value !== undefined) return value;
  }
  return null;
}

export function panelValue(index: CategoryIndex, categoryId: string, state: CategoryState, range: ResolvedPeriodRange): number | null {
  return lastInRange(categoryValues(index, categoryId, state.tab), range);
}

/** The basket share shown on every selector row: the latest year the weights cover. */
export function latestWeight(index: CategoryIndex, categoryId: string): number | null {
  const byYear = index.weights.get(categoryId);
  if (!byYear || byYear.size === 0) return null;
  return byYear.get(Math.max(...byYear.keys())) ?? null;
}

export function tableSeriesOptions(index: CategoryIndex, state: CategoryState): string[] {
  return state.selected.filter((categoryId) => categoryValues(index, categoryId, state.tab) !== undefined);
}

export function effectiveTableSeries(index: CategoryIndex, state: CategoryState): string | null {
  const options = tableSeriesOptions(index, state);
  return state.tableSeries !== null && options.includes(state.tableSeries) ? state.tableSeries : (options[0] ?? null);
}

/** Spec §6: the indicators always describe the latest published month, whatever the range. */
export function latestContributors(index: CategoryIndex, count = 4) {
  if (index.contributions.size === 0) return null;
  const period = bounds([...index.contributions.values()]).max;
  const window = Array.from({ length: 36 }, (_, offset) => period - 35 + offset);
  const ranked = index.tree
    .flatMap((node) => {
      const value = index.contributions.get(node.categoryId)?.get(period);
      return value === undefined ? [] : [{ categoryId: node.categoryId, value }];
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, count)
    .map((entry) => ({
      ...entry,
      changePct: index.values.get(`${entry.categoryId}:yoy_pct`)?.get(period) ?? null,
      weightPct: latestWeight(index, entry.categoryId),
      spark: window.map((month) => index.contributions.get(entry.categoryId)?.get(month) ?? null),
    }));
  return ranked.length === 0 ? null : { period, contributors: ranked };
}

const RANGE_PARAM = /^(\d{4}-\d{2})-(\d{4}-\d{2})$/;
const CATEGORY_ID = /^cpi\.cat\.(0[1-9]|1[0-2])(_[1-9])?$/;

export function parseCategoryHash(hash: string): CategoryState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const tab = CATEGORY_TABS.find((entry) => entry === params.get("i")) ?? DEFAULT_CATEGORY_STATE.tab;
  let range: CategoryRange = { kind: "all" };
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
  // Unknown categories are dropped rather than failing the page (spec §8).
  const selected = params.has("sel")
    ? (params.get("sel") ?? "")
        .split(",")
        .filter((entry) => CATEGORY_ID.test(entry))
        .sort(byCoicop)
    : DEFAULT_CATEGORY_STATE.selected;
  const expanded = (params.get("x") ?? "").split(",").filter((entry) => CATEGORY_ID.test(entry));
  const tableSeries = CATEGORY_ID.test(params.get("t") ?? "") ? params.get("t") : null;
  return { tab, mode: params.get("m") === "table" ? "table" : "chart", range, selected, expanded, tableSeries };
}

export function serializeCategoryHash(state: CategoryState): string {
  const params = new URLSearchParams({ i: state.tab, m: state.mode });
  if (state.range.kind === "manual") params.set("r", `${periodKey(state.range.start)}-${periodKey(state.range.end)}`);
  params.set("sel", state.selected.join(","));
  if (state.expanded.length > 0) params.set("x", state.expanded.join(","));
  if (state.tableSeries !== null) params.set("t", state.tableSeries);
  return params.toString();
}
