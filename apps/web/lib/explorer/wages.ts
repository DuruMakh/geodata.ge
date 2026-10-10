import { WAGES_SECTORS, WAGES_REGIONS, type ClientWagesFact, type WagesDimension, type WagesIndicator } from "../data/wages/types";
import { colorForItem, INK } from "./colors";
import { resolveRange, refitRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export const WAGES_SECTIONS = [
  { id: "overview", href: "/explorer/wages/overview", labelKey: "common.wagesOverview" },
  { id: "industries", href: "/explorer/wages/industries", labelKey: "common.wagesIndustries" },
  { id: "regions", href: "/explorer/wages/regions", labelKey: "common.wagesRegions" },
] as const;
export type WagesSectionId = typeof WAGES_SECTIONS[number]["id"];
export const wagesRegionHref = (regionId: string): `/${string}` => `/explorer/wages/regions/${regionId.replace(/^region\./, "")}`;
/** Whose wages the Industries page shows; "median" is Georgia's median, the rest are averages. */
export const WAGES_INDUSTRY_GROUPS = ["georgia", "women", "men", "public", "non_public", "business", "non_business", "median"] as const;
export type WagesIndustryGroup = typeof WAGES_INDUSTRY_GROUPS[number];
/** The selectable views of one page: Industries' groups; the other pages have one. */
export type WagesView = WagesIndustryGroup | "main";

export type WagesSeriesDefinition = { id: string; indicatorId: WagesIndicator; dimension: WagesDimension; groupId: string; sectorId: string; reference: boolean; parentId?: string };
const AVERAGE: WagesIndicator = "average_monthly_nominal_earnings";
const MEDIAN: WagesIndicator = "median_monthly_earnings";
const georgiaAverage: WagesSeriesDefinition = { id: "average", indicatorId: AVERAGE, dimension: "national", groupId: "georgia", sectorId: "total", reference: true };
const groupTotal = (dimension: WagesDimension, groupId: string): WagesSeriesDefinition => ({ id: groupId, indicatorId: AVERAGE, dimension, groupId, sectorId: "total", reference: false });
const DIMENSION_OF_GROUP: Record<Exclude<WagesIndustryGroup, "median">, WagesDimension> = { georgia: "national", women: "sex", men: "sex", public: "ownership", non_public: "ownership", business: "business_sector", non_business: "business_sector" };

export function wagesViews(section: WagesSectionId): readonly WagesView[] {
  return section === "industries" ? WAGES_INDUSTRY_GROUPS : ["main"];
}

/**
 * The series a view offers, reference first. Industries lists the sections that
 * appear in the facts for the chosen group, so a section its tables never publish
 * is not offered, while one published only as unavailable (public-sector mining)
 * is offered and shows dashes.
 */
export function wagesViewSeries(section: WagesSectionId, view: WagesView, facts: readonly ClientWagesFact[]): WagesSeriesDefinition[] {
  // Overview: women, men, public and non-public are subcategories of the average; the median stands alone.
  if (section === "overview") return [
    georgiaAverage,
    ...([["sex", "women"], ["sex", "men"], ["ownership", "public"], ["ownership", "non_public"]] as const).map(([dimension, groupId]) => ({ ...groupTotal(dimension, groupId), parentId: georgiaAverage.id })),
    { id: "median", indicatorId: MEDIAN, dimension: "national", groupId: "georgia", sectorId: "total", reference: false },
  ];
  // A region page receives only its own region's facts: the region leads, with the Georgia average beside it.
  if (section === "regions") {
    const region = WAGES_REGIONS.find(id => facts.some(f => f.dimension === "region" && f.groupId === id))!;
    return [{ ...groupTotal("region", region), reference: true }, { ...georgiaAverage, reference: false }];
  }
  const group = view as WagesIndustryGroup;
  const indicatorId = group === "median" ? MEDIAN : AVERAGE;
  const dimension = group === "median" ? "national" : DIMENSION_OF_GROUP[group];
  const groupId = group === "median" ? "georgia" : group;
  const published = new Set<string>(facts.filter(f => f.indicatorId === indicatorId && f.dimension === dimension && f.groupId === groupId).map(f => f.sectorId));
  return ["total", ...WAGES_SECTORS].filter(sectorId => published.has(sectorId)).map(sectorId => ({ id: sectorId, indicatorId, dimension, groupId, sectorId, reference: sectorId === "total" }));
}

export function wagesSeriesColor(series: WagesSeriesDefinition, index: number): string {
  return series.reference ? INK : colorForItem(series.sectorId === "total" ? `wages.${series.groupId}` : series.sectorId, index);
}

export type WagesState = { mode: "line" | "table"; range: PeriodRange; view: WagesView; selectedIds: string[] };

function cellKey(f: { indicatorId: string; dimension: string; groupId: string; sectorId: string; year: number }) {
  return `${f.indicatorId}:${f.dimension}:${f.groupId}:${f.sectorId}:${f.year}`;
}
function seriesYears(series: readonly WagesSeriesDefinition[], facts: readonly ClientWagesFact[]): number[] {
  const keys = new Set(series.map(s => `${s.indicatorId}:${s.dimension}:${s.groupId}:${s.sectorId}`));
  return [...new Set(facts.filter(f => f.value !== null && keys.has(`${f.indicatorId}:${f.dimension}:${f.groupId}:${f.sectorId}`)).map(f => f.year))].sort((a, b) => a - b);
}
/**
 * A view's years: every year its compared groups have a published value. The Georgia
 * average or a group's all-activities total does not stretch a comparison back to years
 * before its groups were published; only the Overview, where the average is itself
 * the main measure, takes its years, and a region page takes its region's years.
 */
export function wagesCoverage(section: WagesSectionId, view: WagesView, facts: readonly ClientWagesFact[]) {
  const series = wagesViewSeries(section, view, facts);
  const compared = section === "overview" ? series : section === "regions" ? series.filter(s => s.dimension === "region") : series.filter(s => !s.reference);
  const years = seriesYears(compared, facts);
  if (!years.length) throw new Error(`No wages years for ${section}:${view}`);
  return { min: years[0], max: years.at(-1)!, years };
}

export function defaultWagesState(section: WagesSectionId, facts: readonly ClientWagesFact[]): WagesState {
  const view = wagesViews(section)[0];
  return { mode: "line", range: { kind: "all" }, view, selectedIds: [wagesViewSeries(section, view, facts)[0].id] };
}

export function parseWagesHash(hash: string, section: WagesSectionId, facts: readonly ClientWagesFact[]): WagesState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const views = wagesViews(section);
  const view = views.find(item => item === p.get("tab")) ?? views[0];
  const series = wagesViewSeries(section, view, facts);
  const requested = p.has("sel") ? p.get("sel")!.split(",") : [series[0].id];
  return {
    mode: p.get("view") === "table" ? "table" : "line", view,
    range: refitRange(parseYearRangeKeys(p), wagesCoverage(section, view, facts), { collapseToAll: true }),
    selectedIds: series.map(s => s.id).filter(id => requested.includes(id)),
  };
}

