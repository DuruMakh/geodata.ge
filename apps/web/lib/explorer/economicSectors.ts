import { EDITORIAL_PALETTE, INK, colorForProgram } from "./colors";
import type { SectorDefinition, SectorMeasure } from "../data/economicSectors/types";
import { matchesLabelQuery } from "../i18n/search";
import type { ClientSectorObservation } from "../servedRows";

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
  if (id === SECTOR_GDP) return INK;
  const index = id.charCodeAt(id.length - 1) - 97;
  return index < EDITORIAL_PALETTE.length ? EDITORIAL_PALETTE[index] : colorForProgram(EDITORIAL_PALETTE[index - EDITORIAL_PALETTE.length], 1);
}

export function parseSectorHash(hash: string, validIds: readonly string[]): SectorState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const measure = p.get("measure");
  const start = Number(p.get("start")), end = Number(p.get("end"));
  return {
    measure: measure === "share_of_gdp" || measure === "real_growth" ? measure : "nominal",
    mode: p.get("view") === "table" ? "table" : "line",
    selectedIds: p.has("sel") ? [...new Set(p.get("sel")!.split(","))].filter(id => validIds.includes(id)) : [SECTOR_GDP],
    range: p.get("range") !== "all" && p.has("start") && p.has("end") && Number.isInteger(start) && Number.isInteger(end) && start > 0 && end > 0
      ? { kind: "manual", start: Math.min(start, end), end: Math.max(start, end) } : { kind: "all" },
  };
}

export function serializeSectorHash(state: SectorState): string {
  const p = new URLSearchParams({ measure: state.measure, view: state.mode, sel: state.selectedIds.join(",") });
  if (state.range.kind === "all") p.set("range", "all");
  else { p.set("start", String(state.range.start)); p.set("end", String(state.range.end)); }
  return p.toString();
}

function resolveRange(state: SectorState, facts: readonly ClientSectorObservation[]) {
  const availableYears = [...new Set(facts.filter(f => f.measure === state.measure).map(f => f.year))].sort((a,b)=>a-b);
  if (!availableYears.length) throw new Error(`No available sector years for ${state.measure}`);
  const min = availableYears[0], max = availableYears.at(-1)!;
  const manual = state.range.kind === "manual" && state.range.end >= min && state.range.start <= max ? state.range : null;
  return { availableYears, min, max, start: manual ? Math.max(min, manual.start) : min, end: manual ? Math.min(max, manual.end) : max };
}

export function changeSectorMeasure(state: SectorState, measure: SectorMeasure, facts: readonly ClientSectorObservation[]): SectorState {
  const range = resolveRange({ ...state, measure }, facts);
  return { ...state, measure, range: state.range.kind === "all" || state.range.end < range.min || state.range.start > range.max
    ? { kind: "all" } : { kind: "manual", start: range.start, end: range.end } };
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
      vals: years.map(year => byCell.get(`${r.id}:${year}`)?.value ?? null), planned: years.map(() => false),
      preliminary: years.map(year => byCell.get(`${r.id}:${year}`)?.status === "preliminary"),
    })),
    endValues,
    headline: active.filter(f => f.seriesId === SECTOR_GDP).sort((a,b)=>a.year-b.year).at(-1) ?? null,
    preliminaryYears: [...new Set(active.filter(f => f.status === "preliminary").map(f=>f.year))],
    sourceIds: hasData && sourceIdByMeasure[state.measure] ? [sourceIdByMeasure[state.measure]!] : [],
    hasData,
  };
}
