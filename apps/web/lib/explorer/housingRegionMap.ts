import { HOUSING_REGIONS, housingIndicator, type ClientHousingFact } from "../data/housing/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { housingMapId } from "./housingAreas";
import { buildLatestValueRegionMapModel, latestCompleteRegionYear, type RegionMapModel } from "./regionalEconomyMap";

/**
 * The map of the Regions index: each region's permitted floor area in the latest year all eleven regions have, as
 * published, ranked from the highest. Regions are keyed by the map's `region.<id>` ids.
 */
export function buildHousingRegionMapModel(facts: readonly ClientHousingFact[]): RegionMapModel {
  const regionOf = new Map<string, string>(HOUSING_REGIONS.map(region => [housingIndicator("permits_area", region), housingMapId(region)]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, ...latestCompleteRegionYear(facts, regionOf, "No year has housing permitted floor area for every region"), measure: "housing permitted floor area" });
}
