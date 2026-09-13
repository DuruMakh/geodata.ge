import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import type { ServedRegionalEconomyObservation } from "../data/regionalEconomies/types";
import { REGIONAL_GDP_TOTAL } from "../data/regionalEconomies/types";
import { MUNICIPALITY_MAP_ARTIFACT } from "./municipalityMapData";
export { regionalEconomyHref } from "./regionalEconomyRoutes";

export type RegionalEconomyMapRegion = {
  regionId: string;
  nameKa: string;
  slug: string;
  totalGdpGel: number;
  rank: number;
  bucket: number;
};

export type RegionalEconomyMapModel = {
  viewBox: string;
  firstYear: number;
  year: number;
  regions: RegionalEconomyMapRegion[];
  shapes: Array<{ code: string; regionId: string; totalGdpGel: number; bucket: number }>;
  markers: Array<{ code: string; regionId: string; x: number; y: number; totalGdpGel: number; bucket: number }>;
  occupiedAreas: Array<{ key: "abkhazia" | "tskhinvali" }>;
  legendMinGel: number;
  legendMaxGel: number;
};

function quantileBucket(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const breaks = [1, 2, 3, 4, 5].map((index) => sorted[Math.floor((index / 6) * sorted.length)]!);
  return (value: number) => {
    let bucket = 0;
    while (bucket < breaks.length && value >= breaks[bucket]!) bucket += 1;
    return bucket;
  };
}

export function buildRegionalEconomyMapModel({
  facts,
  regions,
  municipalities,
}: {
  facts: readonly ServedRegionalEconomyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: readonly Municipality[];
}): RegionalEconomyMapModel {
  const totalFacts = facts.filter((fact) => fact.seriesId === REGIONAL_GDP_TOTAL && fact.measure === "nominal");
  if (totalFacts.length === 0) throw new Error("Regional GDP totals are missing");
  const firstYear = Math.min(...totalFacts.map((fact) => fact.year));
  const year = Math.max(...totalFacts.map((fact) => fact.year));
  const latest = totalFacts.filter((fact) => fact.year === year);
  const latestByRegion = new Map<string, number>();
  for (const fact of latest) {
    if (latestByRegion.has(fact.regionId)) throw new Error(`Duplicate latest Regional GDP for ${fact.regionId}`);
    if (!Number.isFinite(fact.value) || fact.value <= 0) throw new Error(`Invalid latest Regional GDP for ${fact.regionId}`);
    latestByRegion.set(fact.regionId, fact.value);
  }

  const municipalityByCode = new Map<string, Municipality>();
  for (const municipality of municipalities) {
    if (municipalityByCode.has(municipality.code)) throw new Error(`Duplicate municipality code ${municipality.code}`);
    municipalityByCode.set(municipality.code, municipality);
  }
  const geometryCodes = new Set([
    ...MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map((shape) => shape.code),
    ...MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => marker.code),
  ]);
  for (const municipality of municipalities) {
    if (!geometryCodes.has(municipality.code)) throw new Error(`Municipality ${municipality.code} has no map geometry`);
  }
  for (const code of geometryCodes) {
    if (!municipalityByCode.has(code)) throw new Error(`Map geometry code ${code} has no municipality`);
  }

  const regionRows = regions.map((region) => {
    const totalGdpGel = latestByRegion.get(region.id);
    if (totalGdpGel === undefined) throw new Error(`Missing latest Regional GDP for ${region.id}`);
    return {
      regionId: region.id,
      nameKa: region.kaLabel,
      slug: region.id.slice("region.".length),
      totalGdpGel,
      sortOrder: region.sortOrder,
    };
  });
  if (latestByRegion.size !== regions.length) throw new Error("Regional GDP contains an unknown latest-year region");
  const bucketOf = quantileBucket(regionRows.map((region) => region.totalGdpGel));
  const ranked = [...regionRows]
    .sort((left, right) => right.totalGdpGel - left.totalGdpGel || left.sortOrder - right.sortOrder)
    .map((region, index): RegionalEconomyMapRegion => ({
      regionId: region.regionId,
      nameKa: region.nameKa,
      slug: region.slug,
      totalGdpGel: region.totalGdpGel,
      rank: index + 1,
      bucket: bucketOf(region.totalGdpGel),
    }));
  const regionById = new Map(ranked.map((region) => [region.regionId, region]));
  const piece = (code: string) => {
    const municipality = municipalityByCode.get(code);
    if (!municipality) throw new Error(`Map geometry code ${code} has no municipality`);
    const region = regionById.get(municipality.regionId);
    if (!region) throw new Error(`Municipality ${code} references unknown region ${municipality.regionId}`);
    return { code, regionId: region.regionId, totalGdpGel: region.totalGdpGel, bucket: region.bucket };
  };

  return {
    viewBox: MUNICIPALITY_MAP_ARTIFACT.viewBox,
    firstYear,
    year,
    regions: ranked,
    shapes: MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map((shape) => piece(shape.code)),
    markers: MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => ({
      ...piece(marker.code),
      x: marker.x,
      y: marker.y,
    })),
    occupiedAreas: MUNICIPALITY_MAP_ARTIFACT.occupiedAreas.map((area) => ({ key: area.key })),
    legendMinGel: Math.min(...regionRows.map((region) => region.totalGdpGel)),
    legendMaxGel: Math.max(...regionRows.map((region) => region.totalGdpGel)),
  };
}
