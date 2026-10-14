import type { ClientUnemploymentObservation, UnemploymentGroupDefinition, UnemploymentIndicator } from "../data/unemployment/types";

export const UNEMPLOYMENT_AGE_FIRST_YEAR = 2020;

export function buildUnemploymentAgeHeatmap(facts: readonly ClientUnemploymentObservation[], registry: readonly UnemploymentGroupDefinition[], indicator: UnemploymentIndicator, years: readonly number[]) {
  const observations = facts.filter(fact => fact.dimension === "age" && fact.year >= UNEMPLOYMENT_AGE_FIRST_YEAR && fact.indicatorId === indicator);
  const ids = new Set(observations.map(fact => fact.groupId));
  const byCell = new Map(observations.map(fact => [`${fact.groupId}:${fact.year}`, fact.value]));
  const rows = registry.filter(group => ids.has(group.id)).sort((a, b) => a.sortOrder - b.sortOrder).map(group => ({
    ...group, values: years.map(year => byCell.get(`${group.id}:${year}`) ?? null),
  }));
  return { years: [...years], rows, maximum: Math.max(0, ...rows.flatMap(row => row.values.filter(value => value !== null))) };
}
