import { readFileSync } from "node:fs";
import path from "node:path";
import type { Municipality } from "../data/municipal/types";
import type { MunicipalListRow } from "./municipalData";

export type MunicipalityMapShape = {
  code: string;
  nameKa: string;
  d: string;
  valueGel: number;
  bucket: number;
};

export type MunicipalityMapMarker = {
  code: string;
  nameKa: string;
  x: number;
  y: number;
  valueGel: number;
};

export type MunicipalityMapOccupiedArea = {
  key: "abkhazia" | "tskhinvali";
  d: string;
};

export type MunicipalityMapModel = {
  viewBox: string;
  shapes: MunicipalityMapShape[];
  markers: MunicipalityMapMarker[];
  occupiedAreas: MunicipalityMapOccupiedArea[];
  legendMinGel: number;
  legendMaxGel: number;
};

type MunicipalityMapArtifact = {
  version: 1;
  viewBox: "0 0 1000 540";
  municipalityPaths: Array<{ code: string; relationId: number; d: string }>;
  cityMarkers: Array<{ code: string; x: number; y: number }>;
  occupiedAreas: MunicipalityMapOccupiedArea[];
};

const rawArtifact = JSON.parse(
  readFileSync(
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/geometry/municipality-map-paths.json"),
    "utf8",
  ),
) as unknown;

const EXPECTED_MARKER_CODES = ["04", "06", "20", "32", "48"];
const EXPECTED_OCCUPIED_AREA_KEYS = ["abkhazia", "tskhinvali"];
const EXPECTED_MUNICIPALITY_CODES = [
  "04", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36",
  "37", "38", "39", "40", "41", "44", "45", "47", "48", "49", "50", "51", "52", "53", "54", "55",
  "56", "57", "58", "59", "60", "61", "62", "63", "65", "66", "67", "68", "69", "70", "71", "72",
];

