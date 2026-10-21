import { SERIES_COLORS } from "./colors";
import type { SectorDefinition, SectorMeasure } from "../data/economicSectors/types";
import { matchesLabelQuery } from "../i18n/search";
import type { ClientSectorObservation } from "../servedRows";
import { refitRange, resolveRange as resolvePeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export const SECTOR_GDP = "economy.gdp_total";
export type SectorState = {
  measure: SectorMeasure;
  mode: "line" | "table";
  range: { kind: "all" } | { kind: "manual"; start: number; end: number };
  selectedIds: string[];
};
export const DEFAULT_SECTOR_STATE: SectorState = {
  measure: "nominal", mode: "line", range: { kind: "all" }, selectedIds: [SECTOR_GDP],
};

/** What a page built on this explorer changes. Plain data, so a server page can hand it to the client explorer. */
export type SectorPageConfig = {
  /** Message prefix: `sectors.*` or `gdpExpenditure.*`. */
  scope: "sectors" | "gdpExpenditure" | "expenditureTypes";
  /** Workbook file name stem. */
  fileStem: string;
  defaultSelectedIds: readonly string[];
  /** A selected row a measure has no data for moves to this row in that measure (GDP by expenditure's households). */
  measureStandIns: Readonly<Record<string, string>>;
  /** The share view's headline series; null names the largest row. */
  shareHeadlineId: string | null;
  /** Rank the list by size (Sectors) or keep registry order under the registry's headings. */
  ranked: boolean;
  /** List every registry row in every measure (Sectors), or only the rows a measure has data for. */
  listEveryRow: boolean;
  highlights: boolean;
  /** The measures the toolbar offers; every one when omitted. */
  measures?: readonly SectorMeasure[];
  /** The pinned total row; Total GDP when omitted. */
  totalId?: string;
};
export const SECTORS_PAGE_CONFIG: SectorPageConfig = {
  scope: "sectors", fileStem: "economic-sectors", defaultSelectedIds: [SECTOR_GDP], measureStandIns: {}, shareHeadlineId: null, ranked: true, listEveryRow: true, highlights: true,
};
/** The page's pinned total row. */
export function sectorTotalId(config: SectorPageConfig): string {
  return config.totalId ?? SECTOR_GDP;
}
export const ALL_SECTOR_MEASURES: readonly SectorMeasure[] = ["nominal", "share_of_gdp", "real_growth"];

export function defaultSectorState(config: SectorPageConfig): SectorState {
  return { ...DEFAULT_SECTOR_STATE, selectedIds: [...config.defaultSelectedIds] };
}

/** The list order: ranked by the range's end values, or the registry's own order. */
export function orderSectorDefinitions(registry: readonly SectorDefinition[], endValues: Record<string, number | null>, config: SectorPageConfig) {
  return config.ranked ? rankSectorDefinitions(registry, endValues) : [...registry].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function rankSectorDefinitions(registry: readonly SectorDefinition[], endValues: Record<string, number | null>) {
  return [...registry].sort((a, b) => {
    if (a.id === SECTOR_GDP) return -1;
    if (b.id === SECTOR_GDP) return 1;
    const av = endValues[a.id], bv = endValues[b.id];
    if (av == null && bv != null) return 1;
    if (bv == null && av != null) return -1;
    return (av != null && bv != null ? bv - av : 0) || a.sortOrder - b.sortOrder;
  });
}

/** Search across both labels and the NACE code with the site's shared matcher. */
export function sectorMatchesQuery(definition: SectorDefinition, query: string): boolean {
  return matchesLabelQuery(query, [definition.labelKa, definition.labelEn, definition.classificationCode ?? ""]);
}

export function sectorColor(id: string): string {
  const color = SERIES_COLORS[id];
  if (!color) throw new Error(`No colour for economic sector ${id}`);
  return color;
}

export function parseSectorHash(hash: string, validIds: readonly string[], config: SectorPageConfig = SECTORS_PAGE_CONFIG): SectorState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const measure = (config.measures ?? ALL_SECTOR_MEASURES).find(m => m !== "nominal" && m === p.get("measure")) ?? "nominal";
  return {
    measure,
    mode: p.get("view") === "table" ? "table" : "line",
    selectedIds: p.has("sel") ? [...new Set(p.get("sel")!.split(","))].filter(id => validIds.includes(id)) : [...config.defaultSelectedIds],
    range: parseYearRangeKeys(p),
  };
}

export function serializeSectorHash(state: SectorState): string {
  const p = new URLSearchParams({ measure: state.measure, view: state.mode, sel: state.selectedIds.join(",") });
  writeYearRangeKeys(p, state.range);
  return p.toString();
}

function resolveRange(state: SectorState, facts: readonly ClientSectorObservation[]) {
  const availableYears = [...new Set(facts.filter(f => f.measure === state.measure).map(f => f.year))].sort((a,b)=>a-b);
  if (!availableYears.length) throw new Error(`No available sector years for ${state.measure}`);
  const min = availableYears[0], max = availableYears.at(-1)!;
  return { availableYears, ...resolvePeriodRange(state.range, { min, max }) };
}

/** How many sectors the share view opens with when only Total GDP was selected (plan default Q6, not yet confirmed by the owner). */
export const SHARE_DEFAULT_SECTORS = 5;

export function changeSectorMeasure(state: SectorState, measure: SectorMeasure, facts: readonly ClientSectorObservation[], config: SectorPageConfig = SECTORS_PAGE_CONFIG): SectorState {
  const range = resolveRange({ ...state, measure }, facts);
  // A row the measure has no data for moves to its stand-in, or leaves the selection.
  const available = new Set(facts.filter((f) => f.measure === measure).map((f) => f.seriesId));
  const selectedIds = config.listEveryRow ? state.selectedIds : [...new Set(state.selectedIds.flatMap((id) => {
    const target = available.has(id) ? id : config.measureStandIns[id];
    return target && available.has(target) ? [target] : [];
  }))];
  const next = { ...state, measure, selectedIds, range: refitRange(state.range, range, { collapseToAll: false }) };
  // Total GDP is 100% of itself: alone in the share view it is one flat line. The view opens on the five
  // largest sectors at the range's end instead (U11-01).
  if (measure !== "share_of_gdp" || state.selectedIds.length !== 1 || state.selectedIds[0] !== SECTOR_GDP) return next;
  const end = resolveRange(next, facts).end;
  const largest = facts
    .filter((f) => f.measure === measure && f.year === end && f.seriesId !== SECTOR_GDP)
    .sort((a, b) => b.value - a.value)
    .slice(0, SHARE_DEFAULT_SECTORS)
    .map((f) => f.seriesId);
  return largest.length ? { ...next, selectedIds: largest } : next;
}

export function buildEconomicSectorsModel(facts: readonly ClientSectorObservation[], registry: readonly SectorDefinition[], state: SectorState, sourceIdByMeasure: Record<string, string>, config: SectorPageConfig = SECTORS_PAGE_CONFIG) {
  const range = resolveRange(state, facts);
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const active = facts.filter(f => f.measure === state.measure && f.year >= range.start && f.year <= range.end);
  const byCell = new Map(active.map(f => [`${f.seriesId}:${f.year}`, f]));
  const endValues = Object.fromEntries(registry.map(r => [r.id, byCell.get(`${r.id}:${range.end}`)?.value ?? null]));
  const definitions = orderSectorDefinitions(registry, endValues, config);
  const measured = new Set(facts.filter(f => f.measure === state.measure).map(f => f.seriesId));
  const selected = definitions.filter(r => state.selectedIds.includes(r.id));
  const hasData = active.some(f => state.selectedIds.includes(f.seriesId));
  const percent = state.measure !== "nominal";
  const rows = selected.map(r => ({
    itemId: r.id, kaLabel: r.labelKa, color: sectorColor(r.id),
    valuesByYear: Object.fromEntries(years.map(year => {
      const value = byCell.get(`${r.id}:${year}`)?.value;
      return [year, value === undefined ? null : percent ? value / 100 : value];
    })),
    preliminaryByYear: Object.fromEntries(years.map(year => [year, byCell.get(`${r.id}:${year}`)?.status === "preliminary"])),
  }));
  return {
    range, years, availableYears: range.availableYears, rows,
    series: selected.map(r => ({ id: r.id, label: r.labelKa, color: sectorColor(r.id),
      vals: years.map(year => byCell.get(`${r.id}:${year}`)?.value ?? null),
      preliminary: years.map(year => byCell.get(`${r.id}:${year}`)?.status === "preliminary"),
    })),
    endValues,
    /** The listed rows, in list order: every row, or those this measure has any data for. */
    visibleIds: definitions.filter(r => config.listEveryRow || measured.has(r.id)).map(r => r.id),
    // Total GDP's own share is always 100%: the share view's headline is the largest sector's share in the latest
    // year (U11-01). The ranked list and the chart name it; the line itself stays one line at 375px.
    headline: (state.measure === "share_of_gdp"
      ? active.filter(f => config.shareHeadlineId ? f.seriesId === config.shareHeadlineId : f.seriesId !== sectorTotalId(config)).toSorted((a,b)=>a.year-b.year || a.value-b.value)
      : active.filter(f => f.seriesId === sectorTotalId(config)).toSorted((a,b)=>a.year-b.year)).at(-1) ?? null,
    sourceIds: hasData && sourceIdByMeasure[state.measure] ? [sourceIdByMeasure[state.measure]!] : [],
    hasData,
  };
}
