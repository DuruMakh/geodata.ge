import { colorForItem, INK } from "./colors";
import { refitRange, resolveRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

// The model the topic explorers share (poverty, household income and spending, wages, money and banks,
// energy and food): each page configures its series, facts and hash keys; the rules live here once.

/** A series of a topic page. The reference is drawn in ink; `parentId` nests a series under another in the list. */
export type TopicSeriesDefinition = { id: string; reference: boolean; parentId?: string };
export type TopicSeriesModel<D extends TopicSeriesDefinition> = D & { color: string; valuesByYear: Record<number, number | null>; endValue: number | null };
/** The view every topic page keeps in its hash; a page adds its own tab or measure. */
export type TopicState = { mode: "line" | "table"; range: PeriodRange; selectedIds: string[] };
export type TopicCoverage = { min: number; max: number; years: number[] };

/** The reference is drawn in ink, every other series in its stable item colour, keyed by the series id unless `key` says otherwise. */
export function topicSeriesColor(series: TopicSeriesDefinition, index: number, key = series.id): string {
  return series.reference ? INK : colorForItem(key, index);
}

/** A page's years: every year given, once and in order. No year at all is an error, worded by `missing`. */
export function topicCoverage(years: Iterable<number>, missing: string): TopicCoverage {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  if (!sorted.length) throw new Error(missing);
  return { min: sorted[0], max: sorted.at(-1)!, years: sorted };
}

/** The tab a hash names (`tab`), or the page's first view. */
export function topicHashView<V extends string>(p: URLSearchParams, views: readonly V[]): V {
  return views.find(item => item === p.get("tab")) ?? views[0];
}

/**
 * Reads the hash keys every topic page shares: chart or table (`view`), the selection (`sel`, kept to `series`
 * and in their order, `fallback` when the hash has none) and the years, refitted to `coverage`.
 */
export function parseTopicHash(p: URLSearchParams, series: readonly { id: string }[], fallback: readonly string[], coverage: TopicCoverage): TopicState {
  const requested = p.has("sel") ? p.get("sel")!.split(",") : fallback;
  return {
    mode: p.get("view") === "table" ? "table" : "line",
    range: refitRange(parseYearRangeKeys(p), coverage, { collapseToAll: true }),
    selectedIds: series.map(s => s.id).filter(id => requested.includes(id)),
  };
}

/** Writes the shared hash keys after any tab or measure key the page has already set on `p`. */
export function serializeTopicHash(state: TopicState, p = new URLSearchParams()): string {
  p.set("view", state.mode);
  p.set("sel", state.selectedIds.join(","));
  writeYearRangeKeys(p, state.range);
  return p.toString();
}

/** The resolved years and each series' values over them (with its colour and end-year value), plus the selected series. */
export function buildTopicModel<D extends TopicSeriesDefinition>(input: {
  range: PeriodRange; coverage: TopicCoverage; definitions: readonly D[]; selectedIds: readonly string[];
  value: (definition: D, year: number) => number | null | undefined; color: (definition: D, index: number) => string;
}): { range: ResolvedPeriodRange; years: number[]; series: TopicSeriesModel<D>[]; selected: TopicSeriesModel<D>[] } {
  const range = resolveRange(input.range, input.coverage);
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const series = input.definitions.map((definition, index) => {
    const valuesByYear = Object.fromEntries(years.map(year => [year, input.value(definition, year) ?? null]));
    return { ...definition, color: input.color(definition, index), valuesByYear, endValue: valuesByYear[range.end] };
  });
  return { range, years, series, selected: series.filter(s => input.selectedIds.includes(s.id)) };
}
