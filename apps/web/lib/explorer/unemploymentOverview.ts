import type { ClientUnemploymentObservation, UnemploymentBreakdown, UnemploymentGroupDefinition, UnemploymentIndicator } from "../data/unemployment/types";
import { LONG_TERM_UNEMPLOYMENT_INDICATORS } from "../data/unemployment/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import type { UnemploymentState } from "./unemploymentState";

export type UnemploymentSeriesDefinition = UnemploymentGroupDefinition & { groupId: string; indicatorId: UnemploymentIndicator; parentId?: string };
export function unemploymentOverviewIndicators(breakdown: UnemploymentBreakdown): UnemploymentIndicator[] {
  if (breakdown === "education") return ["unemployment_rate"];
  if (breakdown === "long_term") return LONG_TERM_UNEMPLOYMENT_INDICATORS;
  return ["unemployment_rate", "unemployed", "employed", "self_employed", "hired", "participation_rate", "labour_force", "outside_labour_force", "population_15_plus"];
}
export function unemploymentUsesIndicatorSeries(state: UnemploymentState): boolean {
  return Boolean(state.regional || state.overview && state.breakdown !== "education");
}
export function unemploymentFactSeriesId(fact: Pick<ClientUnemploymentObservation, "groupId" | "indicatorId">, state: UnemploymentState): string {
  return unemploymentUsesIndicatorSeries(state) ? `${fact.groupId}:${fact.indicatorId}` : fact.groupId;
}
export function unemploymentOverviewDefinitions(facts: readonly ClientUnemploymentObservation[], registry: readonly UnemploymentGroupDefinition[], state: UnemploymentState): UnemploymentSeriesDefinition[] {
  const indicators = unemploymentOverviewIndicators(state.breakdown);
  const groups = state.breakdown === "region" ? state.regionId ? [state.regionId] : ["georgia", ...registry.filter(group => group.id.startsWith("region.")).map(group => group.id)] : state.breakdown === "national" ? ["georgia"] : state.breakdown === "settlement" ? ["georgia", "urban", "rural"] : ["georgia", "men", "women"];
  const definitions: UnemploymentSeriesDefinition[] = [];
  for (const groupId of groups) for (const indicatorId of indicators) {
    if (state.breakdown === "settlement" && groupId === "georgia" && indicatorId !== "unemployment_rate") continue;
    if (!facts.some(f => f.groupId === groupId && f.indicatorId === indicatorId && (f.dimension === state.breakdown || (["settlement", "region"].includes(state.breakdown) && !state.regionId && f.dimension === "national")))) continue;
    const group = registry.find(item => item.id === groupId)!;
    const id = `${groupId}:${indicatorId}`;
    const parentId = state.breakdown === "long_term" ? `metric.${indicatorId}` : ["hired", "self_employed"].includes(indicatorId) ? `${groupId}:employed` : (state.breakdown === "region" && !state.regionId || state.breakdown === "settlement" && groupId !== "georgia") && indicatorId !== "unemployment_rate" ? `${groupId}:unemployment_rate` : undefined;
    definitions.push({ ...group, id, groupId, indicatorId, parentId, sortOrder: state.breakdown === "long_term" ? indicators.indexOf(indicatorId) * groups.length + groups.indexOf(groupId) : groups.indexOf(groupId) * indicators.length + indicators.indexOf(indicatorId) });
  }
  return definitions.sort((a, b) => a.sortOrder - b.sortOrder);
}
export function unemploymentSeriesLabel(definition: UnemploymentSeriesDefinition, state: UnemploymentState, presentation: Pick<Presentation, "locale" | "messages">, selector = false): string {
  const group = presentation.locale === "en" ? definition.labelEn : definition.labelKa;
  if (!unemploymentUsesIndicatorSeries(state)) return group;
  const indicator = message(presentation.messages, `unemployment.indicator.${definition.indicatorId}`);
  if (state.regionId || state.breakdown === "national" || (state.breakdown === "settlement" && definition.groupId === "georgia")) return indicator;
  if (selector) return state.breakdown === "long_term" || !definition.parentId ? group : indicator;
  return `${group} · ${indicator}`;
}
