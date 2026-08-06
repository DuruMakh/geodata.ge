import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const MARKER_ONLY_CODES = ["06", "20", "32", "48"] as const;
export const POLYGON_AND_MARKER_CODES = ["04"] as const;
export const EXCLUDED_MAP_CODES = ["05", "42", "43", "46", "64"] as const;

export const MUNICIPALITY_GEOMETRY_DIRECTORY =
  "../../docs/Raw Data/Municipalities/municipality-map-geometry";
export const MUNICIPALITY_SOURCE_PATH = `${MUNICIPALITY_GEOMETRY_DIRECTORY}/municipalities-osm.geojson`;
export const OCCUPIED_SOURCE_PATH = `${MUNICIPALITY_GEOMETRY_DIRECTORY}/occupied-areas-natural-earth.geojson`;
export const CITY_MARKER_SOURCE_PATH = `${MUNICIPALITY_GEOMETRY_DIRECTORY}/city-markers.json`;

export type Position = [number, number];
export type PolygonGeometry = { type: "Polygon"; coordinates: Position[][] };
export type MultiPolygonGeometry = { type: "MultiPolygon"; coordinates: Position[][][] };
export type SupportedGeometry = PolygonGeometry | MultiPolygonGeometry;
export type MunicipalitySourceFeature = {
  type: "Feature";
  properties: {
    sourceName: string;
    sourceId: string;
    code: string;
    nameKa: string;
    nameEn: string;
    source: "OpenStreetMap";
  };
  geometry: SupportedGeometry;
};
export type OccupiedSourceFeature = {
  type: "Feature";
  properties: { key: "abkhazia" | "tskhinvali"; nameEn: string; nameKa: string };
  geometry: SupportedGeometry;
};
export type CityMarkerSource = {
  code: string;
  nameKa: string;
  nameEn: string;
  lon: number;
  lat: number;
};
export type MunicipalityGeometrySources = {
  municipalities: { type: "FeatureCollection"; features: MunicipalitySourceFeature[] };
  occupiedAreas: { type: "FeatureCollection"; features: OccupiedSourceFeature[] };
  cityMarkers: CityMarkerSource[];
  sourceTexts: { municipalities: string; occupiedAreas: string; cityMarkers: string };
};

export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex").toUpperCase();
}

export async function loadMunicipalityGeometrySources(): Promise<MunicipalityGeometrySources> {
  const [municipalities, occupiedAreas, cityMarkers] = await Promise.all([
    readFile(path.resolve(process.cwd(), MUNICIPALITY_SOURCE_PATH), "utf8"),
    readFile(path.resolve(process.cwd(), OCCUPIED_SOURCE_PATH), "utf8"),
    readFile(path.resolve(process.cwd(), CITY_MARKER_SOURCE_PATH), "utf8"),
  ]);

  return {
    municipalities: JSON.parse(municipalities) as MunicipalityGeometrySources["municipalities"],
    occupiedAreas: JSON.parse(occupiedAreas) as MunicipalityGeometrySources["occupiedAreas"],
    cityMarkers: JSON.parse(cityMarkers) as CityMarkerSource[],
    sourceTexts: { municipalities, occupiedAreas, cityMarkers },
  };
}

function sameStrings(actual: Iterable<string>, expected: readonly string[]): boolean {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function validatePosition(position: unknown, context: string, coordinatePosition: string): void {
  if (
    !Array.isArray(position) ||
    position.length !== 2 ||
    !position.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    throw new Error(`${context} coordinate ${coordinatePosition} must be a finite [lon, lat] position`);
  }
}

function validateGeometry(geometry: unknown, context: string): void {
  if (!geometry || typeof geometry !== "object") {
    throw new Error(`${context} coordinate 0 must have Polygon or MultiPolygon geometry`);
  }

  const candidate = geometry as { type?: unknown; coordinates?: unknown };
  if (candidate.type !== "Polygon" && candidate.type !== "MultiPolygon") {
    throw new Error(`${context} coordinate 0 has unsupported geometry type ${String(candidate.type)}`);
  }

  const polygons = candidate.type === "Polygon" ? [candidate.coordinates] : candidate.coordinates;
  if (!Array.isArray(polygons) || polygons.length === 0) {
    throw new Error(`${context} coordinate 0 must contain at least one polygon`);
  }

  for (const [polygonIndex, polygon] of polygons.entries()) {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      throw new Error(`${context} coordinate ${polygonIndex} must contain at least one non-empty ring`);
    }

    for (const [ringIndex, ring] of polygon.entries()) {
      const coordinatePosition = `${polygonIndex}.${ringIndex}`;
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new Error(`${context} coordinate ${coordinatePosition} must be a closed non-empty ring`);
      }

      for (const [positionIndex, position] of ring.entries()) {
        validatePosition(position, context, `${coordinatePosition}.${positionIndex}`);
      }

      const first = ring[0] as unknown[];
      const last = ring[ring.length - 1] as unknown[];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error(`${context} coordinate ${coordinatePosition} must be closed`);
      }
    }
  }
}

