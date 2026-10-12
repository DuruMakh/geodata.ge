import { CENSUS_YEAR } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { MunicipalRegion } from "../data/municipal/types";
import { bandShares, censusAgeFactsForPlace, censusPyramid } from "./demographyAgeSex";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { quantileBucket, regionalMapGeometry, type RegionMapModel } from "./regionalEconomyMap";

/** A place's census share aged 65+ (men and women, all settlements), in percent; throws when the place has no census age rows. */
function censusOldShare(served: readonly ServedDemographyObservation[], placeId: string): number {
  const facts = censusAgeFactsForPlace(served, placeId);
  if (facts.length === 0) throw new Error(`Missing census age rows for ${placeId}`);
  return bandShares(censusPyramid(facts, "total")).old;
}

export function georgiaOldShare(served: readonly ServedDemographyObservation[]): number {
  return censusOldShare(served, GEORGIA_PLACE_ID);
}

/** The 11 regions ranked by the census share aged 65+, oldest first, shaped for `RegionIndex` as the Unemployment regions are. */
export function buildAgeSexRegionModel(served: readonly ServedDemographyObservation[], regions: readonly MunicipalRegion[]): RegionMapModel {
  const geometry = regionalMapGeometry();
  const shares = regions.map((region) => {
    const pathD = geometry.pathByRegion.get(region.id);
    if (!pathD) throw new Error(`Missing regional geometry for ${region.id}`);
    return { regionId: region.id, nameKa: region.kaLabel, value: censusOldShare(served, region.id), pathD, sortOrder: region.sortOrder };
  });
  const bucketOf = quantileBucket(shares.map((region) => region.value));
  return {
    viewBox: geometry.viewBox,
    occupiedAreas: geometry.occupiedAreas,
    firstYear: CENSUS_YEAR,
    year: CENSUS_YEAR,
    regions: shares
      .sort((a, b) => b.value - a.value || a.sortOrder - b.sortOrder)
      .map((region, index) => ({ regionId: region.regionId, nameKa: region.nameKa, value: region.value, pathD: region.pathD, rank: index + 1, bucket: bucketOf(region.value) })),
    legendMin: Math.min(...shares.map((region) => region.value)),
    legendMax: Math.max(...shares.map((region) => region.value)),
  };
}
