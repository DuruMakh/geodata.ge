import type { ClientHouseholdFact, HouseholdMeasure } from "../data/household/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { sectionTotal, type HouseholdSectionId } from "./household";
import { regionalMapGeometry, quantileBucket, type RegionMapModel } from "./regionalEconomyMap";

/** The Regions tab's map: the section total for each region in the latest year all eleven regions have, as published (one decimal). */
export function buildHouseholdRegionMapModel(section: HouseholdSectionId, measure: HouseholdMeasure, facts: readonly ClientHouseholdFact[]): RegionMapModel {
  const ids = new Set<string>(REGIONAL_ECONOMY_REGIONS.map(region => region.id));
  const regional = facts.filter(f => f.indicatorId === sectionTotal(section) && f.measure === measure && ids.has(f.areaId));
  const complete = [...new Set(regional.map(f => f.year))].filter(year => regional.filter(f => f.year === year).length === ids.size);
  if (!complete.length) throw new Error(`No year has household ${section} for every region (${measure})`);
  const year = Math.max(...complete);
  const latest = new Map<string, number>(regional.filter(f => f.year === year).map(f => [f.areaId, f.value]));
  const geometry = regionalMapGeometry();
  const regions = REGIONAL_ECONOMY_REGIONS.map(region => {
    const value = latest.get(region.id), pathD = geometry.pathByRegion.get(region.id);
    if (value === undefined || !pathD) throw new Error(`Missing household ${section} value or geometry for ${region.id}`);
    return { regionId: region.id, nameKa: region.kaLabel, value, pathD, sortOrder: region.sortOrder };
  });
  const bucketOf = quantileBucket(regions.map(region => region.value));
  return {
    viewBox: geometry.viewBox, occupiedAreas: geometry.occupiedAreas, firstYear: Math.min(...regional.map(f => f.year)), year,
    regions: regions.sort((a, b) => b.value - a.value || a.sortOrder - b.sortOrder).map((region, index) => ({ regionId: region.regionId, nameKa: region.nameKa, value: region.value, pathD: region.pathD, rank: index + 1, bucket: bucketOf(region.value) })),
    legendMin: Math.min(...regions.map(region => region.value)), legendMax: Math.max(...regions.map(region => region.value)),
  };
}