export function validateMunicipalityGeometrySources(
  sources: MunicipalityGeometrySources,
  servedCodes: readonly string[],
): void {
  const { municipalities, occupiedAreas, cityMarkers } = sources;

  if (municipalities.features.length !== 60) {
    throw new Error(`Municipality polygon count must be 60, received ${municipalities.features.length}`);
  }
  if (cityMarkers.length !== 5) {
    throw new Error(`City marker count must be 5, received ${cityMarkers.length}`);
  }
  if (occupiedAreas.features.length !== 2) {
    throw new Error(`Occupied overlay count must be 2, received ${occupiedAreas.features.length}`);
  }

  const polygonCodes = new Set<string>();
  const relationIds = new Set<string>();
  for (const feature of municipalities.features) {
    const { code, sourceId } = feature.properties;
    if (polygonCodes.has(code)) {
      throw new Error(`Duplicate municipality polygon code ${code}`);
    }
    if (relationIds.has(sourceId)) {
      throw new Error(`Duplicate municipality relation ${sourceId} for code ${code}`);
    }
    if (EXCLUDED_MAP_CODES.includes(code as (typeof EXCLUDED_MAP_CODES)[number])) {
      throw new Error(`Excluded municipality code ${code} appears in polygon source`);
    }

    polygonCodes.add(code);
    relationIds.add(sourceId);
    validateGeometry(feature.geometry, `Municipality code ${code} relation ${sourceId}`);
  }

  const markerCodes = new Set<string>();
  for (const marker of cityMarkers) {
    if (markerCodes.has(marker.code)) {
      throw new Error(`Duplicate city marker code ${marker.code}`);
    }
    if (EXCLUDED_MAP_CODES.includes(marker.code as (typeof EXCLUDED_MAP_CODES)[number])) {
      throw new Error(`Excluded municipality code ${marker.code} appears in city markers`);
    }
    if (!Number.isFinite(marker.lon) || !Number.isFinite(marker.lat)) {
      throw new Error(`City marker code ${marker.code} must have finite [lon, lat] values`);
    }
    markerCodes.add(marker.code);
  }

  const expectedMarkerCodes = [...POLYGON_AND_MARKER_CODES, ...MARKER_ONLY_CODES];
  if (!sameStrings(markerCodes, expectedMarkerCodes)) {
    throw new Error(`City marker code set must be ${expectedMarkerCodes.sort().join(", ")}; received ${[...markerCodes].sort().join(", ")}`);
  }

  const markerPolygonIntersection = [...markerCodes].filter((code) => polygonCodes.has(code));
  if (!sameStrings(markerPolygonIntersection, POLYGON_AND_MARKER_CODES)) {
    throw new Error(`Polygon and marker intersection must be 04; received ${markerPolygonIntersection.sort().join(", ")}`);
  }

  const servedUnion = new Set([...polygonCodes, ...markerCodes]);
  if (!sameStrings(servedUnion, servedCodes)) {
    throw new Error(`Served municipality code union must match registry; received ${[...servedUnion].sort().join(", ")}`);
  }

  const occupiedKeys = new Set<string>();
  for (const feature of occupiedAreas.features) {
    const { key } = feature.properties;
    if (occupiedKeys.has(key)) {
      throw new Error(`Duplicate occupied overlay key ${key}`);
    }
    occupiedKeys.add(key);
    validateGeometry(feature.geometry, `Occupied overlay key ${key}`);
  }

  if (!sameStrings(occupiedKeys, ["abkhazia", "tskhinvali"])) {
    throw new Error(`Occupied overlay keys must be abkhazia, tskhinvali; received ${[...occupiedKeys].sort().join(", ")}`);
  }
}
