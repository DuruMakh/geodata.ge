import type { ClientHealthFact } from "../data/health/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { buildLatestValueRegionMapModel, type RegionMapModel } from "./regionalEconomyMap";

// Built on the server: the region list is read from the repository, so client code imports healthDeaths.ts, not this.

const RATE = "health.death_rate.total";

/** The map that picks the page's area: the crude death rate for each region in the latest year all eleven regions have, as published. */
export function buildHealthDeathRateMapModel(facts: readonly ClientHealthFact[]): RegionMapModel {
  const regionIds = new Set<string>(REGIONAL_ECONOMY_REGIONS.map(region => region.id));
  const regional = facts.filter(f => f.indicatorId === RATE && regionIds.has(f.areaId));
  const complete = [...new Set(regional.map(f => f.year))].filter(year => regional.filter(f => f.year === year).length === regionIds.size);
  if (!complete.length) throw new Error("No year has a death rate for every region");
  const year = Math.max(...complete);
  const latest = new Map(regional.filter(f => f.year === year).map(f => [f.areaId, f.value]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year, firstYear: Math.min(...regional.map(f => f.year)), measure: "death rate" });
}
