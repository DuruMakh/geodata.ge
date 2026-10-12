import type { ClientUnemploymentObservation } from "../data/unemployment/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { buildLatestValueRegionMapModel, type RegionMapModel } from "./regionalEconomyMap";
export const UNEMPLOYMENT_REGIONS = REGIONAL_ECONOMY_REGIONS;

export function buildUnemploymentRegionMapModel(facts: readonly ClientUnemploymentObservation[]): RegionMapModel {
  const rates = facts.filter(fact => fact.dimension === "region" && fact.indicatorId === "unemployment_rate");
  if (!rates.length) throw new Error("Regional unemployment rates are missing");
  const year = Math.max(...rates.map(fact => fact.year));
  const latest = new Map<string, number>();
  for (const fact of rates.filter(fact => fact.year === year)) {
    if (latest.has(fact.groupId)) throw new Error(`Duplicate regional unemployment rate for ${fact.groupId}`);
    if (!Number.isFinite(fact.value) || fact.value < 0 || fact.value > 100) throw new Error(`Invalid regional unemployment rate for ${fact.groupId}`);
    latest.set(fact.groupId, fact.value);
  }
  return buildLatestValueRegionMapModel({ regions: UNEMPLOYMENT_REGIONS, latest, year, firstYear: Math.min(...rates.map(fact => fact.year)), measure: "unemployment rate" });
}
