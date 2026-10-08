import { readFileSync } from "node:fs";
import path from "node:path";
import { OCCUPIED_SOURCE_PATH } from "../data/municipalGeometry/source";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_GDP_TOTAL } from "../data/regionalEconomies/types";
import { GEORGIA_GEO } from "../landing/georgiaGeo";
import type { ClientRegionalEconomyObservation } from "../servedRows";
export { regionalEconomyHref } from "./regionalEconomyRoutes";

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 540;
const MAP_PADDING = 14;

const GEO_ISO_TO_REGION_ID = {
  "GE-AJ": "region.adjara",
  "GE-GU": "region.guria",
  "GE-IM": "region.imereti",
  "GE-KA": "region.kakheti",
  "GE-KK": "region.kvemo_kartli",
  "GE-MM": "region.mtskheta_mtianeti",
  "GE-RL": "region.racha_lechkhumi_kvemo_svaneti",
  "GE-SZ": "region.samegrelo_zemo_svaneti",
  "GE-SJ": "region.samtskhe_javakheti",
  "GE-SK": "region.shida_kartli",
  "GE-TB": "region.tbilisi",
} as const;

type Position = [number, number];
type OccupiedFeature = {
  properties: { key: "abkhazia" | "tskhinvali" };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: Position[][] | Position[][][];
  };
};

const occupiedFeatures = (JSON.parse(
  readFileSync(path.resolve(/* turbopackIgnore: true */ process.cwd(), OCCUPIED_SOURCE_PATH), "utf8"),
) as { features: OccupiedFeature[] }).features;

function mercatorY(latitude: number): number {
  const radians = latitude * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function mercatorX(longitude: number): number {
  return longitude * Math.PI / 180;
}

function geometryPositions(feature: OccupiedFeature): Position[] {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][];
  return polygons.flatMap((polygon) => polygon.flatMap((ring) => ring));
}

function createProjection() {
  const positions = [
    ...GEORGIA_GEO.outline,
    ...occupiedFeatures.flatMap(geometryPositions),
  ];
  const xs = positions.map(([longitude]) => mercatorX(longitude));
  const ys = positions.map(([, latitude]) => mercatorY(latitude));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (MAP_WIDTH - MAP_PADDING * 2) / (maxX - minX),
    (MAP_HEIGHT - MAP_PADDING * 2) / (maxY - minY),
  );
  const offsetX = (MAP_WIDTH - (maxX - minX) * scale) / 2;
  const offsetY = (MAP_HEIGHT - (maxY - minY) * scale) / 2;
  return ([longitude, latitude]: Position): Position => [
    offsetX + (mercatorX(longitude) - minX) * scale,
    offsetY + (maxY - mercatorY(latitude)) * scale,
  ];
}

function ringPath(ring: Position[], project: (position: Position) => Position): string {
  return ring.map((position, index) => {
    const [x, y] = project(position);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ") + " Z";
}

function occupiedPath(feature: OccupiedFeature, project: (position: Position) => Position): string {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as Position[][]]
    : feature.geometry.coordinates as Position[][][];
  return polygons.flatMap((polygon) => polygon.map((ring) => ringPath(ring, project))).join(" ");
}

export type RegionalEconomyMapRegion = {
  regionId: string;
  nameKa: string;
  slug: string;
  totalGdpGel: number;
  rank: number;
  bucket: number;
  pathD: string;
};

export type RegionalEconomyMapModel = {
  viewBox: string;
  firstYear: number;
  year: number;
  regions: RegionalEconomyMapRegion[];
  occupiedAreas: Array<{ key: "abkhazia" | "tskhinvali"; pathD: string }>;
  legendMinGel: number;
  legendMaxGel: number;
};

export function quantileBucket(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const breaks = [1, 2, 3, 4, 5].map((index) => sorted[Math.floor((index / 6) * sorted.length)]!);
  return (value: number) => {
    let bucket = 0;
    while (bucket < breaks.length && value >= breaks[bucket]!) bucket += 1;
    return bucket;
  };
}

export type RegionMapModel = {
  viewBox: string;
  firstYear: number;
  year: number;
  regions: Array<{ regionId: string; nameKa: string; value: number; rank: number; bucket: number; pathD: string }>;
  occupiedAreas: RegionalEconomyMapModel["occupiedAreas"];
  legendMin: number;
  legendMax: number;
};

export function regionalMapGeometry() {
  const project = createProjection();
  const pathByRegion = new Map<string, string>();
  for (const geoRegion of GEORGIA_GEO.regions) {
    const regionId = GEO_ISO_TO_REGION_ID[geoRegion.iso as keyof typeof GEO_ISO_TO_REGION_ID];
    if (regionId) pathByRegion.set(regionId, ringPath(geoRegion.ring, project));
  }
  return {
    viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
    pathByRegion,
    occupiedAreas: occupiedFeatures.map(feature => ({ key: feature.properties.key, pathD: occupiedPath(feature, project) })),
  };
}

export function buildRegionalEconomyMapModel({
  facts,
  regions,
}: {
  facts: readonly ClientRegionalEconomyObservation[];
  regions: readonly MunicipalRegion[];
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

  const { viewBox, pathByRegion, occupiedAreas } = regionalMapGeometry();

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
    .map((region, index): RegionalEconomyMapRegion => {
      const pathD = pathByRegion.get(region.regionId);
      if (!pathD) throw new Error(`Missing regional map geometry for ${region.regionId}`);
      return {
        regionId: region.regionId,
        nameKa: region.nameKa,
        slug: region.slug,
        totalGdpGel: region.totalGdpGel,
        rank: index + 1,
        bucket: bucketOf(region.totalGdpGel),
        pathD,
      };
    });
  if (pathByRegion.size !== regions.length) throw new Error("Regional map geometry contains an unknown region");

  return {
    viewBox,
    firstYear,
    year,
    regions: ranked,
    occupiedAreas,
    legendMinGel: Math.min(...regionRows.map((region) => region.totalGdpGel)),
    legendMaxGel: Math.max(...regionRows.map((region) => region.totalGdpGel)),
  };
}
