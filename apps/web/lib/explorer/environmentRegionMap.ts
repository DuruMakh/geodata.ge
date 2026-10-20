import { ENVIRONMENT_REGIONS, type ClientEnvironmentFact } from "../data/environment/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { environmentAreaRoutes, type EnvironmentAreaTopic } from "./environmentAreas";
import { buildLatestValueRegionMapModel, latestCompleteRegionYear, type RegionMapModel } from "./regionalEconomyMap";

const MEASURE: Record<EnvironmentAreaTopic, string> = { waste: "environment.waste.collected", forests: "environment.forest.timber_cut" };

/**
 * A map page's regions: the waste collected or timber cut in the latest year every region with a figure has, as
 * published, ranked from the highest. A region with no figure in any year (Tbilisi's timber) is drawn without a value.
 */
export function buildEnvironmentRegionMapModel(topic: EnvironmentAreaTopic, facts: readonly ClientEnvironmentFact[]): RegionMapModel {
  const { mapId } = environmentAreaRoutes(topic);
  const withFigures = new Set(facts.map(f => f.indicatorId));
  const regions = ENVIRONMENT_REGIONS.filter(region => withFigures.has(`${MEASURE[topic]}.${region}`));
  const regionOf = new Map<string, string>(regions.map(region => [`${MEASURE[topic]}.${region}`, mapId(region)]));
  const withoutValue = ENVIRONMENT_REGIONS.filter(region => !regions.includes(region)).map(mapId);
  return buildLatestValueRegionMapModel({
    regions: REGIONAL_ECONOMY_REGIONS, ...latestCompleteRegionYear(facts, regionOf, `No year has environment ${topic} for every region`),
    measure: `environment ${topic}`, ...(withoutValue.length ? { withoutValue } : {}),
  });
}
