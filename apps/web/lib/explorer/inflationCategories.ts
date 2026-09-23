import { buildContributionIndex } from "../data/inflation/contributions";
import { periodFromKey, periodKey } from "../data/inflation/periods";
import type { CategoryFactInput } from "../data/inflation/types";
import type { ClientBasketWeightRow } from "../servedRows";
import { periodBounds, rangeFromPatch, refitRange, resolveRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";

// Pure state and data selection for the inflation categories section. The period
// range rules are shared with the overview (lib/explorer/periodRange.ts).
// Components compose these; nothing here renders or reads the DOM.

export const CATEGORY_TABS = ["yoy", "mom", "contrib"] as const;
export type CategoryTab = (typeof CATEGORY_TABS)[number];

export const DIVISION_IDS = Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`);

/** The residual segment's id. Not a category: it is what the selection leaves over. */
export const RESIDUAL_ID = "cpi.cat.residual";

export type CategoryRange = PeriodRange;
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
export type { ResolvedPeriodRange };

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

/**
 * The wire form of the category facts. 27,668 rows repeat 110 category/measure
 * pairs and a month string each, which prerendered to a 9 MB page; packed as one
 * dense run per series it is a fraction of that. Short keys because every byte
 * here is multiplied by 27,668 and then by two locales.
 */
export type PackedCategorySeries = { k: string; s: string; v: Array<number | null> };

export function packCategoryFacts(facts: CategoryFactInput[]): PackedCategorySeries[] {
  const byKey = new Map<string, Map<number, number>>();
  for (const fact of facts) {
    const key = `${fact.categoryId}:${fact.measure}`;
    if (!byKey.has(key)) byKey.set(key, new Map());
    byKey.get(key)!.set(periodFromKey(fact.period), fact.value);
  }
  return [...byKey].map(([k, values]) => {
    const periods = [...values.keys()].sort((a, b) => a - b);
    const start = periods[0]!;
    const end = periods.at(-1)!;
    // Dense with nulls: a gap costs four bytes, a repeated month string costs ten.
    return { k, s: periodKey(start), v: Array.from({ length: end - start + 1 }, (_, offset) => values.get(start + offset) ?? null) };
  });
}

export function unpackCategoryFacts(series: PackedCategorySeries[]): CategoryFactInput[] {
  return series.flatMap(({ k, s, v }) => {
    const [categoryId, measure] = k.split(":") as [string, CategoryFactInput["measure"]];
    const start = periodFromKey(s);
    return v.flatMap((value, offset) =>
      value === null ? [] : [{ categoryId, measure, period: periodKey(start + offset), value }],
    );
  });
}

export function buildCategoryIndex(facts: CategoryFactInput[], weights: ClientBasketWeightRow[]): CategoryIndex {
  const values = new Map<string, Map<number, number>>();
  const levels = new Map<string, 2 | 3>();
  const children = new Map<string, string[]>();
  for (const fact of facts) {
    const group = `${fact.categoryId}:${fact.measure}`;
    if (!values.has(group)) values.set(group, new Map());
    values.get(group)!.set(periodFromKey(fact.period), fact.value);
    // The ID encodes the tree, so the level and parent columns never cross the wire.
    const subgroup = fact.categoryId.includes("_");
    levels.set(fact.categoryId, subgroup ? 3 : 2);
    if (subgroup) {
      const parentId = divisionOf(fact.categoryId);
      const siblings = children.get(parentId) ?? [];
      if (!siblings.includes(fact.categoryId)) children.set(parentId, [...siblings, fact.categoryId]);
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

export function categoryCoverage(index: CategoryIndex, tab: CategoryTab): { min: number; max: number } {
  if (tab === "contrib") return periodBounds([...index.contributions.values()], "Category data has no periods");
  const measure = TAB_MEASURE[tab];
  return periodBounds([...index.values].filter(([group]) => group.endsWith(`:${measure}`)).map(([, map]) => map), "Category data has no periods");
}

export function resolveCategoryRange(state: CategoryState, index: CategoryIndex): ResolvedPeriodRange {
  return resolveRange(state.range, categoryCoverage(index, state.tab));
}

/** Spec §8: keep "all" as all, intersect a manual range, fall back when nothing overlaps. */
export function changeCategoryTab(state: CategoryState, tab: CategoryTab, index: CategoryIndex): CategoryState {
  return { ...state, tab, range: refitRange(state.range, categoryCoverage(index, tab), { collapseToAll: true }) };
}

export { rangeFromPatch };

/** `cpi.cat.01_1` → `cpi.cat.01`; a division is its own. */
function divisionOf(categoryId: string): string {
  const underscore = categoryId.indexOf("_");
  return underscore === -1 ? categoryId : categoryId.slice(0, underscore);
}

/**
 * A division and one of its own subgroups overlap: summing both would show part
 * of the basket twice and shrink the residual to hide it, so the stack would
 * still close on the published headline while misstating what it is made of.
 * Ticking either level therefore clears the other (2026-09-13 decision).
 */
function withoutOverlap(selected: string[], categoryId: string): string[] {
  return categoryId.includes("_")
    ? selected.filter((entry) => entry !== divisionOf(categoryId))
    : selected.filter((entry) => entry === categoryId || divisionOf(entry) !== categoryId);
}

/** The same rule applied to a whole list: the more specific level wins. */
function pruneOverlaps(selected: string[]): string[] {
  const covered = new Set(selected.filter((entry) => entry.includes("_")).map(divisionOf));
  return selected.filter((entry) => !covered.has(entry));
}

export function toggleCategory(state: CategoryState, categoryId: string, index: CategoryIndex): CategoryState {
  const next = state.selected.includes(categoryId)
    ? state.selected.filter((entry) => entry !== categoryId)
    : withoutOverlap([...state.selected, categoryId], categoryId);
  const known = new Set(index.order);
  return { ...state, selected: next.filter((entry) => known.has(entry)).sort(byCoicop) };
}

export type CategoryPanelRow = { categoryId: string; level: 2 | 3; hasChildren: boolean; expanded: boolean; expansionLocked: boolean };

/**
 * The rows the panel lists. 43 subgroups sit behind carets, so search has to
 * reach them: a division whose subgroup matches opens to the matches with its
 * caret locked, as buildSeriesPanelRows does on ministries. Pass `matches: null`
 * when the query is empty — then the manual caret alone decides.
 */
export function categoryPanelRows(
  index: CategoryIndex,
  expandedIds: string[],
  matches: ((categoryId: string) => boolean) | null,
): CategoryPanelRow[] {
  return index.tree.flatMap((node) => {
    const children = node.children;
    const divisionMatches = matches === null || matches(node.categoryId);
    const matched = matches === null ? children : children.filter(matches);
    if (!divisionMatches && matched.length === 0) return [];
    const expansionLocked = !divisionMatches;
    const expanded = expansionLocked || expandedIds.includes(node.categoryId);
    const shown = expanded ? (expansionLocked ? matched : children) : [];
    return [
      { categoryId: node.categoryId, level: 2 as const, hasChildren: children.length > 0, expanded, expansionLocked },
      ...shown.map((categoryId) => ({ categoryId, level: 3 as const, hasChildren: false, expanded: false, expansionLocked: false })),
    ];
  });
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
  const period = periodBounds([...index.contributions.values()], "Category data has no periods").max;
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

export type CategoryIndicatorEntry = {
  categoryId: string;
  changePct: number;
  contribution: number | null;
  weightPct: number | null;
  spark: Array<number | null>;
};

export type CategoryIndicators = {
  period: number;
  /**
   * Null when the newest published month has no contribution yet. Weights refresh
   * annually and CPI monthly, so a January vintage can carry rates before weights;
   * the three rate measures below need no weights and still stand.
   */
  hero: { categoryId: string; value: number; changePct: number | null; weightPct: number | null; spark: Array<number | null> } | null;
  fastestRise: CategoryIndicatorEntry | null;
  /** The weakest division. `fell` says whether it actually got cheaper or merely rose least. */
  weakest: (CategoryIndicatorEntry & { fell: boolean }) | null;
  /** How widespread inflation is: divisions with rising prices, out of those with data. */
  breadth: { rose: number; total: number; spark: Array<number | null> };
};

const SPARK_MONTHS = 36;

/**
 * Spec §6: the indicators always describe the latest published month, whatever the
 * range. Four different questions rather than one ranked four ways — which group
 * drives the headline, what rose fastest, what is weakest, and how many groups are
 * rising at all. Divisions only; a subgroup is part of its division, not a peer.
 */
export function latestCategoryIndicators(index: CategoryIndex): CategoryIndicators | null {
  const divisions = index.tree.map((node) => node.categoryId);
  const annual = divisions.flatMap((categoryId) => {
    const values = index.values.get(`${categoryId}:yoy_pct`);
    return values ? [{ categoryId, values }] : [];
  });
  if (annual.length === 0) return null;
  const period = periodBounds(annual.map((entry) => entry.values), "Category data has no periods").max;
  const window = Array.from({ length: SPARK_MONTHS }, (_, offset) => period - SPARK_MONTHS + 1 + offset);

  const present = annual.flatMap((entry) => {
    const changePct = entry.values.get(period);
    return changePct === undefined ? [] : [{ ...entry, changePct }];
  });
  if (present.length === 0) return null;

  const entryFor = (row: (typeof present)[number]): CategoryIndicatorEntry => ({
    categoryId: row.categoryId,
    changePct: row.changePct,
    contribution: index.contributions.get(row.categoryId)?.get(period) ?? null,
    weightPct: latestWeight(index, row.categoryId),
    spark: window.map((month) => row.values.get(month) ?? null),
  });

  const ranked = [...present].sort((a, b) => b.changePct - a.changePct);
  const fastest = ranked[0]!;
  const weakest = ranked.at(-1)!;

  const heroRanked = divisions
    .flatMap((categoryId) => {
      const value = index.contributions.get(categoryId)?.get(period);
      return value === undefined ? [] : [{ categoryId, value }];
    })
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const top = heroRanked[0];

  return {
    period,
    hero: top
      ? {
          categoryId: top.categoryId,
          value: top.value,
          changePct: index.values.get(`${top.categoryId}:yoy_pct`)?.get(period) ?? null,
          weightPct: latestWeight(index, top.categoryId),
          spark: window.map((month) => index.contributions.get(top.categoryId)?.get(month) ?? null),
        }
      : null,
    fastestRise: entryFor(fastest),
    weakest: { ...entryFor(weakest), fell: weakest.changePct < 0 },
    breadth: {
      rose: present.filter((row) => row.changePct > 0).length,
      total: present.length,
      spark: window.map((month) => {
        const withData = annual.filter((entry) => entry.values.get(month) !== undefined);
        return withData.length === 0 ? null : withData.filter((entry) => entry.values.get(month)! > 0).length;
      }),
    },
  };
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
    ? pruneOverlaps(
        (params.get("sel") ?? "")
          .split(",")
          .filter((entry) => CATEGORY_ID.test(entry))
          .sort(byCoicop),
      )
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
