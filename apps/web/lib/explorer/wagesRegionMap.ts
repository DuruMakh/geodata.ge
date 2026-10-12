import type { ClientWagesFact } from "../data/wages/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { regionalMapGeometry, quantileBucket, type RegionMapModel } from "./regionalEconomyMap";

const AVERAGE = "average_monthly_nominal_earnings";

export function buildWagesRegionMapModel(facts: readonly ClientWagesFact[]): RegionMapModel {
  const regional = facts.filter(f => f.dimension === "region" && f.indicatorId === AVERAGE && f.value !== null);
  const year = Math.max(...regional.map(f => f.year));
  const latest = new Map(regional.filter(f => f.year === year).map(f => [f.groupId, f.value!]));
  const geometry = regionalMapGeometry();
  const regions = REGIONAL_ECONOMY_REGIONS.map(region => {
    const value = latest.get(region.id), pathD = geometry.pathByRegion.get(region.id);
    if (value === undefined || !pathD) throw new Error(`Missing latest regional wage or geometry for ${region.id}`);
    return { regionId: region.id, nameKa: region.kaLabel, value, pathD, sortOrder: region.sortOrder };
  });
  if (latest.size !== regions.length) throw new Error("Regional wages contain an unknown latest-year region");
  const bucketOf = quantileBucket(regions.map(region => region.value));
  return {
    viewBox: geometry.viewBox, occupiedAreas: geometry.occupiedAreas, firstYear: Math.min(...regional.map(f => f.year)), year,
    regions: regions.sort((a, b) => b.value - a.value || a.sortOrder - b.sortOrder).map((region, index) => ({ regionId: region.regionId, nameKa: region.nameKa, value: region.value, pathD: region.pathD, rank: index + 1, bucket: bucketOf(region.value) })),
    legendMin: Math.min(...regions.map(region => region.value)), legendMax: Math.max(...regions.map(region => region.value)),
  };
}
