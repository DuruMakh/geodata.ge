import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMunicipalitiesFile } from "../municipal/municipalitiesFile";
import {
  CITY_MARKER_SOURCE_PATH,
  MUNICIPALITY_SOURCE_PATH,
  OCCUPIED_SOURCE_PATH,
  loadMunicipalityGeometrySources,
  sha256Text,
  validateMunicipalityGeometrySources,
  type Position,
  type SupportedGeometry,
} from "./source";

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 540;
export const MAP_PADDING = 14;
export const MAP_COORDINATE_DECIMALS = 1;
export const SIMPLIFICATION_TOLERANCE_PX = 0;
export const GENERATED_ARTIFACT_PATH = "../../data/geometry/municipality-map-paths.json";
export const GENERATED_SVG_ASSET_PATH = "assets/municipality-map-definitions.svg";
export const GENERATED_SVG_ASSET_README_PATH = "assets/municipality-map-definitions.README.md";
export const GENERATED_MANIFEST_PATH =
  "../../docs/Raw Data/Municipalities/municipality-map-geometry/source-manifest.json";

export type MunicipalityMapArtifact = {
  version: 1;
  viewBox: "0 0 1000 540";
  municipalityPaths: Array<{ code: string; relationId: number; d: string }>;
  cityMarkers: Array<{ code: string; x: number; y: number }>;
  occupiedAreas: Array<{ key: "abkhazia" | "tskhinvali"; d: string }>;
};

export type MunicipalityMapManifest = {
  version: 1;
  snapshotDate: "2026-08-06";
  projection: {
    name: "Web Mercator";
    viewBox: "0 0 1000 540";
    paddingPx: 14;
    coordinateDecimals: 1;
    simplificationTolerancePx: 0;
  };
  sources: Array<{
    id: string;
    url: string | null;
    licence: string;
    file: string;
    bytes: number;
    sha256: string;
    featureCount: number;
  }>;
  municipalityCodeCrosswalk: Array<{
    code: string;
    relationId: number;
    sourceUrl: string;
  }>;
  generatedArtifact: {
    file: "data/geometry/municipality-map-paths.json";
    bytes: number;
    sha256: string;
    municipalityPathCount: 60;
    cityMarkerCount: 5;
    occupiedOverlayCount: 2;
  };
  generatedSvgAsset: {
    file: "apps/web/assets/municipality-map-definitions.svg";
    bytes: number;
    sha256: string;
    municipalityPathCount: 60;
    occupiedOverlayCount: 2;
  };
};

type RawPoint = { x: number; y: number };
type Projection = (position: Position) => { x: number; y: number };

function toMercator([longitude, latitude]: Position): RawPoint {
  const longitudeRadians = longitude * Math.PI / 180;
  const latitudeRadians = latitude * Math.PI / 180;
  return {
    x: longitudeRadians,
    y: Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2)),
  };
}

function geometryPositions(geometry: SupportedGeometry): Position[] {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.flatMap((ring) => ring));
}

function createProjection(geometries: SupportedGeometry[]): Projection {
  const points = geometries.flatMap(geometryPositions).map(toMercator);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;
  const scale = Math.min(
    (MAP_WIDTH - 2 * MAP_PADDING) / rawWidth,
    (MAP_HEIGHT - 2 * MAP_PADDING) / rawHeight,
  );
  const offsetX = (MAP_WIDTH - rawWidth * scale) / 2;
  const offsetY = (MAP_HEIGHT - rawHeight * scale) / 2;

  return (position) => {
    const point = toMercator(position);
    return {
      x: offsetX + (point.x - minX) * scale,
      y: offsetY + (maxY - point.y) * scale,
    };
  };
}

function fixedCoordinate(value: number): string {
  return value.toFixed(MAP_COORDINATE_DECIMALS);
}

function geometryPath(geometry: SupportedGeometry, project: Projection): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .flatMap((polygon) => polygon)
    .map((ring) => ring.map((position, index) => {
      const point = project(position);
      const command = index === 0 ? "M" : "L";
      return `${command}${fixedCoordinate(point.x)} ${fixedCoordinate(point.y)}`;
    }).join("") + "Z")
    .join("");
}

