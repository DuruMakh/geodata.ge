import { HOUSING_REGIONS, housingIndicator, type ClientHousingFact } from "../data/housing/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { housingMapId } from "./housingAreas";
import { buildLatestValueRegionMapModel, type RegionMapModel } from "./regionalEconomyMap";

/**
 * The map of the Regions index: each region's permitted floor area in the latest year all eleven regions have, as
 * published, ranked from the highest. Regions are keyed by the map's `region.<id>` ids.
 */
export function buildHousingRegionMapModel(facts: readonly ClientHousingFact[]): RegionMapModel {
  const regionOf = new Map<string, string>(HOUSING_REGIONS.map(region => [housingIndicator("permits_area", region), housingMapId(region)]));
  const regional = facts.filter(f => regionOf.has(f.indicatorId));
  const complete = [...new Set(regional.map(f => f.year))].filter(year => regional.filter(f => f.year === year).length === regionOf.size);
  if (!complete.length) throw new Error("No year has housing permitted floor area for every region");
  const year = Math.max(...complete);
  const latest = new Map(regional.filter(f => f.year === year).map(f => [regionOf.get(f.indicatorId)!, f.value]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year, firstYear: Math.min(...regional.map(f => f.year)), measure: "housing permitted floor area" });
}
