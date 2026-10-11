import type { ClientWagesFact } from "../data/wages/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { buildLatestValueRegionMapModel, type RegionMapModel } from "./regionalEconomyMap";

const AVERAGE = "average_monthly_nominal_earnings";

export function buildWagesRegionMapModel(facts: readonly ClientWagesFact[]): RegionMapModel {
  const regional = facts.filter(f => f.dimension === "region" && f.indicatorId === AVERAGE && f.value !== null);
  const year = Math.max(...regional.map(f => f.year));
  const latest = new Map(regional.filter(f => f.year === year).map(f => [f.groupId, f.value!]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year, firstYear: Math.min(...regional.map(f => f.year)), measure: "wage" });
}
