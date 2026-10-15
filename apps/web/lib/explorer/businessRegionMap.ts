import { BUSINESS_REGIONS, businessIndicator, type ClientBusinessFact } from "../data/business/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import type { BusinessMapMeasure } from "./businessAreas";
import { buildLatestValueRegionMapModel, type RegionMapModel } from "./regionalEconomyMap";

/**
 * The map of the Regions index: each region's sales or jobs in the latest year all eleven regions have, as published,
 * ranked from the highest. Regions are keyed by the map's `region.<id>` ids. Abkhazeti AR and the unknown region are not drawn.
 */
export function buildBusinessRegionMapModel(measure: BusinessMapMeasure, facts: readonly ClientBusinessFact[]): RegionMapModel {
  const regionOf = new Map<string, string>(BUSINESS_REGIONS.map(region => [businessIndicator(measure, region), region.replace(/^region_/, "region.")]));
  const regional = facts.filter(f => regionOf.has(f.indicatorId));
  const complete = [...new Set(regional.map(f => f.year))].filter(year => regional.filter(f => f.year === year).length === regionOf.size);
  if (!complete.length) throw new Error(`No year has business ${measure} for every region`);
  const year = Math.max(...complete);
  const latest = new Map(regional.filter(f => f.year === year).map(f => [regionOf.get(f.indicatorId)!, f.value]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year, firstYear: Math.min(...regional.map(f => f.year)), measure: `business ${measure}` });
}
