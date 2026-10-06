import type { ClientUnemploymentObservation } from "../data/unemployment/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { regionalMapGeometry, quantileBucket, type RegionMapModel } from "./regionalEconomyMap";
export const UNEMPLOYMENT_REGIONS = REGIONAL_ECONOMY_REGIONS;

export function buildUnemploymentRegionMapModel(facts: readonly ClientUnemploymentObservation[]): RegionMapModel {
  const rates = facts.filter(fact => fact.dimension === "region" && fact.indicatorId === "unemployment_rate");
  if (!rates.length) throw new Error("Regional unemployment rates are missing");
  const year = Math.max(...rates.map(fact => fact.year));
  const latest = new Map<string, number>();
  for (const fact of rates.filter(fact => fact.year === year)) {
    if (latest.has(fact.groupId)) throw new Error(`Duplicate regional unemployment rate for ${fact.groupId}`);
    if (!Number.isFinite(fact.value) || fact.value < 0 || fact.value > 100) throw new Error(`Invalid regional unemployment rate for ${fact.groupId}`);
    latest.set(fact.groupId, fact.value);
  }
  const geometry = regionalMapGeometry();
  const regions = UNEMPLOYMENT_REGIONS.map(region => {
    const value = latest.get(region.id);
    if (value === undefined) throw new Error(`Missing latest regional unemployment rate for ${region.id}`);
    const pathD = geometry.pathByRegion.get(region.id);
    if (!pathD) throw new Error(`Missing regional geometry for ${region.id}`);
    return { regionId: region.id, nameKa: region.kaLabel, value, pathD, sortOrder: region.sortOrder };
  });
  if (latest.size !== regions.length) throw new Error("Regional unemployment contains an unknown latest-year region");
  const bucketOf = quantileBucket(regions.map(region => region.value));
  return {
    viewBox: geometry.viewBox, occupiedAreas: geometry.occupiedAreas,
    firstYear: Math.min(...rates.map(fact => fact.year)), year,
    regions: regions.sort((a, b) => b.value - a.value || a.sortOrder - b.sortOrder).map((region, index) => ({ regionId: region.regionId, nameKa: region.nameKa, value: region.value, pathD: region.pathD, rank: index + 1, bucket: bucketOf(region.value) })),
    legendMin: Math.min(...regions.map(region => region.value)), legendMax: Math.max(...regions.map(region => region.value)),
  };
}
