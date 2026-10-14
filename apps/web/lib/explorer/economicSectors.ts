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

export function parseSectorHash(hash: string, validIds: readonly string[]): SectorState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const measure = p.get("measure");
  return {
    measure: measure === "share_of_gdp" || measure === "real_growth" ? measure : "nominal",
    mode: p.get("view") === "table" ? "table" : "line",
    selectedIds: p.has("sel") ? [...new Set(p.get("sel")!.split(","))].filter(id => validIds.includes(id)) : [SECTOR_GDP],
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

export function changeSectorMeasure(state: SectorState, measure: SectorMeasure, facts: readonly ClientSectorObservation[]): SectorState {
  const range = resolveRange({ ...state, measure }, facts);
  const next = { ...state, measure, range: refitRange(state.range, range, { collapseToAll: false }) };
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

export function buildEconomicSectorsModel(facts: readonly ClientSectorObservation[], registry: readonly SectorDefinition[], state: SectorState, sourceIdByMeasure: Record<string, string>) {
  const range = resolveRange(state, facts);
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const active = facts.filter(f => f.measure === state.measure && f.year >= range.start && f.year <= range.end);
  const byCell = new Map(active.map(f => [`${f.seriesId}:${f.year}`, f]));
  const endValues = Object.fromEntries(registry.map(r => [r.id, byCell.get(`${r.id}:${range.end}`)?.value ?? null]));
  const definitions = rankSectorDefinitions(registry, endValues);
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
    // Total GDP's own share is always 100%: the share view's headline is the largest sector's share in the latest
    // year (U11-01). The ranked list and the chart name it; the line itself stays one line at 375px.
    headline: (state.measure === "share_of_gdp"
      ? active.filter(f => f.seriesId !== SECTOR_GDP).toSorted((a,b)=>a.year-b.year || a.value-b.value)
      : active.filter(f => f.seriesId === SECTOR_GDP).toSorted((a,b)=>a.year-b.year)).at(-1) ?? null,
    sourceIds: hasData && sourceIdByMeasure[state.measure] ? [sourceIdByMeasure[state.measure]!] : [],
    hasData,
  };
}