export function serializeWagesHash(state: WagesState, section: WagesSectionId): string {
  const p = new URLSearchParams();
  if (wagesViews(section).length > 1) p.set("tab", state.view);
  p.set("view", state.mode);
  p.set("sel", state.selectedIds.join(","));
  writeYearRangeKeys(p, state.range);
  return p.toString();
}

/** Switching group keeps mode and years, and selects the new view's reference. */
export function changeWagesView(state: WagesState, section: WagesSectionId, view: WagesView, facts: readonly ClientWagesFact[]): WagesState {
  return { ...state, view, selectedIds: [wagesViewSeries(section, view, facts)[0].id], range: refitRange(state.range, wagesCoverage(section, view, facts), { collapseToAll: true }) };
}

export type WagesSeriesModel = WagesSeriesDefinition & { color: string; valuesByYear: Record<number, number | null>; endValue: number | null; decimals: number };
export type WagesModel = { range: ResolvedPeriodRange; years: number[]; series: WagesSeriesModel[]; selected: WagesSeriesModel[]; decimals: number };

export function buildWagesModel(section: WagesSectionId, facts: readonly ClientWagesFact[], state: WagesState): WagesModel {
  const range = resolveRange(state.range, wagesCoverage(section, state.view, facts));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  const series = wagesViewSeries(section, state.view, facts).map((definition, index) => {
    const valuesByYear = Object.fromEntries(years.map(year => [year, byCell.get(cellKey({ ...definition, year }))?.value ?? null]));
    return { ...definition, color: wagesSeriesColor(definition, index), valuesByYear, endValue: valuesByYear[range.end], decimals: definition.indicatorId === MEDIAN ? 0 : 1 };
  });
  const selected = series.filter(s => state.selectedIds.includes(s.id));
  return { range, years, series, selected, decimals: Math.max(0, ...(selected.length ? selected : series).map(s => s.decimals)) };
}

/** Industries' heatmap: every section of the chosen group for the active years, independent of selection. */
export function buildWagesHeatmap(model: WagesModel) {
  const rows = model.series.filter(s => !s.reference).map(s => ({ id: s.id, values: model.years.map(year => s.valuesByYear[year]) }));
  return { years: model.years, rows, maximum: Math.max(0, ...rows.flatMap(row => row.values.filter((value): value is number => value !== null))) };
}
