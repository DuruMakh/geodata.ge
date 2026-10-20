import { TRANSPORT_REGIONS, transportIndicator, type ClientTransportFact } from "../data/transport/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { transportMapId } from "./transportAreas";
import { buildLatestValueRegionMapModel, latestCompleteRegionYear, type RegionMapModel } from "./regionalEconomyMap";

/**
 * The map of the Regions index: each region's registered motor vehicles in the latest year all eleven regions have, as
 * published, ranked from the highest. Regions are keyed by the map's `region.<id>` ids.
 */
export function buildTransportRegionMapModel(facts: readonly ClientTransportFact[]): RegionMapModel {
  const regionOf = new Map<string, string>(TRANSPORT_REGIONS.map(region => [transportIndicator("registered", region), transportMapId(region)]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, ...latestCompleteRegionYear(facts, regionOf, "No year has registered vehicles for every region"), measure: "registered vehicles" });
}
