import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { SCIENCE_CULTURE_REGIONS, scienceCultureIndicator, type ClientScienceCultureFact } from "../data/scienceCulture/types";
import { buildLatestValueRegionMapModel, latestCompleteRegionYear, type RegionMapModel } from "./regionalEconomyMap";
import { museumMapId } from "./scienceCultureMuseums";

/**
 * The map of the Museums index: each region's visitors in the latest year all eleven regions have, as published (thousand),
 * ranked from the highest. Regions are keyed by the map's `region.<id>` ids.
 */
export function buildMuseumRegionMapModel(facts: readonly ClientScienceCultureFact[]): RegionMapModel {
  const regionOf = new Map<string, string>(SCIENCE_CULTURE_REGIONS.map(region => [scienceCultureIndicator("museum_visitors", region), museumMapId(region)]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, ...latestCompleteRegionYear(facts, regionOf, "No year has museum visitors for every region"), measure: "museum visitors" });
}
