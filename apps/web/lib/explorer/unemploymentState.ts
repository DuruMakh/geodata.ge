import type { ClientUnemploymentObservation, UnemploymentBreakdown, UnemploymentGroupDefinition, UnemploymentIndicator, UnemploymentSex } from "../data/unemployment/types";
import { unemploymentIndicators } from "../data/unemployment/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";
import { unemploymentCoverage, unemploymentReferenceId, unemploymentScopeFacts } from "./unemployment";

export type UnemploymentState = { indicator: UnemploymentIndicator; breakdown: UnemploymentBreakdown; educationSex: UnemploymentSex; mode: "line" | "table"; range: PeriodRange; selectedIds: string[] };
export const DEFAULT_UNEMPLOYMENT_STATE: UnemploymentState = { indicator: "unemployment_rate", breakdown: "national", educationSex: "total", mode: "line", range: { kind: "all" }, selectedIds: ["georgia"] };
export const UNEMPLOYMENT_BREAKDOWNS: UnemploymentBreakdown[] = ["national", "sex", "settlement", "age", "region", "education", "long_term"];

function fit(state: UnemploymentState, facts: readonly ClientUnemploymentObservation[]): UnemploymentState {
  return { ...state, range: refitRange(state.range, unemploymentCoverage(facts, state), { collapseToAll: false }) };
}
export function changeUnemploymentBreakdown(state: UnemploymentState, breakdown: UnemploymentBreakdown, facts: readonly ClientUnemploymentObservation[]): UnemploymentState {
  const indicators = unemploymentIndicators(breakdown);
  const next = { ...state, breakdown, indicator: indicators.includes(state.indicator) ? state.indicator : indicators[0] };
  return fit({ ...next, selectedIds: [unemploymentReferenceId(next)] }, facts);
}
export function changeUnemploymentIndicator(state: UnemploymentState, indicator: UnemploymentIndicator, facts: readonly ClientUnemploymentObservation[]): UnemploymentState {
  return fit({ ...state, indicator: unemploymentIndicators(state.breakdown).includes(indicator) ? indicator : unemploymentIndicators(state.breakdown)[0] }, facts);
}
export function changeUnemploymentEducationSex(state: UnemploymentState, educationSex: UnemploymentSex, facts: readonly ClientUnemploymentObservation[]): UnemploymentState {
  const next = { ...state, educationSex };
  return fit({ ...next, selectedIds: [unemploymentReferenceId(next)] }, facts);
}
export function parseUnemploymentHash(hash: string, facts: readonly ClientUnemploymentObservation[], registry: readonly UnemploymentGroupDefinition[]): UnemploymentState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const breakdown = UNEMPLOYMENT_BREAKDOWNS.find(id => id === p.get("breakdown")) ?? "national";
  const indicator = unemploymentIndicators(breakdown).find(id => id === p.get("indicator")) ?? unemploymentIndicators(breakdown)[0];
  const sex = p.get("sex");
  const state: UnemploymentState = { indicator, breakdown, educationSex: sex === "women" || sex === "men" ? sex : "total", mode: p.get("view") === "table" ? "table" : "line", range: parseYearRangeKeys(p), selectedIds: [] };
  const validIds = new Set(unemploymentScopeFacts(facts, state).map(f => f.groupId).filter(id => registry.some(group => group.id === id)));
  state.selectedIds = p.has("sel") ? [...new Set(p.get("sel")!.split(","))].filter(id => validIds.has(id)) : [unemploymentReferenceId(state)];
  return fit(state, facts);
}
export function serializeUnemploymentHash(state: UnemploymentState): string {
  const p = new URLSearchParams({ indicator: state.indicator, breakdown: state.breakdown, sex: state.educationSex, view: state.mode, sel: state.selectedIds.join(",") });
  writeYearRangeKeys(p, state.range); return p.toString();
}
