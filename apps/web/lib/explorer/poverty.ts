import type { ClientPovertyFact, PovertyGroup, PovertyIndicator } from "../data/poverty/types";
import { refitRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";

export const POVERTY_SECTIONS = [
  { id: "rates", href: "/explorer/living-standards/poverty", labelKey: "common.povertyRates" },
  { id: "inequality", href: "/explorer/living-standards/inequality", labelKey: "common.povertyInequality" },
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

export const povertySeriesColor = (series: PovertySeriesDefinition, index: number): string => topicSeriesColor(series, index);

export type PovertyState = TopicState & { view: PovertyView };

const cellKey = (f: { indicatorId: string; groupId: string; year: number }) => `${f.indicatorId}:${f.groupId}:${f.year}`;

/** A view's years: every year any of its series has a value. */
export function povertyCoverage(section: PovertySectionId, view: PovertyView, facts: readonly ClientPovertyFact[]) {
  const ids = new Set(povertyViewSeries(section, view).map(s => s.id));
  return topicCoverage(facts.filter(f => ids.has(seriesId(f.indicatorId, f.groupId))).map(f => f.year), `No poverty years for ${section}:${view}`);
}

export function defaultPovertyState(section: PovertySectionId): PovertyState {
  const view = povertyViews(section)[0];
  return { mode: "line", range: { kind: "all" }, view, selectedIds: [povertyViewSeries(section, view)[0].id] };
}

export function parsePovertyHash(hash: string, section: PovertySectionId, facts: readonly ClientPovertyFact[]): PovertyState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const view = topicHashView(p, povertyViews(section));
  const series = povertyViewSeries(section, view);
  return { ...parseTopicHash(p, series, [series[0].id], povertyCoverage(section, view, facts)), view };
}

export function serializePovertyHash(state: PovertyState, section: PovertySectionId): string {
  const p = new URLSearchParams();
  if (povertyViews(section).length > 1) p.set("tab", state.view);
  return serializeTopicHash(state, p);
}

/**
 * Switching tab keeps mode and years (clamped to the tab's coverage), and selects the new tab's reference.
 * A chosen range is never collapsed to "all", so 2004–2024 picked on International lines stays 2004–2024
 * on a tab that runs to 2025.
 */
export function changePovertyView(state: PovertyState, section: PovertySectionId, view: PovertyView, facts: readonly ClientPovertyFact[]): PovertyState {
  return { ...state, view, selectedIds: [povertyViewSeries(section, view)[0].id], range: refitRange(state.range, povertyCoverage(section, view, facts), { collapseToAll: false }) };
}

export type PovertySeriesModel = TopicSeriesModel<PovertySeriesDefinition>;
export type PovertyModel = { range: ResolvedPeriodRange; years: number[]; series: PovertySeriesModel[]; selected: PovertySeriesModel[]; decimals: number };

export function buildPovertyModel(section: PovertySectionId, facts: readonly ClientPovertyFact[], state: PovertyState): PovertyModel {
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  return {
    ...buildTopicModel({ range: state.range, coverage: povertyCoverage(section, state.view, facts), definitions: povertyViewSeries(section, state.view), selectedIds: state.selectedIds,
      value: (definition, year) => byCell.get(cellKey({ ...definition, year }))?.value, color: povertySeriesColor }),
    decimals: state.view === "main" ? 2 : 1,
  };
}
