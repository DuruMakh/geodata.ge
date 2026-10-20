import { INTERNET_REGIONS, internetIndicator, type ClientInternetFact } from "../data/internet/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { internetMapId } from "./internetAreas";
import { buildLatestValueRegionMapModel, latestCompleteRegionYear, type RegionMapModel } from "./regionalEconomyMap";

/**
 * The map of the Internet at home index: each region's share of homes with internet in the latest year all eleven
 * regions have, as published, ranked from the highest. Regions are keyed by the map's `region.<id>` ids.
 */
export function buildInternetRegionMapModel(facts: readonly ClientInternetFact[]): RegionMapModel {
  const regionOf = new Map<string, string>(INTERNET_REGIONS.map(region => [internetIndicator("homes_internet", region), internetMapId(region)]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, ...latestCompleteRegionYear(facts, regionOf, "No year has homes with internet for every region"), measure: "homes with internet" });
}