function hasExactCodes(actual: Iterable<string>, expected: readonly string[]): boolean {
  return JSON.stringify([...actual].sort()) === JSON.stringify(expected.slice().sort());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateMunicipalityMapArtifact(artifact: unknown): MunicipalityMapArtifact {
  if (!isRecord(artifact)) {
    throw new Error("Municipality map artifact must be an object");
  }
  if (!Array.isArray(artifact.municipalityPaths)) {
    throw new Error("Municipality map artifact must contain municipality paths");
  }
  if (!Array.isArray(artifact.cityMarkers)) {
    throw new Error("Municipality map artifact must contain city markers");
  }
  if (!Array.isArray(artifact.occupiedAreas)) {
    throw new Error("Municipality map artifact must contain occupied areas");
  }

  if (artifact.version !== 1) throw new Error("Municipality map artifact version must be 1");
  if (artifact.viewBox !== "0 0 1000 540") throw new Error("Municipality map artifact viewBox must be 0 0 1000 540");
  if (artifact.municipalityPaths.length !== 60) throw new Error("Municipality map artifact must contain 60 paths");
  if (artifact.cityMarkers.length !== 5) throw new Error("Municipality map artifact must contain 5 city markers");
  if (artifact.occupiedAreas.length !== 2) throw new Error("Municipality map artifact must contain 2 occupied areas");

  const polygonCodes = new Set<string>();
  for (const [index, shape] of artifact.municipalityPaths.entries()) {
    if (!isRecord(shape)) throw new Error(`Municipality polygon at index ${index} must be an object`);
    if (typeof shape.code !== "string" || shape.code.length === 0) {
      throw new Error(`Municipality polygon at index ${index} must have a non-empty string code`);
    }
    if (typeof shape.d !== "string" || shape.d.trim().length === 0) {
      throw new Error(`Municipality polygon ${shape.code} must have a non-empty string path`);
    }
    if (typeof shape.relationId !== "number" || !Number.isFinite(shape.relationId)) {
      throw new Error(`Municipality polygon ${shape.code} must have a finite numeric relation id`);
    }
    if (polygonCodes.has(shape.code)) throw new Error(`Invalid municipality polygon code ${shape.code}`);
    if (shape.code === "33" && shape.relationId !== 2016161) {
      throw new Error("Municipality polygon 33 must use relation 2016161");
    }
    polygonCodes.add(shape.code);
  }

  const markerCodes = new Set<string>();
  for (const [index, marker] of artifact.cityMarkers.entries()) {
    if (!isRecord(marker)) throw new Error(`Municipality marker at index ${index} must be an object`);
    if (typeof marker.code !== "string" || marker.code.length === 0) {
      throw new Error(`Municipality marker at index ${index} must have a non-empty string code`);
    }
    if (
      typeof marker.x !== "number" ||
      typeof marker.y !== "number" ||
      !Number.isFinite(marker.x) ||
      !Number.isFinite(marker.y)
    ) {
      throw new Error(`Municipality marker ${marker.code} must have finite numeric coordinates`);
    }
    if (markerCodes.has(marker.code)) throw new Error(`Invalid municipality marker code ${marker.code}`);
    markerCodes.add(marker.code);
  }

  const occupiedAreaKeys = new Set<string>();
  for (const [index, area] of artifact.occupiedAreas.entries()) {
    if (!isRecord(area)) throw new Error(`Occupied area at index ${index} must be an object`);
    if (typeof area.key !== "string" || area.key.length === 0) {
      throw new Error(`Occupied area at index ${index} must have a non-empty string key`);
    }
    if (typeof area.d !== "string" || area.d.trim().length === 0) {
      throw new Error(`Occupied area ${area.key} must have a non-empty string path`);
    }
    if (!hasExactCodes(Object.keys(area), ["key", "d"])) {
      throw new Error(`Unexpected fields for occupied area ${area.key}`);
    }
    if (occupiedAreaKeys.has(area.key)) throw new Error(`Duplicate occupied area ${area.key}`);
    occupiedAreaKeys.add(area.key);
  }

  const allCodes = new Set([...polygonCodes, ...markerCodes]);
  if (!hasExactCodes(markerCodes, EXPECTED_MARKER_CODES)) throw new Error("Municipality map artifact has unexpected marker codes");
  if (!hasExactCodes([...markerCodes].filter((code) => polygonCodes.has(code)), ["04"])) {
    throw new Error("Municipality map artifact marker/polygon intersection must be 04");
  }
  if (!hasExactCodes(allCodes, EXPECTED_MUNICIPALITY_CODES)) throw new Error("Municipality map artifact has unexpected municipality codes");
  if (!hasExactCodes(occupiedAreaKeys, EXPECTED_OCCUPIED_AREA_KEYS)) {
    throw new Error("Municipality map artifact has unexpected occupied area keys");
  }

  return artifact as unknown as MunicipalityMapArtifact;
}

export const MUNICIPALITY_MAP_ARTIFACT = validateMunicipalityMapArtifact(rawArtifact);

function quantileBucket(values: number[]): (value: number) => number {
  const sorted = values.slice().sort((left, right) => left - right);
  const breaks = [1, 2, 3, 4, 5].map((index) => sorted[Math.floor((index / 6) * sorted.length)]!);

  return (value) => {
    let bucket = 0;
    while (bucket < breaks.length && value >= breaks[bucket]!) bucket += 1;
    return bucket;
  };
}

export function buildMunicipalityMapModel({
  municipalities,
  municipalityRows,
}: {
  municipalities: Municipality[];
  municipalityRows: MunicipalListRow[];
}): MunicipalityMapModel {
  const namesByCode = new Map<string, string>();
  for (const municipality of municipalities) {
    if (namesByCode.has(municipality.code)) throw new Error(`Duplicate municipality registry code ${municipality.code}`);
    namesByCode.set(municipality.code, municipality.displayNameKa);
  }

  const valuesByCode = new Map<string, number>();
  for (const row of municipalityRows) {
    if (row.kind !== "municipality") throw new Error(`Expected municipality row for ${row.id}`);
    if (!namesByCode.has(row.id)) throw new Error(`Unknown municipality row code ${row.id}`);
    if (valuesByCode.has(row.id)) throw new Error(`Duplicate municipality row code ${row.id}`);
    if (!Number.isFinite(row.valueGel)) throw new Error(`Invalid latest-year official total for municipality ${row.id}`);
    valuesByCode.set(row.id, row.valueGel);
  }

  const mapCodes = new Set([
    ...MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map((shape) => shape.code),
    ...MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => marker.code),
  ]);
  for (const code of namesByCode.keys()) {
    if (!mapCodes.has(code)) throw new Error(`Municipality registry code ${code} has no map geometry`);
    if (!valuesByCode.has(code)) throw new Error(`Missing latest-year official total for municipality ${code}`);
  }

  const valueFor = (code: string): number => {
    const value = valuesByCode.get(code);
    if (value === undefined) throw new Error(`Missing latest-year official total for municipality ${code}`);
    return value;
  };
  const nameFor = (code: string): string => {
    const name = namesByCode.get(code);
    if (name === undefined) throw new Error(`Municipality map code ${code} is not in the registry`);
    return name;
  };

  const polygonValues = MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map((shape) => valueFor(shape.code));
  const bucketOf = quantileBucket(polygonValues);

  return {
    viewBox: MUNICIPALITY_MAP_ARTIFACT.viewBox,
    shapes: MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map((shape) => ({
      code: shape.code,
      nameKa: nameFor(shape.code),
      d: shape.d,
      valueGel: valueFor(shape.code),
      bucket: bucketOf(valueFor(shape.code)),
    })),
    markers: MUNICIPALITY_MAP_ARTIFACT.cityMarkers.map((marker) => ({
      code: marker.code,
      nameKa: nameFor(marker.code),
      x: marker.x,
      y: marker.y,
      valueGel: valueFor(marker.code),
    })),
    occupiedAreas: MUNICIPALITY_MAP_ARTIFACT.occupiedAreas.map((area) => ({ key: area.key, d: area.d })),
    legendMinGel: Math.min(...polygonValues),
    legendMaxGel: Math.max(...polygonValues),
  };
}
