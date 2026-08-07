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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${context} must be a non-null object`);
  }
  return value;
}

function requireNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value;
}

function parseJson(text: string, context: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} must contain valid JSON: ${detail}`);
  }
}

export async function loadMunicipalityGeometrySources(): Promise<MunicipalityGeometrySources> {
  const [municipalitiesText, occupiedAreasText, cityMarkersText] = await Promise.all([
    readFile(path.resolve(process.cwd(), MUNICIPALITY_SOURCE_PATH), "utf8"),
    readFile(path.resolve(process.cwd(), OCCUPIED_SOURCE_PATH), "utf8"),
    readFile(path.resolve(process.cwd(), CITY_MARKER_SOURCE_PATH), "utf8"),
  ]);

  return parseMunicipalityGeometrySources({
    municipalities: parseJson(municipalitiesText, "Municipality source"),
    occupiedAreas: parseJson(occupiedAreasText, "Occupied overlay source"),
    cityMarkers: parseJson(cityMarkersText, "City marker source"),
    sourceTexts: {
      municipalities: municipalitiesText,
      occupiedAreas: occupiedAreasText,
      cityMarkers: cityMarkersText,
    },
  });
}

function sameStrings(actual: Iterable<string>, expected: readonly string[]): boolean {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function validatePosition(
  position: unknown,
  context: string,
  coordinatePosition: string,
): asserts position is Position {
  if (
    !Array.isArray(position) ||
    position.length !== 2 ||
    !position.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    throw new Error(`${context} coordinate ${coordinatePosition} must be a finite [lon, lat] position`);
  }

  const [longitude, latitude] = position;
  validateLongitudeLatitude(longitude, latitude, `${context} coordinate ${coordinatePosition}`);
}

function validateLongitudeLatitude(longitude: number, latitude: number, context: string): void {
  if (longitude < -180 || longitude > 180) {
    throw new Error(`${context} longitude must be between -180 and 180`);
  }
  if (latitude < -90 || latitude > 90) {
    throw new Error(`${context} latitude must be between -90 and 90`);
  }
}

function validateGeometry(geometry: unknown, context: string): SupportedGeometry {
  const candidate = requireRecord(geometry, `${context} geometry`);
  if (candidate.type !== "Polygon" && candidate.type !== "MultiPolygon") {
    throw new Error(`${context} geometry type must be Polygon or MultiPolygon`);
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

  return geometry as SupportedGeometry;
}

function validateFeatureCollection(
  value: unknown,
  context: string,
): { type: "FeatureCollection"; features: unknown[] } {
  const collection = requireRecord(value, `${context} source`);
  if (collection.type !== "FeatureCollection") {
    throw new Error(`${context} source type must be FeatureCollection`);
  }
  if (!Array.isArray(collection.features)) {
    throw new Error(`${context} source features must be an array`);
  }
  return { type: "FeatureCollection", features: collection.features };
}

function parseMunicipalityFeature(value: unknown, index: number): MunicipalitySourceFeature {
  const context = `Municipality feature ${index}`;
  const feature = requireRecord(value, context);
  if (feature.type !== "Feature") {
    throw new Error(`${context} type must be Feature`);
  }

  const properties = requireRecord(feature.properties, `${context} properties`);
  const code = requireNonEmptyString(properties.code, `${context} code`);
  if (!/^\d{2}$/.test(code)) {
    throw new Error(`${context} code must be a two-digit string`);
  }
  const nameKa = requireNonEmptyString(properties.nameKa, `${context} nameKa`);
  const nameEn = requireNonEmptyString(properties.nameEn, `${context} nameEn`);
  const sourceName = requireNonEmptyString(properties.sourceName, `${context} sourceName`);
  const sourceId = requireNonEmptyString(properties.sourceId, `${context} sourceId`);
  if (!/^osm-relation-[1-9]\d*$/.test(sourceId)) {
    throw new Error(`${context} sourceId must match osm-relation-{number}`);
  }
  if (properties.source !== "OpenStreetMap") {
    throw new Error(`${context} source must be OpenStreetMap`);
  }

  return {
    type: "Feature",
    properties: { sourceName, sourceId, code, nameKa, nameEn, source: "OpenStreetMap" },
    geometry: validateGeometry(feature.geometry, `Municipality code ${code} relation ${sourceId}`),
  };
}

const APPROVED_OCCUPIED_NAMES = {
  abkhazia: { nameEn: "Abkhazia", nameKa: "აფხაზეთი" },
  tskhinvali: { nameEn: "Tskhinvali region", nameKa: "ცხინვალის რეგიონი" },
} as const;

function parseOccupiedFeature(value: unknown, index: number): OccupiedSourceFeature {
  const context = `Occupied overlay feature ${index}`;
  const feature = requireRecord(value, context);
  if (feature.type !== "Feature") {
    throw new Error(`${context} type must be Feature`);
  }

  const properties = requireRecord(feature.properties, `${context} properties`);
  const key = requireNonEmptyString(properties.key, `${context} key`);
  if (key !== "abkhazia" && key !== "tskhinvali") {
    throw new Error(`${context} key must be abkhazia or tskhinvali`);
  }
  const nameEn = requireNonEmptyString(properties.nameEn, `${context} nameEn`);
  const nameKa = requireNonEmptyString(properties.nameKa, `${context} nameKa`);
  const approved = APPROVED_OCCUPIED_NAMES[key];
  if (nameEn !== approved.nameEn || nameKa !== approved.nameKa) {
    throw new Error(`Occupied overlay key ${key} must match the approved names`);
  }

  return {
    type: "Feature",
    properties: { key, nameEn, nameKa },
    geometry: validateGeometry(feature.geometry, `Occupied overlay key ${key}`),
  };
}

const APPROVED_CITY_MARKERS: Record<string, CityMarkerSource> = {
  "04": { code: "04", nameKa: "თბილისი", nameEn: "Tbilisi", lon: 44.783, lat: 41.716 },
  "06": { code: "06", nameKa: "ბათუმი", nameEn: "Batumi", lon: 41.637, lat: 41.617 },
  "20": { code: "20", nameKa: "ქუთაისი", nameEn: "Kutaisi", lon: 42.718, lat: 42.266 },
  "32": { code: "32", nameKa: "ფოთი", nameEn: "Poti", lon: 41.672, lat: 42.146 },
  "48": { code: "48", nameKa: "რუსთავი", nameEn: "Rustavi", lon: 45.011, lat: 41.549 },
};

function parseCityMarker(value: unknown, index: number): CityMarkerSource {
  const context = `City marker ${index}`;
  const marker = requireRecord(value, context);
  const code = requireNonEmptyString(marker.code, `${context} code`);
  const nameKa = requireNonEmptyString(marker.nameKa, `${context} nameKa`);
  const nameEn = requireNonEmptyString(marker.nameEn, `${context} nameEn`);
  if (
    typeof marker.lon !== "number" ||
    !Number.isFinite(marker.lon) ||
    typeof marker.lat !== "number" ||
    !Number.isFinite(marker.lat)
  ) {
    throw new Error(`City marker code ${code} must have finite [lon, lat] values`);
  }
  validateLongitudeLatitude(marker.lon, marker.lat, `City marker code ${code}`);
  const lon = marker.lon as number;
  const lat = marker.lat as number;
  const approved = APPROVED_CITY_MARKERS[code];
  if (
    !approved ||
    nameKa !== approved.nameKa ||
    nameEn !== approved.nameEn ||
    lon !== approved.lon ||
    lat !== approved.lat
  ) {
    throw new Error(`City marker code ${code} must match the approved marker record`);
  }
  return { code, nameKa, nameEn, lon, lat };
}

function parseMunicipalityGeometrySources(sources: unknown): MunicipalityGeometrySources {
  const root = requireRecord(sources, "Municipality geometry sources");
  const municipalityCollection = validateFeatureCollection(root.municipalities, "Municipality");
  const occupiedCollection = validateFeatureCollection(root.occupiedAreas, "Occupied overlay");
  if (!Array.isArray(root.cityMarkers)) {
    throw new Error("City marker source must be an array");
  }
  const sourceTexts = requireRecord(root.sourceTexts, "Municipality geometry sourceTexts");

  return {
    municipalities: {
      type: "FeatureCollection",
      features: municipalityCollection.features.map(parseMunicipalityFeature),
    },
    occupiedAreas: {
      type: "FeatureCollection",
      features: occupiedCollection.features.map(parseOccupiedFeature),
    },
    cityMarkers: root.cityMarkers.map(parseCityMarker),
    sourceTexts: {
      municipalities: requireNonEmptyString(
        sourceTexts.municipalities,
        "Municipality geometry sourceTexts municipalities",
      ),
      occupiedAreas: requireNonEmptyString(
        sourceTexts.occupiedAreas,
        "Municipality geometry sourceTexts occupiedAreas",
      ),
      cityMarkers: requireNonEmptyString(
        sourceTexts.cityMarkers,
        "Municipality geometry sourceTexts cityMarkers",
      ),
    },
  };
}

export function validateMunicipalityGeometrySources(
  sources: unknown,
  servedCodes: readonly string[],
): void {
  const { municipalities, occupiedAreas, cityMarkers } = parseMunicipalityGeometrySources(sources);

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
    if (code === "33" && sourceId !== "osm-relation-2016161") {
      throw new Error(`Zugdidi municipality code 33 must use osm-relation-2016161; received ${sourceId}`);
    }
  }

  const markerCodes = new Set<string>();
  for (const marker of cityMarkers) {
    if (markerCodes.has(marker.code)) {
      throw new Error(`Duplicate city marker code ${marker.code}`);
    }
    if (EXCLUDED_MAP_CODES.includes(marker.code as (typeof EXCLUDED_MAP_CODES)[number])) {
      throw new Error(`Excluded municipality code ${marker.code} appears in city markers`);
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
  }

  if (!sameStrings(occupiedKeys, ["abkhazia", "tskhinvali"])) {
    throw new Error(`Occupied overlay keys must be abkhazia, tskhinvali; received ${[...occupiedKeys].sort().join(", ")}`);
  }
}
