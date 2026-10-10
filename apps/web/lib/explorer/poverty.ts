import type { ClientPovertyFact, PovertyGroup, PovertyIndicator } from "../data/poverty/types";
import { colorForItem, INK } from "./colors";
import { resolveRange, refitRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export const POVERTY_SECTIONS = [
  { id: "rates", href: "/explorer/poverty/rates", labelKey: "common.povertyRates" },
  { id: "inequality", href: "/explorer/poverty/inequality", labelKey: "common.povertyInequality" },
] as const;
export type PovertySectionId = typeof POVERTY_SECTIONS[number]["id"];
/** The tabs of the rates page; the inequality page has one view. */
export type PovertyView = "absolute" | "relative" | "international" | "main";
const RATE_VIEWS = ["absolute", "relative", "international"] as const;

export function povertyViews(section: PovertySectionId): readonly PovertyView[] {
  return section === "rates" ? RATE_VIEWS : ["main"];
}

export type PovertySeriesDefinition = { id: string; indicatorId: PovertyIndicator; groupId: PovertyGroup; reference: boolean; parentId?: string };
const seriesId = (indicatorId: PovertyIndicator, groupId: PovertyGroup) => `${indicatorId}|${groupId}`;
const line = (indicatorId: PovertyIndicator, reference: boolean): PovertySeriesDefinition => ({ id: seriesId(indicatorId, "georgia"), indicatorId, groupId: "georgia", reference });
/** A Georgia line followed by its groups, which nest under it. */
function withGroups(indicatorId: PovertyIndicator, reference: boolean, groups: readonly PovertyGroup[]): PovertySeriesDefinition[] {
  const parent = line(indicatorId, reference);
  return [parent, ...groups.map(groupId => ({ id: seriesId(indicatorId, groupId), indicatorId, groupId, reference: false, parentId: parent.id }))];
}
const SETTLEMENTS = ["settlement.urban", "settlement.rural"] as const;
const GINI: readonly PovertyIndicator[] = ["gini.total_income", "gini.cash_inflows", "gini.total_inflows", "gini.consumption_expenditure", "gini.cash_expenditure", "gini.total_expenditure"];

/** The series a view offers, reference first. */
export function povertyViewSeries(section: PovertySectionId, view: PovertyView): PovertySeriesDefinition[] {
  if (section === "inequality") return GINI.map((indicatorId, index) => line(indicatorId, index === 0));
  if (view === "relative") return [...withGroups("poverty.relative_60", true, SETTLEMENTS), ...withGroups("poverty.relative_40", false, SETTLEMENTS)];
  if (view === "international") return (["poverty.international_300", "poverty.international_420", "poverty.international_830"] as const).map((indicatorId, index) => line(indicatorId, index === 0));
  return withGroups("poverty.absolute", true, [...SETTLEMENTS, "age.0_17", "age.18_64", "age.65_plus", "sex.female", "sex.male"]);
}

export function povertySeriesColor(series: PovertySeriesDefinition, index: number): string {
  return series.reference ? INK : colorForItem(series.id, index);
}

export type PovertyState = { mode: "line" | "table"; range: PeriodRange; view: PovertyView; selectedIds: string[] };

const cellKey = (f: { indicatorId: string; groupId: string; year: number }) => `${f.indicatorId}:${f.groupId}:${f.year}`;

/** A view's years: every year any of its series has a value. */
export function povertyCoverage(section: PovertySectionId, view: PovertyView, facts: readonly ClientPovertyFact[]) {
  const ids = new Set(povertyViewSeries(section, view).map(s => s.id));
  const years = [...new Set(facts.filter(f => ids.has(seriesId(f.indicatorId, f.groupId))).map(f => f.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error(`No poverty years for ${section}:${view}`);
  return { min: years[0], max: years.at(-1)!, years };
}

export function defaultPovertyState(section: PovertySectionId): PovertyState {
  const view = povertyViews(section)[0];
  return { mode: "line", range: { kind: "all" }, view, selectedIds: [povertyViewSeries(section, view)[0].id] };
}

export function parsePovertyHash(hash: string, section: PovertySectionId, facts: readonly ClientPovertyFact[]): PovertyState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const views = povertyViews(section);
  const view = views.find(item => item === p.get("tab")) ?? views[0];
  const series = povertyViewSeries(section, view);
  const requested = p.has("sel") ? p.get("sel")!.split(",") : [series[0].id];
  return {
    mode: p.get("view") === "table" ? "table" : "line", view,
    range: refitRange(parseYearRangeKeys(p), povertyCoverage(section, view, facts), { collapseToAll: true }),
    selectedIds: series.map(s => s.id).filter(id => requested.includes(id)),
  };
}

export function serializePovertyHash(state: PovertyState, section: PovertySectionId): string {
  const p = new URLSearchParams();
  if (povertyViews(section).length > 1) p.set("tab", state.view);
  p.set("view", state.mode);
  p.set("sel", state.selectedIds.join(","));
  writeYearRangeKeys(p, state.range);
  return p.toString();
}

/** Switching tab keeps mode and years (clamped to the tab's coverage), and selects the new tab's reference. */
export function changePovertyView(state: PovertyState, section: PovertySectionId, view: PovertyView, facts: readonly ClientPovertyFact[]): PovertyState {
  return { ...state, view, selectedIds: [povertyViewSeries(section, view)[0].id], range: refitRange(state.range, povertyCoverage(section, view, facts), { collapseToAll: true }) };
}

export type PovertySeriesModel = PovertySeriesDefinition & { color: string; valuesByYear: Record<number, number | null>; endValue: number | null };
export type PovertyModel = { range: ResolvedPeriodRange; years: number[]; series: PovertySeriesModel[]; selected: PovertySeriesModel[]; decimals: number };

export function buildPovertyModel(section: PovertySectionId, facts: readonly ClientPovertyFact[], state: PovertyState): PovertyModel {
  const range = resolveRange(state.range, povertyCoverage(section, state.view, facts));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  const series = povertyViewSeries(section, state.view).map((definition, index) => {
    const valuesByYear = Object.fromEntries(years.map(year => [year, byCell.get(cellKey({ ...definition, year }))?.value ?? null]));
    return { ...definition, color: povertySeriesColor(definition, index), valuesByYear, endValue: valuesByYear[range.end] };
  });
  return { range, years, series, selected: series.filter(s => state.selectedIds.includes(s.id)), decimals: state.view === "main" ? 2 : 1 };
}