function relationId(sourceId: string): number {
  const match = /^osm-relation-(\d+)$/.exec(sourceId);
  if (!match) {
    throw new Error(`Invalid municipality source relation ${sourceId}`);
  }
  return Number(match[1]);
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sourceRow(
  id: string,
  url: string | null,
  licence: string,
  file: string,
  text: string,
  featureCount: number,
): MunicipalityMapManifest["sources"][number] {
  return {
    id,
    url,
    licence,
    file,
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: sha256Text(text),
    featureCount,
  };
}

function municipalityMapSvgAssetText(artifact: MunicipalityMapArtifact): string {
  const definitions = [
    ...artifact.municipalityPaths.map(
      (shape) => `    <path id="municipality-shape-${shape.code}" d="${shape.d}" fill-rule="evenodd" clip-rule="evenodd" vector-effect="non-scaling-stroke" />`,
    ),
    ...artifact.occupiedAreas.map(
      (area) => `    <path id="occupied-overlay-${area.key}" d="${area.d}" fill-rule="evenodd" clip-rule="evenodd" vector-effect="non-scaling-stroke" />`,
    ),
  ];

  return [
    `<!-- Generated by npm run data:prepare-municipality-geometry. Do not edit directly. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${artifact.viewBox}">`,
    "  <defs>",
    ...definitions,
    "  </defs>",
    "</svg>",
    "",
  ].join("\n");
}

function municipalityMapSvgAssetReadmeText(): string {
  return [
    "# Municipality map definitions",
    "",
    "This generated SVG holds the exact reviewed municipal and occupied-area paths from `data/geometry/municipality-map-paths.json`.",
    "It is imported by the interactive map so Next emits a content-hashed, same-origin asset. The map renders each path through an SVG `<use>` element and keeps current budget paint, hatching, strokes, keyboard behavior, and accessible metadata in the page.",
    "",
    "Run `npm run data:prepare-municipality-geometry` from `apps/web` to regenerate this file and the source manifest. `npm run data:check-municipality-geometry` verifies byte-for-byte parity.",
    "",
  ].join("\n");
}

export async function buildMunicipalityGeometryOutputs(): Promise<{
  artifact: MunicipalityMapArtifact;
  manifest: MunicipalityMapManifest;
  artifactText: string;
  svgAssetText: string;
  svgAssetReadmeText: string;
  manifestText: string;
}> {
  const [sources, municipalities] = await Promise.all([
    loadMunicipalityGeometrySources(),
    loadMunicipalitiesFile("../../data/imports/municipalities.csv"),
  ]);
  validateMunicipalityGeometrySources(sources, municipalities.map((municipality) => municipality.code));

  const project = createProjection([
    ...sources.municipalities.features.map((feature) => feature.geometry),
    ...sources.occupiedAreas.features.map((feature) => feature.geometry),
  ]);

  const municipalityPaths = sources.municipalities.features
    .map((feature) => ({
      code: feature.properties.code,
      relationId: relationId(feature.properties.sourceId),
      d: geometryPath(feature.geometry, project),
    }))
    .sort((left, right) => compareAscii(left.code, right.code));
  const cityMarkers = sources.cityMarkers
    .map((marker) => {
      const point = project([marker.lon, marker.lat]);
      return {
        code: marker.code,
        x: Number(fixedCoordinate(point.x)),
        y: Number(fixedCoordinate(point.y)),
      };
    })
    .sort((left, right) => compareAscii(left.code, right.code));
  const occupiedAreas = sources.occupiedAreas.features
    .map((feature) => ({
      key: feature.properties.key,
      d: geometryPath(feature.geometry, project),
    }))
    .sort((left, right) => compareAscii(left.key, right.key));

  const pathText = [...municipalityPaths, ...occupiedAreas].map((item) => item.d).join("");
  if (Buffer.byteLength(pathText, "utf8") > 350 * 1024) {
    throw new Error("municipality map path payload exceeds 350 KB");
  }

  const artifact: MunicipalityMapArtifact = {
    version: 1,
    viewBox: "0 0 1000 540",
    municipalityPaths,
    cityMarkers,
    occupiedAreas,
  };
  const artifactText = `${JSON.stringify(artifact)}\n`;
  const svgAssetText = municipalityMapSvgAssetText(artifact);
  const svgAssetReadmeText = municipalityMapSvgAssetReadmeText();
  const municipalityCodeCrosswalk = municipalityPaths.map(({ code, relationId: id }) => ({
    code,
    relationId: id,
    sourceUrl: `https://www.openstreetmap.org/relation/${id}`,
  }));
  const manifest: MunicipalityMapManifest = {
    version: 1,
    snapshotDate: "2026-08-06",
    projection: {
      name: "Web Mercator",
      viewBox: "0 0 1000 540",
      paddingPx: 14,
      coordinateDecimals: 1,
      simplificationTolerancePx: 0,
    },
    sources: [
      sourceRow(
        "openstreetmap-municipality-boundaries",
        "https://www.openstreetmap.org/copyright",
        "ODbL 1.0",
        MUNICIPALITY_SOURCE_PATH.replace("../../", ""),
        sources.sourceTexts.municipalities,
        sources.municipalities.features.length,
      ),
      sourceRow(
        "natural-earth-occupied-area-overlays",
        "https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/",
        "Public domain",
        OCCUPIED_SOURCE_PATH.replace("../../", ""),
        sources.sourceTexts.occupiedAreas,
        sources.occupiedAreas.features.length,
      ),
      sourceRow(
        "approved-city-markers",
        null,
        "Reviewed project data",
        CITY_MARKER_SOURCE_PATH.replace("../../", ""),
        sources.sourceTexts.cityMarkers,
        sources.cityMarkers.length,
      ),
    ],
    municipalityCodeCrosswalk,
    generatedArtifact: {
      file: "data/geometry/municipality-map-paths.json",
      bytes: Buffer.byteLength(artifactText, "utf8"),
      sha256: sha256Text(artifactText),
      municipalityPathCount: 60,
      cityMarkerCount: 5,
      occupiedOverlayCount: 2,
    },
    generatedSvgAsset: {
      file: "apps/web/assets/municipality-map-definitions.svg",
      bytes: Buffer.byteLength(svgAssetText, "utf8"),
      sha256: sha256Text(svgAssetText),
      municipalityPathCount: 60,
      occupiedOverlayCount: 2,
    },
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;

  return { artifact, manifest, artifactText, svgAssetText, svgAssetReadmeText, manifestText };
}

export async function writeMunicipalityGeometryOutputs(): Promise<void> {
  const { artifactText, svgAssetText, svgAssetReadmeText, manifestText } = await buildMunicipalityGeometryOutputs();
  const artifactPath = path.resolve(process.cwd(), GENERATED_ARTIFACT_PATH);
  const svgAssetPath = path.resolve(process.cwd(), GENERATED_SVG_ASSET_PATH);
  const svgAssetReadmePath = path.resolve(process.cwd(), GENERATED_SVG_ASSET_README_PATH);
  const manifestPath = path.resolve(process.cwd(), GENERATED_MANIFEST_PATH);
  await Promise.all([
    mkdir(path.dirname(artifactPath), { recursive: true }),
    mkdir(path.dirname(svgAssetPath), { recursive: true }),
    mkdir(path.dirname(manifestPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(artifactPath, artifactText, "utf8"),
    writeFile(svgAssetPath, svgAssetText, "utf8"),
    writeFile(svgAssetReadmePath, svgAssetReadmeText, "utf8"),
    writeFile(manifestPath, manifestText, "utf8"),
  ]);
}

async function checkOutput(outputPath: string, expectedText: string, label: string): Promise<void> {
  let actualText: string;
  try {
    actualText = await readFile(path.resolve(process.cwd(), outputPath), "utf8");
  } catch {
    throw new Error(`Stale municipality geometry ${label}: ${outputPath}`);
  }
  if (actualText !== expectedText) {
    throw new Error(`Stale municipality geometry ${label}: ${outputPath}`);
  }
}

export async function checkMunicipalityGeometryOutputs(): Promise<void> {
  const { artifactText, svgAssetText, svgAssetReadmeText, manifestText } = await buildMunicipalityGeometryOutputs();
  await checkOutput(GENERATED_ARTIFACT_PATH, artifactText, "artifact");
  await checkOutput(GENERATED_SVG_ASSET_PATH, svgAssetText, "SVG asset");
  await checkOutput(GENERATED_SVG_ASSET_README_PATH, svgAssetReadmeText, "SVG asset README");
  await checkOutput(GENERATED_MANIFEST_PATH, manifestText, "manifest");
}
