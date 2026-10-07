import type { ClientUnemploymentObservation, UnemploymentBreakdown, UnemploymentGroupDefinition, UnemploymentIndicator, UnemploymentSex } from "../data/unemployment/types";
import { unemploymentIndicators, unemploymentIsRate } from "../data/unemployment/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";
import { unemploymentCoverage, unemploymentReferenceId, unemploymentScopeFacts } from "./unemployment";
import { unemploymentBreakdownsForSection, type UnemploymentSectionId } from "./unemploymentSections";
import { unemploymentOverviewDefinitions, unemploymentOverviewIndicators, unemploymentUsesIndicatorSeries } from "./unemploymentOverview";

export type UnemploymentState = { indicator: UnemploymentIndicator; breakdown: UnemploymentBreakdown; educationSex: UnemploymentSex; mode: "line" | "table"; range: PeriodRange; selectedIds: string[]; overview?: true; regional?: true; regionId?: string };
export const DEFAULT_UNEMPLOYMENT_STATE: UnemploymentState = { indicator: "unemployment_rate", breakdown: "national", educationSex: "total", mode: "line", range: { kind: "all" }, selectedIds: ["georgia"] };
export const UNEMPLOYMENT_BREAKDOWNS: UnemploymentBreakdown[] = ["national", "sex", "settlement", "age", "region", "education", "long_term"];

function fit(state: UnemploymentState, facts: readonly ClientUnemploymentObservation[]): UnemploymentState {
  return { ...state, range: refitRange(state.range, unemploymentCoverage(facts, state), { collapseToAll: false }) };
}
function defaultSelection(state: UnemploymentState, facts: readonly ClientUnemploymentObservation[]): string[] {
  return [state.breakdown === "age" ? unemploymentScopeFacts(facts, state)[0].groupId : unemploymentReferenceId(state)];
}
export function changeUnemploymentBreakdown(state: UnemploymentState, breakdown: UnemploymentBreakdown, facts: readonly ClientUnemploymentObservation[]): UnemploymentState {
  const indicators = state.overview ? unemploymentOverviewIndicators(breakdown) : unemploymentIndicators(breakdown);
  const next = { ...state, breakdown, indicator: state.overview ? indicators[0] : indicators.includes(state.indicator) ? state.indicator : indicators[0] };
  return fit({ ...next, selectedIds: defaultSelection(next, facts) }, facts);
}
export function changeUnemploymentOverviewSelection(state: UnemploymentState, selectedIds: string[], facts: readonly ClientUnemploymentObservation[], registry: readonly UnemploymentGroupDefinition[]): UnemploymentState {
  const definitions = unemploymentOverviewDefinitions(facts, registry, state);
  const valid = [...new Set(selectedIds)].filter(id => definitions.some(definition => definition.id === id));
  const added = valid.filter(id => !state.selectedIds.includes(id));
  const indicator = definitions.find(definition => definition.id === added.at(-1))?.indicatorId ?? state.indicator;
  return fit({ ...state, indicator, selectedIds: valid.filter(id => unemploymentIsRate(definitions.find(definition => definition.id === id)!.indicatorId) === unemploymentIsRate(indicator)) }, facts);
}
export function changeUnemploymentIndicator(state: UnemploymentState, indicator: UnemploymentIndicator, facts: readonly ClientUnemploymentObservation[]): UnemploymentState {
  return fit({ ...state, indicator: unemploymentIndicators(state.breakdown).includes(indicator) ? indicator : unemploymentIndicators(state.breakdown)[0] }, facts);
}
export function changeUnemploymentEducationSex(state: UnemploymentState, educationSex: UnemploymentSex, facts: readonly ClientUnemploymentObservation[]): UnemploymentState {
  const next = { ...state, educationSex };
  return fit({ ...next, selectedIds: [unemploymentReferenceId(next)] }, facts);
}
export function parseUnemploymentHash(hash: string, facts: readonly ClientUnemploymentObservation[], registry: readonly UnemploymentGroupDefinition[], section?: UnemploymentSectionId, regionId?: string): UnemploymentState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const allowedBreakdowns = section ? unemploymentBreakdownsForSection(section) : UNEMPLOYMENT_BREAKDOWNS;
  const breakdown = allowedBreakdowns.find(id => id === p.get("breakdown")) ?? allowedBreakdowns[0];
  const indicators = section === "regions" ? unemploymentOverviewIndicators(breakdown).filter(indicator => facts.some(f => f.dimension === "region" && (!regionId || f.groupId === regionId) && f.indicatorId === indicator)) : section === "overview" ? unemploymentOverviewIndicators(breakdown) : unemploymentIndicators(breakdown);
  const indicator = indicators.find(id => id === p.get("indicator")) ?? indicators[0];
  const sex = p.get("sex");
  const state: UnemploymentState = { indicator, breakdown, educationSex: sex === "women" || sex === "men" ? sex : "total", mode: p.get("view") === "table" ? "table" : "line", range: parseYearRangeKeys(p), selectedIds: [], ...(section === "overview" ? { overview: true as const } : {}), ...(section === "regions" ? { regional: true as const, ...(regionId ? { regionId } : {}) } : {}) };
  if (unemploymentUsesIndicatorSeries(state)) {
    const requested = p.has("sel") ? p.get("sel")!.split(",").map(id => id.includes(":") ? id : `${id}:${indicator}`) : [`${regionId ?? "georgia"}:${indicator}`];
    const next = changeUnemploymentOverviewSelection(state, requested, facts, registry);
    if (breakdown === "sex" && !next.selectedIds.length && requested.includes(`georgia:${indicator}`)) return changeUnemploymentOverviewSelection(state, [unemploymentReferenceId(state)], facts, registry);
    return next;
  }
  const validIds = new Set(unemploymentScopeFacts(facts, state).map(f => f.groupId).filter(id => registry.some(group => group.id === id)));
  state.selectedIds = p.has("sel") ? [...new Set(p.get("sel")!.split(","))].filter(id => validIds.has(id)) : defaultSelection(state, facts);
  if (breakdown === "age" && p.get("sel") && !state.selectedIds.length) state.selectedIds = defaultSelection(state, facts);
  return fit(state, facts);
}
export function serializeUnemploymentHash(state: UnemploymentState): string {
  const p = new URLSearchParams({ indicator: state.indicator, breakdown: state.breakdown, sex: state.educationSex, view: state.mode, sel: state.selectedIds.join(",") });
  writeYearRangeKeys(p, state.range); return p.toString();
}
