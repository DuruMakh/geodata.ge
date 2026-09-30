import { periodFromKey, periodKey } from "../data/inflation/periods";
import { CPI_CITY_IDS, type CityFactInput, type CpiCityMeasure } from "../data/inflation/types";
import { decemberAverages } from "./inflationGrid";
import { periodBounds, rangeFromPatch, refitRange, resolveRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseMonthRangeKey, writeMonthRangeKey } from "./urlState";

// Pure state and data selection for the inflation cities section
// (docs/superpowers/specs/2026-09-26-inflation-cities-design.md). Components
// compose these; nothing here renders or reads the DOM.

export const GEORGIA_LINE_ID = "country.georgia";
export const HEADLINE_ID = "cpi.headline";
export const CITY_LINE_IDS = [GEORGIA_LINE_ID, ...CPI_CITY_IDS] as const;
export type CityLineId = (typeof CITY_LINE_IDS)[number];
export const CITY_TABS = ["yoy", "mom"] as const;
export type CityTab = (typeof CITY_TABS)[number];
export const CITY_CATEGORIES: readonly string[] = [HEADLINE_ID, ...Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`)];

export type CityState = {
  tab: CityTab;
  mode: "chart" | "table";
  range: PeriodRange;
  category: string;
  selected: CityLineId[];
  tableSeries: CityLineId | null;
};

// All seven lines start selected: a Cities page that opened on Georgia alone
// would show nothing city-specific (spec §1.1, owner decision 2026-09-26).
export const DEFAULT_CITY_STATE: CityState = {
  tab: "yoy",
  mode: "chart",
  range: { kind: "all" },
  category: HEADLINE_ID,
  selected: [...CITY_LINE_IDS],
  tableSeries: null,
};

const TAB_MEASURE: Record<CityTab, CpiCityMeasure> = { yoy: "yoy_pct", mom: "mom_pct" };
const factKey = (lineId: string, seriesId: string, measure: string) => `${lineId}|${seriesId}|${measure}`;

export type CityIndex = { values: Map<string, Map<number, number>> };
export type { ResolvedPeriodRange };

/** Dense runs per series, as the categories page packs its facts: ~22,000 rows cross the wire. */
export type PackedCitySeries = { k: string; s: string; v: Array<number | null> };

export function packCityFacts(facts: CityFactInput[]): PackedCitySeries[] {
  const byKey = new Map<string, Map<number, number>>();
  for (const fact of facts) {
    const key = factKey(fact.lineId, fact.seriesId, fact.measure);
    if (!byKey.has(key)) byKey.set(key, new Map());
    byKey.get(key)!.set(periodFromKey(fact.period), fact.value);
  }
  return [...byKey].map(([k, values]) => {
    const periods = [...values.keys()].sort((a, b) => a - b);
    const start = periods[0]!;
    const end = periods.at(-1)!;
    return { k, s: periodKey(start), v: Array.from({ length: end - start + 1 }, (_, offset) => values.get(start + offset) ?? null) };
  });
}

export function unpackCityFacts(series: PackedCitySeries[]): CityFactInput[] {
  return series.flatMap(({ k, s, v }) => {
    const [lineId, seriesId, measure] = k.split("|") as [string, string, CpiCityMeasure];
    const start = periodFromKey(s);
    return v.flatMap((value, offset) => (value === null ? [] : [{ lineId, seriesId, measure, period: periodKey(start + offset), value }]));
  });
}

export function buildCityIndex(facts: CityFactInput[]): CityIndex {
  const values = new Map<string, Map<number, number>>();
  for (const fact of facts) {
    const key = factKey(fact.lineId, fact.seriesId, fact.measure);
    if (!values.has(key)) values.set(key, new Map());
    values.get(key)!.set(periodFromKey(fact.period), fact.value);
  }
  return { values };
}

export function cityValues(index: CityIndex, lineId: string, seriesId: string, measure: CpiCityMeasure): Map<number, number> | undefined {
  return index.values.get(factKey(lineId, seriesId, measure));
}

/** A tab's coverage: every line's total on that measure. Zugdidi's late start does not narrow it. */
export function cityCoverage(index: CityIndex, tab: CityTab): { min: number; max: number } {
  return periodBounds(CITY_LINE_IDS.map((lineId) => cityValues(index, lineId, HEADLINE_ID, TAB_MEASURE[tab])), "City data has no periods");
}

export function resolveCityRange(state: CityState, index: CityIndex): ResolvedPeriodRange {
  return resolveRange(state.range, cityCoverage(index, state.tab));
}

export function changeCityTab(state: CityState, tab: CityTab, index: CityIndex): CityState {
  return { ...state, tab, range: refitRange(state.range, cityCoverage(index, tab), { collapseToAll: true }) };
}

export { rangeFromPatch };

export function toggleCityLine(state: CityState, lineId: CityLineId): CityState {
  const next = state.selected.includes(lineId) ? state.selected.filter((entry) => entry !== lineId) : [...state.selected, lineId];
  return { ...state, selected: CITY_LINE_IDS.filter((entry) => next.includes(entry)) };
}

export function toggleAllCityLines(state: CityState): CityState {
  return { ...state, selected: state.selected.length > 0 ? [] : [...CITY_LINE_IDS] };
}

export function buildCityLines(index: CityIndex, state: CityState, range: ResolvedPeriodRange) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const lines = state.selected.flatMap((lineId) => {
    const values = cityValues(index, lineId, state.category, TAB_MEASURE[state.tab]);
    return values ? [{ key: lineId, values: periods.map((period) => values.get(period) ?? null) }] : [];
  });
  return { periods, lines };
}

export function cityPanelValue(index: CityIndex, lineId: CityLineId, state: CityState, range: ResolvedPeriodRange): number | null {
  const values = cityValues(index, lineId, state.category, TAB_MEASURE[state.tab]);
  if (!values) return null;
  for (let period = range.end; period >= range.start; period -= 1) {
    const value = values.get(period);
    if (value !== undefined) return value;
  }
  return null;
}

export function cityTableOptions(index: CityIndex, state: CityState): CityLineId[] {
  return state.selected.filter((lineId) => cityValues(index, lineId, state.category, TAB_MEASURE[state.tab]) !== undefined);
}

export function effectiveCityTableSeries(index: CityIndex, state: CityState): CityLineId | null {
  const options = cityTableOptions(index, state);
  return state.tableSeries !== null && options.includes(state.tableSeries) ? state.tableSeries : (options[0] ?? null);
}

/** Geostat's December 12-month average: the table's წლის საშუალო, for the total on the annual tab only. */
export function cityAnnualAverages(index: CityIndex, state: CityState, lineId: string): Map<number, number> | undefined {
  if (state.tab !== "yoy" || state.category !== HEADLINE_ID) return undefined;
  return decemberAverages(cityValues(index, lineId, HEADLINE_ID, "avg12_pct"));
}

const CATEGORY_CODE = /^(0[1-9]|1[0-2])$/;
const slug = (lineId: string) => lineId.split(".")[1]!;
const LINE_BY_SLUG = new Map(CITY_LINE_IDS.map((lineId) => [slug(lineId), lineId]));

export function parseCityHash(hash: string): CityState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const tab = CITY_TABS.find((entry) => entry === params.get("i")) ?? DEFAULT_CITY_STATE.tab;
  const code = params.get("c") ?? "";
  // Unknown values are dropped rather than failing the page (spec §8).
  const requested = (params.get("sel") ?? "").split(",");
  return {
    tab,
    mode: params.get("m") === "table" ? "table" : "chart",
    range: parseMonthRangeKey(params),
    category: CATEGORY_CODE.test(code) ? `cpi.cat.${code}` : HEADLINE_ID,
    selected: params.has("sel") ? CITY_LINE_IDS.filter((lineId) => requested.includes(slug(lineId))) : [...CITY_LINE_IDS],
    tableSeries: LINE_BY_SLUG.get(params.get("t") ?? "") ?? null,
  };
}

export function serializeCityHash(state: CityState): string {
  const params = new URLSearchParams({ i: state.tab, m: state.mode });
  writeMonthRangeKey(params, state.range);
  params.set("c", state.category === HEADLINE_ID ? "total" : state.category.replace("cpi.cat.", ""));
  params.set("sel", state.selected.map(slug).join(","));
  if (state.tableSeries !== null) params.set("t", slug(state.tableSeries));
  return params.toString();
}
