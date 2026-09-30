import { periodFromKey, periodKey } from "../data/inflation/periods";
import { CPI_CITY_IDS, type CityFactInput, type CpiCityMeasure } from "../data/inflation/types";
import { decemberAverages } from "./inflationGrid";
import type { CityView } from "./inflationCityRoutes";
import { periodBounds, rangeFromPatch, refitRange, resolveRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseMonthRangeKey, writeMonthRangeKey } from "./urlState";

// Pure state and data selection for the inflation cities pages
// (docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md). On the
// Georgia page a line is a place on the total; on a city page it is one of that
// city's 13 series. Annual inflation only. Nothing here renders or reads the DOM.

export type { CityView };
export const GEORGIA_LINE_ID = "country.georgia";
export const HEADLINE_ID = "cpi.headline";
export const CITY_LINE_IDS = [GEORGIA_LINE_ID, ...CPI_CITY_IDS] as const;
export type CityLineId = (typeof CITY_LINE_IDS)[number];
export const CITY_CATEGORIES: readonly string[] = [HEADLINE_ID, ...Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`)];

export type CityState = {
  mode: "chart" | "table";
  range: PeriodRange;
  selected: string[];
  tableSeries: string | null;
};

export function cityViewLineIds(view: CityView): readonly string[] {
  return view.kind === "georgia" ? CITY_LINE_IDS : CITY_CATEGORIES;
}

/** Which place and series a line draws. */
export function cityLineSource(view: CityView, lineId: string): { entityId: string; seriesId: string } {
  return view.kind === "georgia" ? { entityId: lineId, seriesId: HEADLINE_ID } : { entityId: view.cityId, seriesId: lineId };
}

// The Georgia page opens on all seven lines (owner decision 2026-09-26); a city
// page on its total alone, the project's default rule.
export function defaultCityState(view: CityView): CityState {
  return { mode: "chart", range: { kind: "all" }, selected: view.kind === "georgia" ? [...CITY_LINE_IDS] : [HEADLINE_ID], tableSeries: null };
}

const factKey = (lineId: string, seriesId: string, measure: string) => `${lineId}|${seriesId}|${measure}`;

export type CityIndex = { values: Map<string, Map<number, number>> };
export type { ResolvedPeriodRange };

/** Dense runs per series, as the categories page packs its facts. */
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

function lineValues(index: CityIndex, view: CityView, lineId: string): Map<number, number> | undefined {
  const { entityId, seriesId } = cityLineSource(view, lineId);
  return cityValues(index, entityId, seriesId, "yoy_pct");
}

/** A page's coverage: every one of its lines. Zugdidi's page therefore starts 2016-12. */
export function cityCoverage(index: CityIndex, view: CityView): { min: number; max: number } {
  return periodBounds(cityViewLineIds(view).map((lineId) => lineValues(index, view, lineId)), "City data has no periods");
}

export function resolveCityRange(state: CityState, index: CityIndex, view: CityView): ResolvedPeriodRange {
  return resolveRange(state.range, cityCoverage(index, view));
}

export { rangeFromPatch };

export function toggleCityLine(state: CityState, view: CityView, lineId: string): CityState {
  const next = state.selected.includes(lineId) ? state.selected.filter((entry) => entry !== lineId) : [...state.selected, lineId];
  return { ...state, selected: cityViewLineIds(view).filter((entry) => next.includes(entry)) };
}

export function toggleAllCityLines(state: CityState, view: CityView): CityState {
  return { ...state, selected: state.selected.length > 0 ? [] : [...cityViewLineIds(view)] };
}

export function buildCityLines(index: CityIndex, view: CityView, state: CityState, range: ResolvedPeriodRange) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const lines = state.selected.flatMap((lineId) => {
    const values = lineValues(index, view, lineId);
    return values ? [{ key: lineId, values: periods.map((period) => values.get(period) ?? null) }] : [];
  });
  return { periods, lines };
}

export function cityPanelValue(index: CityIndex, view: CityView, lineId: string, range: ResolvedPeriodRange): number | null {
  const values = lineValues(index, view, lineId);
  if (!values) return null;
  for (let period = range.end; period >= range.start; period -= 1) {
    const value = values.get(period);
    if (value !== undefined) return value;
  }
  return null;
}

export function cityTableOptions(index: CityIndex, view: CityView, state: CityState): string[] {
  return state.selected.filter((lineId) => lineValues(index, view, lineId) !== undefined);
}

export function effectiveCityTableSeries(index: CityIndex, view: CityView, state: CityState): string | null {
  const options = cityTableOptions(index, view, state);
  return state.tableSeries !== null && options.includes(state.tableSeries) ? state.tableSeries : (options[0] ?? null);
}

/** Geostat's December 12-month average: the table's წლის საშუალო, for a total line only. */
export function cityAnnualAverages(index: CityIndex, view: CityView, lineId: string): Map<number, number> | undefined {
  const { entityId, seriesId } = cityLineSource(view, lineId);
  if (seriesId !== HEADLINE_ID) return undefined;
  return decemberAverages(cityValues(index, entityId, HEADLINE_ID, "avg12_pct"));
}

/** Short, stable hash values: place slugs on the Georgia page, `total` and COICOP codes on a city page. */
export function cityLineSlug(view: CityView, lineId: string): string {
  if (view.kind === "georgia") return lineId.split(".")[1]!;
  return lineId === HEADLINE_ID ? "total" : lineId.replace("cpi.cat.", "");
}

export function parseCityHash(hash: string, view: CityView): CityState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const ids = cityViewLineIds(view);
  const bySlug = new Map(ids.map((lineId) => [cityLineSlug(view, lineId), lineId]));
  // Unknown values — and the retired `i` and `c` keys — are dropped rather than failing the page.
  const requested = (params.get("sel") ?? "").split(",");
  return {
    mode: params.get("m") === "table" ? "table" : "chart",
    range: parseMonthRangeKey(params),
    selected: params.has("sel") ? ids.filter((lineId) => requested.includes(cityLineSlug(view, lineId))) : defaultCityState(view).selected,
    tableSeries: bySlug.get(params.get("t") ?? "") ?? null,
  };
}

/** The hash, read after hydration, with its range refitted to the page's coverage. */
export function restoreCityState(hash: string, index: CityIndex, view: CityView): CityState {
  const parsed = parseCityHash(hash, view);
  return { ...parsed, range: refitRange(parsed.range, cityCoverage(index, view), { collapseToAll: true }) };
}

export function serializeCityHash(state: CityState, view: CityView): string {
  const params = new URLSearchParams({ m: state.mode });
  writeMonthRangeKey(params, state.range);
  params.set("sel", state.selected.map((lineId) => cityLineSlug(view, lineId)).join(","));
  if (state.tableSeries !== null) params.set("t", cityLineSlug(view, state.tableSeries));
  return params.toString();
}
