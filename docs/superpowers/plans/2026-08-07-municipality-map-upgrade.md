# Municipality Map Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the municipalities index's region-grain map with the approved static municipality-grain SVG map, so every one of the 64 served municipalities is directly reachable and map/list interaction is accessible and synchronized.

**Architecture:** Preserve the reviewed preview geometry as immutable repository source data, then run a deterministic Node/TypeScript preparation step that projects it into a checked-in compact SVG-path artifact. The server joins latest-year official municipal totals and quantile buckets to that artifact; a dedicated client `MunicipalityMap` owns only pointer, focus, tooltip, and activation behavior while `MunicipalitiesIndex` owns the shared active municipality code used by the ranked list.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, SVG, Tailwind v4, Vitest, Playwright, Node.js 24 built-ins only for geometry preparation (no runtime map framework and no new package dependency).

## Global Constraints

- The reviewed geometry input is the approved preview at `C:\Users\Mylaptop\.codex\visualizations\2026\08\06\019fd8a6-6e57-7820-8879-5e6681b4761a\municipality-geometry-preview.html`.
- The source contract is exactly 60 unique municipality polygons, marker-only codes `06`, `20`, `32`, and `48`, and Tbilisi `04` as the sole polygon-plus-marker duplicate.
- Polygons plus markers must expose exactly the 64 codes in `data/imports/municipalities.csv`; excluded public codes `05`, `42`, `43`, `46`, and `64` must never become interactive targets.
- Zugdidi code `33` must remain OpenStreetMap relation `2016161`, with the reviewed corrected shape.
- Keep exactly five green markers: Tbilisi `04`, Batumi `06`, Kutaisi `20`, Poti `32`, and Rustavi `48`.
- Use the latest available official municipal budget year and the existing six-step terracotta ramp; do not add a year selector.
- Use zero geometry simplification tolerance and one-decimal projected coordinates. A read-only measurement of the approved source produced 229,119 municipality-plus-overlay path characters, so reviewed vertices can be preserved below the 350 KB uncompressed cap.
- The application must not fetch geometry at runtime or add a general map framework, zoom, pan, basemap, roads, settlements, or geographic search.
- Abkhazia and the Tskhinvali region render after municipal fills as non-interactive overlays with no label, tooltip, link, keyboard focus, map text, or legend entry.
- Municipality polygons and markers navigate immediately to `/explorer/municipalities/[code]`; no persistent selected state or two-tap behavior is added.
- Pointer hover and keyboard focus use the same active-municipality treatment. Native rectangular SVG focus outlines are suppressed only for municipality map targets and replaced by polygon strokes or circular marker treatment.
- The visible tooltip contains only the Georgian name, formatted official budget amount, and `→`. Its accessible target name must explicitly describe opening the municipality.
- Municipality map/list highlighting is bidirectional. Region-list rows do not highlight municipality geometry, and selecting the Regions tab never changes the map grain.
- Keep the 64 municipality pages, 11 region pages, ranked-list tabs, KPIs, search, budget definitions, exclusions, and editorial shell unchanged except where this map specification explicitly requires copy or interaction changes.
- The public source note must contain a linked notice equivalent to `Boundaries: © OpenStreetMap contributors, ODbL.` and must not contain occupied-territory wording.
- Preserve shared ADM1 data in `apps/web/lib/landing/georgiaGeo.ts` and its fetch script; delete only code and tests that existed solely to render the municipalities index's old region map.
- Generated municipality and occupied-overlay SVG path data must remain at or below 350 KB uncompressed.
- Run all commands from `apps/web` with `npm.cmd` on Windows unless a step explicitly says to run from the repository root.

---

## File Structure

### Reviewed inputs and generated outputs

- Create `docs/Raw Data/Municipalities/municipality-map-geometry/municipalities-osm.geojson` — minified reviewed OSM polygon snapshot with budget values removed.
- Create `docs/Raw Data/Municipalities/municipality-map-geometry/occupied-areas-natural-earth.geojson` — minified reviewed Natural Earth overlay snapshot.
- Create `docs/Raw Data/Municipalities/municipality-map-geometry/city-markers.json` — five approved marker coordinates with budget values removed.
- Create `docs/Raw Data/Municipalities/municipality-map-geometry/README.md` — source URLs, licences, snapshot date, extraction rule, relation join, and regeneration instructions.
- Create `docs/Raw Data/Municipalities/municipality-map-geometry/source-manifest.json` — deterministic generated provenance manifest, code crosswalk, source hashes, and output hash.
- Create `data/geometry/municipality-map-paths.json` — compact generated viewBox, municipality paths, marker coordinates, and occupied overlay paths consumed at build time.

### Preparation and composition

- Create `apps/web/lib/data/municipalGeometry/source.ts` — source types, paths, parsing, source-contract validation, and hashing.
- Create `apps/web/lib/data/municipalGeometry/prepareMunicipalGeometry.ts` — Mercator fitting, path serialization, generated artifact/manifest construction, writing, and fixed-point checking.
- Create `apps/web/scripts/prepare-municipality-geometry.ts` — small write/check command wrapper.
- Modify `apps/web/package.json` — add write and check scripts for municipality geometry.
- Modify `apps/web/scripts/validate-data-files.ts` — replace the old region-shape validation with source/artifact fixed-point validation against the live 64-code registry.
- Create `apps/web/lib/explorer/municipalityMapData.ts` — validate the generated JSON and join names, latest-year values, buckets, and legend endpoints.

### UI and tests

- Create `apps/web/components/municipalities/municipality-map.tsx` — dedicated static SVG map with navigation, focus treatment, tooltip, and active-code synchronization.
- Modify `apps/web/app/explorer/municipalities/page.tsx` — build the municipality map model, update map copy, and provide OSM attribution data.
- Modify `apps/web/components/municipalities/municipalities-index.tsx` — render `MunicipalityMap`, own the active code, synchronize municipality rows, and retain the Regions tab behavior.
- Modify `apps/web/app/globals.css` — remove the bounding-box focus rule and add a narrowly scoped outline suppression for the new shape-following treatment.
- Modify `apps/web/lib/explorer/colors.ts` — update the map-ramp comment from region-grain to municipality-grain without changing tokens.
- Create `apps/web/tests/data/municipalGeometry/source.test.ts` — raw snapshot and served-code contract.
- Create `apps/web/tests/data/municipalGeometry/prepareMunicipalGeometry.test.ts` — deterministic output, hash, path, and payload contract.
- Create `apps/web/tests/explorer/municipalityMapData.test.ts` — server join, bucket, duplicate, and failure behavior.
- Modify `apps/web/tests/browser/municipalities.spec.ts` — municipality-grain rendering, navigation, keyboard, tooltip, list synchronization, focus shape, overlays, tabs, and attribution.
- Delete `apps/web/components/municipalities/region-map.tsx` — old index-only region map.
- Delete `apps/web/lib/explorer/municipalGeo.ts` — old index-only ADM1 join/projection.
- Delete `apps/web/tests/explorer/municipalGeo.test.ts` — superseded ADM1 index tests.

### Durable documentation

- Modify `DESIGN.md` §20 — make the municipality-grain SVG map the current contract.
- Modify `AGENTS.md` Current Project State — replace the obsolete future-map wording while keeping deployment status separate from implementation status.
- Modify `docs/data-methodology/municipal-functional-annual-2015-2025.md` — document OSM/Natural Earth provenance, relation/code coverage, generation, licences, and non-interactive overlays.

---

### Task 1: Preserve and Validate the Reviewed Geometry Snapshot

**Files:**
- Create: `docs/Raw Data/Municipalities/municipality-map-geometry/municipalities-osm.geojson`
- Create: `docs/Raw Data/Municipalities/municipality-map-geometry/occupied-areas-natural-earth.geojson`
- Create: `docs/Raw Data/Municipalities/municipality-map-geometry/city-markers.json`
- Create: `docs/Raw Data/Municipalities/municipality-map-geometry/README.md`
- Create: `apps/web/lib/data/municipalGeometry/source.ts`
- Create: `apps/web/tests/data/municipalGeometry/source.test.ts`

**Interfaces:**
- Consumes: the approved preview HTML and `loadMunicipalitiesFile("../../data/imports/municipalities.csv")`.
- Produces: `MARKER_ONLY_CODES`, `POLYGON_AND_MARKER_CODES`, `EXCLUDED_MAP_CODES`, `loadMunicipalityGeometrySources()`, `validateMunicipalityGeometrySources(sources, servedCodes)`, and `sha256Text(text)` for Task 2.

- [ ] **Step 1: Write the failing source-contract test**

Create `apps/web/tests/data/municipalGeometry/source.test.ts` with the real registry and these assertions:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadMunicipalitiesFile } from "../../../lib/data/municipal/municipalitiesFile";
import {
  EXCLUDED_MAP_CODES,
  MARKER_ONLY_CODES,
  POLYGON_AND_MARKER_CODES,
  loadMunicipalityGeometrySources,
  sha256Text,
  validateMunicipalityGeometrySources,
} from "../../../lib/data/municipalGeometry/source";

describe("reviewed municipality geometry sources", () => {
  it("covers the 64 served codes with the approved polygon and marker exceptions", async () => {
    const [sources, municipalities] = await Promise.all([
      loadMunicipalityGeometrySources(),
      loadMunicipalitiesFile("../../data/imports/municipalities.csv"),
    ]);
    const servedCodes = municipalities.map((row) => row.code).sort();

    expect(() => validateMunicipalityGeometrySources(sources, servedCodes)).not.toThrow();
    expect(sources.municipalities.features).toHaveLength(60);
    expect(sources.cityMarkers.map((marker) => marker.code).sort()).toEqual(["04", "06", "20", "32", "48"]);
    expect(MARKER_ONLY_CODES).toEqual(["06", "20", "32", "48"]);
    expect(POLYGON_AND_MARKER_CODES).toEqual(["04"]);
    const excludedCodes = new Set<string>(EXCLUDED_MAP_CODES);
    expect(sources.municipalities.features.some((feature) => excludedCodes.has(feature.properties.code))).toBe(false);
  });

  it("pins the corrected Zugdidi relation", async () => {
    const { municipalities } = await loadMunicipalityGeometrySources();
    const zugdidi = municipalities.features.find((feature) => feature.properties.code === "33");
    expect(zugdidi?.properties.sourceId).toBe("osm-relation-2016161");
    expect(zugdidi?.properties.nameKa).toBe("ზუგდიდი");
  });

  it("pins the approved canonical source bytes", async () => {
    const municipalityText = await readFile("../../docs/Raw Data/Municipalities/municipality-map-geometry/municipalities-osm.geojson", "utf8");
    const occupiedText = await readFile("../../docs/Raw Data/Municipalities/municipality-map-geometry/occupied-areas-natural-earth.geojson", "utf8");
    const markerText = await readFile("../../docs/Raw Data/Municipalities/municipality-map-geometry/city-markers.json", "utf8");

    expect(sha256Text(municipalityText)).toBe("EEE0FF11AED3F6F77A564C44B6B1D4C2779385EB05EC534B3EC6DBD784370539");
    expect(sha256Text(occupiedText)).toBe("4D983CCA1FFC4825D87345550E194BB17ABE1CCBED3C62301D30E4C6DBAD7464");
    expect(sha256Text(markerText)).toBe("CBA85ACCCCE642F595282EFA7064CB3CA4BE4A08A586C7A0764089E4527E0E41");
  });
});
```

- [ ] **Step 2: Run the source test and verify the missing module/files failure**

Run:

```powershell
npm.cmd test -- tests/data/municipalGeometry/source.test.ts
```

Expected: FAIL because `lib/data/municipalGeometry/source.ts` and the three reviewed source files do not exist.

- [ ] **Step 3: Extract the approved source data without retaining preview budget values**

From the repository root, run this one-time bulk extraction. It writes canonical minified JSON plus one trailing newline, which is the byte format pinned above:

```powershell
@'
const fs = require("node:fs");
const path = require("node:path");

const previewPath = "C:/Users/Mylaptop/.codex/visualizations/2026/08/06/019fd8a6-6e57-7820-8879-5e6681b4761a/municipality-geometry-preview.html";
const outputDirectory = path.resolve("docs/Raw Data/Municipalities/municipality-map-geometry");
const html = fs.readFileSync(previewPath, "utf8");
const municipalityMatch = html.match(/const municipalities = (\{.*?\});\s*const occupiedAreas =/s);
const occupiedMatch = html.match(/const occupiedAreas = (\{.*?\});\s*const cityMarkers =/s);
const markerMatch = html.match(/const cityMarkers = (\[.*?\]);\s*\/\/ The published/s);

if (!municipalityMatch || !occupiedMatch || !markerMatch) {
  throw new Error("Approved preview geometry constants were not found");
}

const rawMunicipalities = JSON.parse(municipalityMatch[1]);
const municipalities = {
  type: "FeatureCollection",
  features: rawMunicipalities.features.map((feature) => ({
    type: "Feature",
    properties: {
      sourceName: feature.properties.sourceName,
      sourceId: feature.properties.sourceId,
      code: feature.properties.code,
      nameKa: feature.properties.nameKa,
      nameEn: feature.properties.nameEn,
      source: feature.properties.source,
    },
    geometry: feature.geometry,
  })),
};
const occupiedAreas = JSON.parse(occupiedMatch[1]);
const cityMarkers = JSON.parse(markerMatch[1]).map(({ code, nameKa, nameEn, lon, lat }) => ({
  code,
  nameKa,
  nameEn,
  lon,
  lat,
}));

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "municipalities-osm.geojson"), `${JSON.stringify(municipalities)}\n`, "utf8");
fs.writeFileSync(path.join(outputDirectory, "occupied-areas-natural-earth.geojson"), `${JSON.stringify(occupiedAreas)}\n`, "utf8");
fs.writeFileSync(path.join(outputDirectory, "city-markers.json"), `${JSON.stringify(cityMarkers)}\n`, "utf8");
'@ | node -
```

Verify the exact byte counts and hashes:

```powershell
Get-Item "docs/Raw Data/Municipalities/municipality-map-geometry/*.json", "docs/Raw Data/Municipalities/municipality-map-geometry/*.geojson" | Select-Object Name, Length
Get-FileHash -Algorithm SHA256 "docs/Raw Data/Municipalities/municipality-map-geometry/municipalities-osm.geojson", "docs/Raw Data/Municipalities/municipality-map-geometry/occupied-areas-natural-earth.geojson", "docs/Raw Data/Municipalities/municipality-map-geometry/city-markers.json"
```

Expected byte counts: `459040`, `5424`, and `446`. Expected hashes are the three uppercase values in the test.

- [ ] **Step 4: Implement source types and parsing**

Create `apps/web/lib/data/municipalGeometry/source.ts` with these public constants and types:

```ts
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
```

Implement `loadMunicipalityGeometrySources()` by resolving the three constants from `process.cwd()`, reading all three files in parallel, parsing JSON, and returning both parsed values and original text.

- [ ] **Step 5: Implement the source-contract validator**

Implement `validateMunicipalityGeometrySources(sources, servedCodes)` with named errors for exact counts, unique polygon codes and relation IDs, exact marker sets, intersection `04`, exact served union, excluded-code absence, finite `[lon, lat]` values, closed non-empty Polygon/MultiPolygon rings, and occupied keys `abkhazia` and `tskhinvali`. Every error must include the offending code, relation, overlay key, or coordinate position.

- [ ] **Step 6: Document the immutable source package**

Create the package README with:

- snapshot date `2026-08-06`;
- OSM licence URL `https://www.openstreetmap.org/copyright` and relation URL rule `https://www.openstreetmap.org/relation/{relationId}`;
- Natural Earth source page `https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/` and public-domain notice `https://www.naturalearthdata.com/about/`;
- the approved preview path and extraction command;
- the exact three hashes and byte counts;
- the 60 polygon / five marker / 64 unique-code contract;
- Zugdidi `33` → relation `2016161`;
- a statement that `value` was intentionally removed because budget values come from canonical municipal facts at build time.

- [ ] **Step 7: Run the focused source test**

Run:

```powershell
npm.cmd test -- tests/data/municipalGeometry/source.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the reviewed inputs and source contract**

```powershell
git add "docs/Raw Data/Municipalities/municipality-map-geometry" apps/web/lib/data/municipalGeometry/source.ts apps/web/tests/data/municipalGeometry/source.test.ts
git commit -m "data: preserve reviewed municipality geometry"
```

---

### Task 2: Generate and Check the Compact SVG Geometry Artifact

**Files:**
- Create: `apps/web/lib/data/municipalGeometry/prepareMunicipalGeometry.ts`
- Create: `apps/web/scripts/prepare-municipality-geometry.ts`
- Create: `apps/web/tests/data/municipalGeometry/prepareMunicipalGeometry.test.ts`
- Create: `data/geometry/municipality-map-paths.json`
- Create: `docs/Raw Data/Municipalities/municipality-map-geometry/source-manifest.json`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: `loadMunicipalityGeometrySources()`, `validateMunicipalityGeometrySources()`, and `sha256Text()` from Task 1.
- Produces: `MunicipalityMapArtifact`, `MunicipalityMapManifest`, `buildMunicipalityGeometryOutputs()`, `writeMunicipalityGeometryOutputs()`, and `checkMunicipalityGeometryOutputs()` for validation and server composition.

- [ ] **Step 1: Write the failing deterministic-generation tests**

Create `apps/web/tests/data/municipalGeometry/prepareMunicipalGeometry.test.ts` with these cases:

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  GENERATED_ARTIFACT_PATH,
  GENERATED_MANIFEST_PATH,
  buildMunicipalityGeometryOutputs,
  checkMunicipalityGeometryOutputs,
} from "../../../lib/data/municipalGeometry/prepareMunicipalGeometry";

describe("municipality geometry preparation", () => {
  it("builds the approved counts and duplicate contract", async () => {
    const { artifact } = await buildMunicipalityGeometryOutputs();
    expect(artifact.municipalityPaths).toHaveLength(60);
    expect(artifact.cityMarkers.map((marker) => marker.code)).toEqual(["04", "06", "20", "32", "48"]);
    expect(artifact.occupiedAreas.map((area) => area.key)).toEqual(["abkhazia", "tskhinvali"]);
    expect(new Set([...artifact.municipalityPaths.map((shape) => shape.code), ...artifact.cityMarkers.map((marker) => marker.code)]).size).toBe(64);
  });

  it("emits finite closed paths inside the viewBox", async () => {
    const { artifact } = await buildMunicipalityGeometryOutputs();
    for (const item of [...artifact.municipalityPaths, ...artifact.occupiedAreas]) {
      expect(item.d.startsWith("M")).toBe(true);
      expect(item.d.endsWith("Z")).toBe(true);
      const numbers = item.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      expect(numbers.length).toBeGreaterThan(0);
      expect(numbers.every(Number.isFinite)).toBe(true);
      for (let index = 0; index < numbers.length; index += 2) {
        expect(numbers[index]).toBeGreaterThanOrEqual(0);
        expect(numbers[index]).toBeLessThanOrEqual(1000);
        expect(numbers[index + 1]).toBeGreaterThanOrEqual(0);
        expect(numbers[index + 1]).toBeLessThanOrEqual(540);
      }
    }
  });

  it("keeps generated path payload below 350 KB", async () => {
    const { artifact } = await buildMunicipalityGeometryOutputs();
    const pathText = [...artifact.municipalityPaths, ...artifact.occupiedAreas].map((item) => item.d).join("");
    expect(Buffer.byteLength(pathText, "utf8")).toBeLessThanOrEqual(350 * 1024);
  });

  it("is deterministic and matches both checked-in outputs", async () => {
    const first = await buildMunicipalityGeometryOutputs();
    const second = await buildMunicipalityGeometryOutputs();
    expect(first).toEqual(second);
    expect(await readFile(GENERATED_ARTIFACT_PATH, "utf8")).toBe(first.artifactText);
    expect(await readFile(GENERATED_MANIFEST_PATH, "utf8")).toBe(first.manifestText);
    await expect(checkMunicipalityGeometryOutputs()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the generator test and verify it fails**

Run:

```powershell
npm.cmd test -- tests/data/municipalGeometry/prepareMunicipalGeometry.test.ts
```

Expected: FAIL because the preparation module and generated outputs do not exist.

- [ ] **Step 3: Define the generated artifact and manifest contracts**

Create `prepareMunicipalGeometry.ts` with these exact public types and constants:

```ts
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 540;
export const MAP_PADDING = 14;
export const MAP_COORDINATE_DECIMALS = 1;
export const SIMPLIFICATION_TOLERANCE_PX = 0;
export const GENERATED_ARTIFACT_PATH = "../../data/geometry/municipality-map-paths.json";
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
};
```

- [ ] **Step 4: Implement projection and path serialization primitives**

Implement the projection in four deterministic stages:

1. Convert every source longitude to radians and latitude to Mercator Y with `Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2))`.
2. Compute one bounding box over municipality polygons and occupied overlays, then use `Math.min(972 / rawWidth, 512 / rawHeight)` and center the fitted result in the 1000×540 viewBox.
3. Serialize every Polygon or MultiPolygon ring as an SVG subpath with `M`, `L`, and `Z`, rounding X/Y to one decimal. Do not drop vertices because `SIMPLIFICATION_TOLERANCE_PX` is zero.
4. Sort municipality paths and markers by code and occupied overlays by `abkhazia` then `tskhinvali`.

- [ ] **Step 5: Build deterministic artifact and manifest text**

Expose these signatures:

```ts
export async function buildMunicipalityGeometryOutputs(): Promise<{
  artifact: MunicipalityMapArtifact;
  manifest: MunicipalityMapManifest;
  artifactText: string;
  manifestText: string;
}>;

export async function writeMunicipalityGeometryOutputs(): Promise<void>;
export async function checkMunicipalityGeometryOutputs(): Promise<void>;
```

`artifactText` must be minified JSON plus `\n`; `manifestText` must be `JSON.stringify(manifest, null, 2) + "\n"`. Derive each relation ID from `osm-relation-{number}` and generate its source URL as `https://www.openstreetmap.org/relation/{number}`. Sort manifest crosswalk rows by code. Emit three source rows: OSM boundaries (`https://www.openstreetmap.org/copyright`, `ODbL 1.0`), Natural Earth overlays (the official download URL in Task 1, `Public domain`), and approved city markers (`url: null`, with the reviewed preview identified in the package README). Use `sha256Text(artifactText)` for the output hash.

Before returning, calculate the UTF-8 byte length of all `d` strings joined together and throw `municipality map path payload exceeds 350 KB` above `350 * 1024`. This makes the payload ceiling part of generation and therefore part of `data:validate`, not only a unit-test expectation.

Implement `writeMunicipalityGeometryOutputs()` with `mkdir({ recursive: true })` and exact UTF-8 writes. Implement `checkMunicipalityGeometryOutputs()` by comparing exact text and throwing errors naming the stale artifact or manifest.

- [ ] **Step 6: Add the command wrapper and package scripts**

Create `apps/web/scripts/prepare-municipality-geometry.ts`:

```ts
import {
  checkMunicipalityGeometryOutputs,
  writeMunicipalityGeometryOutputs,
} from "../lib/data/municipalGeometry/prepareMunicipalGeometry";

async function main() {
  if (process.argv.includes("--check")) {
    await checkMunicipalityGeometryOutputs();
    console.log("Municipality geometry outputs are current.");
    return;
  }

  await writeMunicipalityGeometryOutputs();
  console.log("Wrote municipality geometry artifact and source manifest.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Add these scripts to `apps/web/package.json`:

```json
"data:prepare-municipality-geometry": "tsx scripts/prepare-municipality-geometry.ts",
"data:check-municipality-geometry": "tsx scripts/prepare-municipality-geometry.ts --check"
```

- [ ] **Step 7: Generate the artifact and manifest**

Run:

```powershell
npm.cmd run data:prepare-municipality-geometry
npm.cmd run data:check-municipality-geometry
```

Expected: both files are written; the second command prints `Municipality geometry outputs are current.`

- [ ] **Step 8: Run the focused generator tests**

Run:

```powershell
npm.cmd test -- tests/data/municipalGeometry/source.test.ts tests/data/municipalGeometry/prepareMunicipalGeometry.test.ts
```

Expected: PASS and the generated path payload is no more than 350 KB.

- [ ] **Step 9: Commit the deterministic generator and outputs**

```powershell
git add apps/web/lib/data/municipalGeometry/prepareMunicipalGeometry.ts apps/web/scripts/prepare-municipality-geometry.ts apps/web/tests/data/municipalGeometry/prepareMunicipalGeometry.test.ts apps/web/package.json data/geometry/municipality-map-paths.json "docs/Raw Data/Municipalities/municipality-map-geometry/source-manifest.json"
git commit -m "feat: generate municipality map geometry"
```

---

### Task 3: Join Latest-Year Budget Data to the Geometry on the Server

**Files:**
- Create: `apps/web/lib/explorer/municipalityMapData.ts`
- Create: `apps/web/tests/explorer/municipalityMapData.test.ts`

**Interfaces:**
- Consumes: generated `data/geometry/municipality-map-paths.json`, canonical `Municipality[]`, and latest-year `MunicipalListRow[]`.
- Produces: `MUNICIPALITY_MAP_ARTIFACT`, `MunicipalityMapModel`, and `buildMunicipalityMapModel({ municipalities, municipalityRows })` for the index page and client component.

- [ ] **Step 1: Write failing server-composition tests**

Create `apps/web/tests/explorer/municipalityMapData.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildMunicipalListRows } from "../../lib/explorer/municipalData";
import {
  buildMunicipalityMapModel,
  MUNICIPALITY_MAP_ARTIFACT,
} from "../../lib/explorer/municipalityMapData";

describe("municipality map server composition", () => {
  it("joins every polygon and marker to a registered latest-year official total", async () => {
    const { municipalities, regions, totalFacts } = await loadServedMunicipalData();
    const year = Math.max(...totalFacts.map((row) => row.year));
    const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
    const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year });
    const model = buildMunicipalityMapModel({ municipalities, municipalityRows: list.municipalities });

    expect(model.viewBox).toBe("0 0 1000 540");
    expect(model.shapes).toHaveLength(60);
    expect(model.markers).toHaveLength(5);
    expect(model.occupiedAreas).toHaveLength(2);
    expect(model.shapes.every((shape) => shape.valueGel > 0 && shape.bucket >= 0 && shape.bucket <= 5)).toBe(true);
    expect(model.markers.every((marker) => marker.valueGel > 0)).toBe(true);
    expect(new Set([...model.shapes.map((shape) => shape.code), ...model.markers.map((marker) => marker.code)]).size).toBe(64);
  });

  it("rejects a missing latest-year municipality value", async () => {
    const { municipalities, regions, totalFacts } = await loadServedMunicipalData();
    const year = Math.max(...totalFacts.map((row) => row.year));
    const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
    const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year });
    const withoutZugdidi = list.municipalities.filter((row) => row.id !== "33");

    expect(() => buildMunicipalityMapModel({ municipalities, municipalityRows: withoutZugdidi })).toThrow(
      /missing latest-year official total.*33/i,
    );
  });

  it("keeps the generated artifact's Tbilisi duplicate and Zugdidi relation", () => {
    expect(MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.find((shape) => shape.code === "33")?.relationId).toBe(2016161);
    expect(MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.some((shape) => shape.code === "04")).toBe(true);
    expect(MUNICIPALITY_MAP_ARTIFACT.cityMarkers.some((marker) => marker.code === "04")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the composition test and verify it fails**

Run:

```powershell
npm.cmd test -- tests/explorer/municipalityMapData.test.ts
```

Expected: FAIL because `municipalityMapData.ts` does not exist.

- [ ] **Step 3: Define and validate the runtime artifact model**

Create `apps/web/lib/explorer/municipalityMapData.ts` and import the generated JSON with `resolveJsonModule`:

```ts
import rawArtifact from "../../../../data/geometry/municipality-map-paths.json";
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
```

Validate `rawArtifact` at module load: version `1`, viewBox `0 0 1000 540`, exact array counts, non-empty paths, finite marker positions, and exact code contracts. Export the validated value as `MUNICIPALITY_MAP_ARTIFACT`.

- [ ] **Step 4: Implement latest-year value joins and polygon quantiles**

Implement `buildMunicipalityMapModel({ municipalities, municipalityRows })` as follows:

- reject any non-municipality row;
- build one registry name per code and one official value per row code, throwing on duplicate or unknown row codes;
- throw `missing latest-year official total for municipality {code}` instead of substituting zero;
- calculate five quantile breaks from the 60 polygon values only, matching the approved preview's polygon color domain;
- assign buckets `0` through `5` while retaining marker fill as green;
- join all five markers to the same name/value lookups;
- return legend minimum/maximum from polygon values;
- copy occupied paths without interactive metadata.

- [ ] **Step 5: Run the focused composition and geometry tests**

Run:

```powershell
npm.cmd test -- tests/explorer/municipalityMapData.test.ts tests/data/municipalGeometry/source.test.ts tests/data/municipalGeometry/prepareMunicipalGeometry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the server-side map model**

```powershell
git add apps/web/lib/explorer/municipalityMapData.ts apps/web/tests/explorer/municipalityMapData.test.ts
git commit -m "feat: compose municipality map budget data"
```

---

### Task 4: Render the Municipality Map and Navigate All 64 Routes

**Files:**
- Create: `apps/web/components/municipalities/municipality-map.tsx`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/components/municipalities/municipalities-index.tsx`
- Modify: `apps/web/tests/browser/municipalities.spec.ts`

**Interfaces:**
- Consumes: `MunicipalityMapModel` and `formatAmount()`.
- Produces: `MunicipalityMap(props)` with `activeCode`, `onActiveCodeChange`, and `onOpenMunicipality`, plus stable test attributes `municipality-shape-{code}`, `municipality-marker-{code}`, and `occupied-overlay-{key}`.

- [ ] **Step 1: Replace the old map browser assertions with failing municipality-grain assertions**

In `apps/web/tests/browser/municipalities.spec.ts`, retain the existing list/search/KPI/layout coverage and replace the region-map-specific tests with:

```ts
test("renders 60 municipality polygons, five markers, two inert overlays, and 64 unique routes", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const map = page.getByTestId("municipality-map");
  await expect(map.locator("[data-municipality-shape]")).toHaveCount(60);
  await expect(map.locator("[data-municipality-marker]")).toHaveCount(5);
  await expect(map.locator("[data-occupied-overlay]")).toHaveCount(2);

  const codes = await map.locator("[data-municipality-code]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-municipality-code")),
  );
  expect(new Set(codes).size).toBe(64);
  expect(codes).toHaveLength(65);
});

test("polygon and marker clicks open municipality pages directly", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-shape-33").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/33");

  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-marker-06").click();
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/06");
});

test("Enter and Space activate polygon and marker without scrolling", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await page.getByTestId("municipality-shape-33").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/33");

  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const before = await page.evaluate(() => window.scrollY);
  await page.getByTestId("municipality-marker-06").focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL((url) => url.pathname === "/explorer/municipalities/06");
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("occupied overlays expose no interaction or public explanation", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const overlays = page.locator("[data-occupied-overlay]");
  await expect(overlays).toHaveCount(2);
  for (const overlay of await overlays.all()) {
    await expect(overlay).toHaveAttribute("aria-hidden", "true");
    await expect(overlay).not.toHaveAttribute("tabindex");
    await expect(overlay).not.toHaveAttribute("role");
  }
  await expect(page.getByTestId("municipality-map")).not.toContainText(/ოკუპირ|Russian/i);
});
```

- [ ] **Step 2: Run the focused browser tests and verify the old region map fails them**

Run:

```powershell
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts --grep "renders 60|polygon and marker|Enter and Space|occupied overlays"
```

Expected: FAIL because `municipality-map` and municipality target attributes do not exist.

- [ ] **Step 3: Create the dedicated map component shell and prop contract**

Create `municipality-map.tsx` with this prop contract:

```ts
type MunicipalityMapProps = Omit<MunicipalityMapModel, "legendMinGel" | "legendMaxGel"> & {
  legendMin: string;
  legendMax: string;
  activeCode: string | null;
  onActiveCodeChange: (code: string | null) => void;
  onOpenMunicipality: (code: string) => void;
};
```

- [ ] **Step 4: Render municipality targets, overlays, and the legend**

Render:

- `<div data-testid="municipality-map">` and one responsive `<svg role="group" aria-label="საქართველოს მუნიციპალიტეტების ბიუჯეტის რუკა">`;
- shapes sorted by Georgian name, each with `tabIndex={0}`, `role="link"`, `data-municipality-shape`, `data-municipality-code`, and direct click/Enter/Space activation;
- `fillRule="evenodd"` and `clipRule="evenodd"` so Polygon/MultiPolygon holes render correctly regardless of source ring winding;
- an SVG hatch pattern using `MAP_NO_DATA_FILL` and `MAP_NO_DATA_STROKE`, followed by both overlay paths with `pointerEvents="none"`, `aria-hidden="true"`, and no role or label;
- five markers sorted by Georgian name and rendered after overlays using `var(--positive)` and `var(--tile)`;
- the existing six-ramp legend plus the self-governing-city marker key, with no occupied-area key.

For this task, wire pointer/focus handlers to `onActiveCodeChange` and direct navigation. Task 5 adds the anchored tooltip and preserves independent pointer/focus targets.

- [ ] **Step 5: Replace page-level region composition with the municipality model**

In `page.tsx`:

```ts
const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year: latestYear });
const map = buildMunicipalityMapModel({
  municipalities,
  municipalityRows: list.municipalities,
});
```

Pass `map.viewBox`, `map.shapes`, `map.markers`, `map.occupiedAreas`, and formatted `map.legendMinGel` / `map.legendMaxGel` to `MunicipalitiesIndex`. Remove `buildRegionShapes`, `projectPoint`, `GEORGIA_GEO`, `RegionMapShape`, `RegionMapCity`, region-value bucketization, and city-coordinate composition from the page.

Update visible copy to:

- map kicker: `მუნიციპალიტეტები რუკაზე · {latestYear}`;
- intro: `აირჩიე მუნიციპალიტეტი რუკაზე ან სიაში — გაიხსნება შესაბამისი ბიუჯეტის სრული ისტორია ფუნქციების მიხედვით.`

- [ ] **Step 6: Render the new map from the index without changing tabs or routes**

Replace `RegionMap` props with this exact index contract, initialize `const [activeMunicipalityCode, setActiveMunicipalityCode] = useState<string | null>(null)`, and render:

```ts
type MunicipalitiesIndexProps = Omit<MunicipalityMapModel, "legendMinGel" | "legendMaxGel"> & {
  legendMin: string;
  legendMax: string;
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
  kpis: MunicipalKpi[];
  latestYear: number;
  sourceNote: string;
};
```

```tsx
<MunicipalityMap
  viewBox={props.viewBox}
  shapes={props.shapes}
  markers={props.markers}
  occupiedAreas={props.occupiedAreas}
  legendMin={props.legendMin}
  legendMax={props.legendMax}
  activeCode={activeMunicipalityCode}
  onActiveCodeChange={setActiveMunicipalityCode}
  onOpenMunicipality={openMunicipality}
/>
```

Keep `openRegion`, Regions-tab routing, search, ranking, KPIs, and hash behavior unchanged.

- [ ] **Step 7: Run the focused browser and server tests**

Run:

```powershell
npm.cmd test -- tests/explorer/municipalityMapData.test.ts
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts --grep "renders 60|polygon and marker|Enter and Space|occupied overlays|lists all municipalities"
```

Expected: PASS.

- [ ] **Step 8: Commit the functional municipality map**

```powershell
git add apps/web/components/municipalities/municipality-map.tsx apps/web/components/municipalities/municipalities-index.tsx apps/web/app/explorer/municipalities/page.tsx apps/web/tests/browser/municipalities.spec.ts
git commit -m "feat: render clickable municipality map"
```

---

### Task 5: Add Tooltip, Shape-Following Focus, and Bidirectional List Highlighting

**Files:**
- Modify: `apps/web/components/municipalities/municipality-map.tsx`
- Modify: `apps/web/components/municipalities/municipalities-index.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tests/browser/municipalities.spec.ts`

**Interfaces:**
- Consumes: the shared `activeMunicipalityCode` from Task 4.
- Produces: map-origin pointer/focus targets, visible tooltip, `data-active` on map/list features, and narrowly scoped `[data-municipality-map-target]` focus CSS.

- [ ] **Step 1: Write failing tooltip, focus, and synchronization browser tests**

Add these focused cases:

```ts
test("map hover and focus show only name, amount, and an arrow visibly", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const zugdidi = page.getByTestId("municipality-shape-33");
  await zugdidi.hover();
  const tooltip = page.getByTestId("municipality-map-tooltip");
  await expect(tooltip).toContainText("ზუგდიდი");
  await expect(tooltip).toContainText("₾");
  await expect(tooltip).toContainText("→");
  await expect(tooltip).not.toContainText(/Open|გახსნა/);
  await expect(zugdidi).toHaveAccessibleName(/ზუგდიდი.*გახსნა/);

  const batumi = page.getByTestId("municipality-marker-06");
  await batumi.focus();
  await expect(tooltip).toContainText("ბათუმი");
  await expect(tooltip).toContainText("→");
  await expect(batumi).toHaveAccessibleName(/ბათუმი.*გახსნა/);
});

test("municipality map and list highlight each other by exact code", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const shape = page.getByTestId("municipality-shape-33");
  const row = page.locator('[data-municipality-row-code="33"]');

  await shape.hover();
  await expect(shape).toHaveAttribute("data-active", "true");
  await expect(row).toHaveAttribute("data-active", "true");

  await page.getByRole("heading", { level: 1 }).hover();
  await row.focus();
  await expect(shape).toHaveAttribute("data-active", "true");
});

test("keyboard focus wins over a simultaneous pointer target", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const focusedShape = page.getByTestId("municipality-shape-33");
  const otherRow = page.locator('[data-municipality-row-code="04"]');
  await focusedShape.focus();
  await otherRow.hover();
  await expect(focusedShape).toHaveAttribute("data-active", "true");
  await expect(otherRow).not.toHaveAttribute("data-active", "true");
});

test("region rows do not activate municipality geometry", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  await page.getByTestId("level-region").click();
  await page.getByTestId("municipal-list-row").first().hover();
  await expect(page.locator('[data-municipality-code][data-active="true"]')).toHaveCount(0);
  await expect(page.getByTestId("municipality-map").locator("[data-municipality-shape]")).toHaveCount(60);
});

test("focus uses the polygon or marker instead of a rectangular outline", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const shape = page.getByTestId("municipality-shape-33");
  await shape.focus();
  const shapeStyle = await shape.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, strokeWidth: Number.parseFloat(style.strokeWidth) };
  });
  expect(shapeStyle.outline).toBe("none");
  expect(shapeStyle.strokeWidth).toBeGreaterThan(1);

  const marker = page.getByTestId("municipality-marker-06");
  await marker.focus();
  const markerStyle = await marker.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, radius: Number.parseFloat(element.getAttribute("r") ?? "0") };
  });
  expect(markerStyle.outline).toBe("none");
  expect(markerStyle.radius).toBeGreaterThan(7.5);
});
```

Retain and adapt the existing narrow-resize tooltip containment test to target the lowest municipality path and `municipality-map-tooltip`.

- [ ] **Step 2: Run the interaction tests and verify they fail**

Run:

```powershell
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts --grep "only name|highlight each other|keyboard focus wins|region rows|rectangular outline|narrow viewport"
```

Expected: FAIL because the tooltip, exact-code list attributes, and new focus CSS are absent.

- [ ] **Step 3: Implement independent pointer/focus target precedence**

Inside `MunicipalityMap`, use one target type for paths and circles:

```ts
type InteractionTarget = {
  key: `shape:${string}` | `marker:${string}`;
  code: string;
  nameKa: string;
  valueGel: number;
  element: SVGGraphicsElement;
};
```

Maintain `pointerTarget`, `focusTarget`, and `tooltipPosition`. Define `activeTarget = focusTarget ?? pointerTarget`; map hover/focus calls `onActiveCodeChange(activeTarget.code)`, while mouse leave and blur restore the still-active other target or `null`.

- [ ] **Step 4: Position and render the anchored tooltip**

Recompute the tooltip on `resize` using the active target's `getBoundingClientRect()`.

Use the existing 200×50 tooltip bounds algorithm, clamped by a 6px edge and 8px gap. Render:

```tsx
<div
  id="municipality-map-tooltip"
  role="tooltip"
  data-testid="municipality-map-tooltip"
  className="pointer-events-none absolute z-[2] h-[50px] w-[200px] overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
  style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
>
  <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-[var(--ink)]">
    <span className="truncate">{activeTarget.nameKa}</span>
    <span aria-hidden>→</span>
  </div>
  <div className="mt-0.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
    {formatAmount(activeTarget.valueGel)}
  </div>
</div>
```

Set each target's accessible name to `${nameKa} · ${formatAmount(valueGel)} · მუნიციპალიტეტის გახსნა` and add `aria-describedby="municipality-map-tooltip"` only to the exact active pointer/focus target.

- [ ] **Step 5: Implement shape-following active styles**

For municipality paths, keep the budget fill and use:

```tsx
stroke={activeCode === shape.code ? "var(--ink)" : "var(--hairline-soft)"}
strokeWidth={activeCode === shape.code ? 1.8 : 0.7}
data-active={activeCode === shape.code ? "true" : undefined}
```

For markers, keep the green fill and use radius `9.5` / stroke width `2.2` when active, otherwise radius `7.5` / stroke width `1.2`. Tbilisi's polygon and marker both become active for code `04`, which correctly represents one municipality through two approved targets.

Add `data-municipality-map-target=""` to interactive paths and circles. Replace the old global rule with:

```css
[data-municipality-map-target]:focus,
[data-municipality-map-target]:focus-visible {
  outline: none;
}
```

Remove the old `[data-focus-map]:focus-visible` block and its map-focus token/comment because the new visible indication is drawn on the geometry itself.

- [ ] **Step 6: Synchronize exact municipality rows and leave region rows inert**

In `MunicipalitiesIndex`, keep map, list-pointer, and list-focus sources separate so keyboard focus wins over a simultaneous pointer target:

```ts
const [mapActiveCode, setMapActiveCode] = useState<string | null>(null);
const [listPointerCode, setListPointerCode] = useState<string | null>(null);
const [listFocusCode, setListFocusCode] = useState<string | null>(null);
const activeMunicipalityCode = listFocusCode ?? mapActiveCode ?? listPointerCode;
```

Pass `activeMunicipalityCode` to the map and use `setMapActiveCode` as its callback. Municipality rows receive:

```tsx
data-municipality-row-code={row.kind === "municipality" ? row.id : undefined}
data-active={row.kind === "municipality" && row.id === activeMunicipalityCode ? "true" : undefined}
onMouseEnter={() => {
  if (row.kind === "municipality") setListPointerCode(row.id);
}}
onMouseLeave={() => {
  if (row.kind === "municipality") setListPointerCode(null);
}}
onFocus={() => {
  if (row.kind === "municipality") setListFocusCode(row.id);
}}
onBlur={() => {
  if (row.kind === "municipality") setListFocusCode(null);
}}
```

Apply `bg-[var(--tint)]` only when that exact municipality row is active. Remove `hoveredRegionId` and all region-derived map highlighting. Switching to Regions must not clear or replace the map model; region rows retain only their existing route activation.

- [ ] **Step 7: Run all municipality browser tests**

Run:

```powershell
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts
```

Expected: PASS, including tooltip containment after resizing from 390px to 340px.

- [ ] **Step 8: Commit the complete interaction model**

```powershell
git add apps/web/components/municipalities/municipality-map.tsx apps/web/components/municipalities/municipalities-index.tsx apps/web/app/globals.css apps/web/tests/browser/municipalities.spec.ts
git commit -m "feat: synchronize municipality map interactions"
```

---

### Task 6: Integrate Validation, Attribution, Cleanup, and Durable Documentation

**Files:**
- Modify: `apps/web/scripts/validate-data-files.ts`
- Modify: `apps/web/components/municipalities/municipalities-index.tsx`
- Modify: `apps/web/app/explorer/municipalities/page.tsx`
- Modify: `apps/web/lib/explorer/colors.ts`
- Modify: `apps/web/tests/browser/municipalities.spec.ts`
- Delete: `apps/web/components/municipalities/region-map.tsx`
- Delete: `apps/web/lib/explorer/municipalGeo.ts`
- Delete: `apps/web/tests/explorer/municipalGeo.test.ts`
- Modify: `DESIGN.md`
- Modify: `AGENTS.md`
- Modify: `docs/data-methodology/municipal-functional-annual-2015-2025.md`

**Interfaces:**
- Consumes: `checkMunicipalityGeometryOutputs()` and `validateMunicipalityGeometrySources()`.
- Produces: standalone `data:validate` coverage, linked OSM attribution, no old region-map code, and durable source-of-truth documentation.

- [ ] **Step 1: Write failing attribution and no-occupied-copy browser assertions**

Add:

```ts
test("credits OpenStreetMap boundaries without occupied-territory copy", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/municipalities");
  await expectMunicipalAppReady(page);
  const source = page.getByTestId("municipal-source-note");
  await expect(source.getByRole("link", { name: /OpenStreetMap contributors/ })).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/copyright",
  );
  await expect(source).toContainText("ODbL");
  await expect(source).not.toContainText(/ოკუპირ|Russian/i);
  await expect(page.getByTestId("municipality-map")).not.toContainText(/მონაცემები არ არის|no data/i);
});
```

- [ ] **Step 2: Run the attribution test and verify it fails**

Run:

```powershell
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts --grep "credits OpenStreetMap"
```

Expected: FAIL because the page still uses the geoBoundaries string and does not link OSM.

- [ ] **Step 3: Add linked OSM attribution without occupied wording**

Keep the existing budget source note string prop, but render the boundary notice as JSX in `MunicipalitiesIndex`:

```tsx
<SourceNote testId="municipal-source-note">
  {props.sourceNote}{" "}
  საზღვრები:{" "}
  <a
    href="https://www.openstreetmap.org/copyright"
    target="_blank"
    rel="noreferrer"
    className="underline decoration-[var(--hairline)] underline-offset-2"
  >
    © OpenStreetMap contributors
  </a>
  , ODbL.
</SourceNote>
```

Remove the old geoBoundaries attribution from the page's string. Keep the official-total/functional-total sentence, region-rollup sentence, and last-reviewed date.

- [ ] **Step 4: Put geometry fixed-point validation in the standalone data gate**

In `validate-data-files.ts`:

- remove the `buildRegionShapes()` import and the ADM1 shape/region validation block;
- import `loadMunicipalityGeometrySources`, `validateMunicipalityGeometrySources`, and `checkMunicipalityGeometryOutputs`;
- after loading the 64 registry rows, load sources, validate them against `Array.from(municipalCodes)`, and await the output check;
- print `Validated municipality map polygons: 60` after success.

The new gate must fail on changed source bytes with stale outputs, missing served codes, unexpected/excluded interactive codes, invalid geometry, stale manifest/output hashes, or a payload above the generator test's cap.

- [ ] **Step 5: Remove only obsolete index-region files and comments**

Delete `region-map.tsx`, `municipalGeo.ts`, and `municipalGeo.test.ts`. Update the comment above `MAP_RAMP` in `colors.ts` to say `Municipality choropleth`. Do not delete or alter `apps/web/lib/landing/georgiaGeo.ts` or `apps/web/scripts/fetch-region-geometry.ts`, because the landing page still uses the shared ADM1/ADM0 geography.

- [ ] **Step 6: Update the canonical visual contract**

In `DESIGN.md` §20, replace “Region-grain map, not municipality-grain” with the 60-polygon/five-marker/64-code static SVG contract, latest-year official-total quantiles, direct municipality routes, list synchronization, overlays without public copy, and linked OSM attribution.

- [ ] **Step 7: Update durable agent context without claiming deployment**

In `AGENTS.md` Current Project State, describe the branch's municipality-grain implementation and point to `docs/superpowers/specs/2026-08-07-municipality-map-upgrade-design.md`; explicitly say production verification follows merge rather than claiming this branch is live.

- [ ] **Step 8: Update municipal methodology and provenance**

In `docs/data-methodology/municipal-functional-annual-2015-2025.md`, replace “Region shape join” with “Municipality geometry join”; document the three raw inputs, generated artifact/manifest, exact counts/exceptions, Zugdidi relation `2016161`, ODbL/public-domain terms, 350 KB cap, and `npm.cmd run data:prepare-municipality-geometry` / `npm.cmd run data:check-municipality-geometry` commands.

In all three documents, preserve the rationale for excluding codes `05`, `42`, `43`, `46`, and `64`; do not describe those codes as interactive map data.

- [ ] **Step 9: Run focused data, unit, and browser checks**

Run:

```powershell
npm.cmd run data:check-municipality-geometry
npm.cmd run data:validate
npm.cmd test -- tests/data/municipalGeometry/source.test.ts tests/data/municipalGeometry/prepareMunicipalGeometry.test.ts tests/explorer/municipalityMapData.test.ts
npm.cmd run test:browser -- tests/browser/municipalities.spec.ts
```

Expected: every command passes, no generated file changes, and no browser assertion finds occupied-area public wording.

- [ ] **Step 10: Commit validation, cleanup, attribution, and docs**

```powershell
git add -A apps/web/components/municipalities apps/web/lib/explorer apps/web/lib/data/municipalGeometry apps/web/scripts apps/web/tests apps/web/app/explorer/municipalities/page.tsx apps/web/app/globals.css DESIGN.md AGENTS.md docs/data-methodology/municipal-functional-annual-2015-2025.md
git commit -m "docs: finalize municipality map contract"
```

---

### Task 7: Full Verification and Visual Approval Evidence

**Files:**
- Verify only; do not commit generated screenshots or create an empty commit.

**Interfaces:**
- Consumes: the complete implementation from Tasks 1–6.
- Produces: clean repository checks, desktop/mobile screenshots for review, and a clean worktree ready for structured code review.

- [ ] **Step 1: Prove generation is a fixed point**

Run from `apps/web`:

```powershell
npm.cmd run data:prepare-municipality-geometry
git diff --exit-code -- ../../data/geometry/municipality-map-paths.json "../../docs/Raw Data/Municipalities/municipality-map-geometry/source-manifest.json"
```

Expected: generation succeeds and `git diff --exit-code` returns 0.

- [ ] **Step 2: Run the required local quality gates separately**

Run:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
```

Expected: all three commands exit successfully. If Playwright prints passing tests but hangs during teardown, record that separately and do not call the command a clean success.

- [ ] **Step 3: Capture desktop and mobile verification screenshots**

Start the local server on port 3100 in the normal managed background process, then run:

```powershell
npm.cmd exec -- playwright screenshot --viewport-size="1440,900" "http://127.0.0.1:3100/explorer/municipalities" "C:\tmp\municipality-map-desktop.png"
npm.cmd exec -- playwright screenshot --viewport-size="390,844" "http://127.0.0.1:3100/explorer/municipalities" "C:\tmp\municipality-map-mobile.png"
```

Compare both screenshots to the approved preview and explicitly inspect:

- corrected Zugdidi size and silhouette;
- municipality boundary continuity and Georgia fit;
- Tbilisi polygon plus all five green markers;
- Abkhazia/Tskhinvali pale overlays with no labels or legend key;
- no rectangular focus box after keyboard focus;
- tooltip name, amount, arrow, and narrow-screen containment;
- Municipality/Regions tab switching without a map-grain change.

- [ ] **Step 4: Run structured review before delivery**

Invoke `superpowers:requesting-code-review` against the merge-base-to-HEAD range, not a moving `origin/main` range. Resolve every correctness, accessibility, source/provenance, or test finding, then rerun the affected focused test and all three required gates.

- [ ] **Step 5: Confirm the branch is clean**

Run from the repository root:

```powershell
git status --short --branch
git log --oneline --decorate origin/main..HEAD
```

Expected: branch `codex/municipality-map-upgrade`, no uncommitted files, and the spec/plan plus implementation commits listed above.

---

### Task 8: Draft PR, CI, Merge, and Separate Production Verification

**Files:**
- Delivery workflow only.

**Interfaces:**
- Consumes: clean reviewed branch and local verification evidence.
- Produces: draft PR, green required CI, reviewed merge, and post-deployment production smoke evidence.

- [ ] **Step 1: Push the feature branch and create a draft PR**

```powershell
git push -u origin codex/municipality-map-upgrade
gh pr create --draft --base main --head codex/municipality-map-upgrade --title "Upgrade municipalities index map" --body "Implements the approved municipality-grain SVG map specification, including deterministic OSM/Natural Earth geometry, all 64 municipality routes, synchronized map/list interaction, accessible shape-following focus, and provenance validation."
```

- [ ] **Step 2: Wait for every required hosted check**

```powershell
gh pr checks --watch
```

Required evidence: lint, typecheck, unit/data validation, build, and hosted Playwright are green. Treat hosted CI and local teardown behavior as separate evidence.

- [ ] **Step 3: Complete PR review and mark ready**

Review the full merge-base-to-head diff, resolve all actionable conversations, rerun checks if code changes, and only then run:

```powershell
gh pr ready
```

- [ ] **Step 4: Merge through the protected workflow**

Merge only after required checks and review are green. Do not push implementation commits directly to `main`. Record the PR number and merge commit returned by GitHub.

- [ ] **Step 5: Verify deployment separately from merge**

After the Actions-owned Vercel production workflow finishes, verify HTTP 200 for:

- `https://geodata-ge.vercel.app/explorer/municipalities`
- `https://geodata-ge.vercel.app/explorer/municipalities/33`
- `https://geodata-ge.vercel.app/explorer/municipalities/06`
- `https://geodata-ge.vercel.app/explorer/municipalities/region/tbilisi`

Then use a production browser check to confirm 60 polygons, five markers, two inert overlays, direct Zugdidi/Batumi navigation, no occupied-area text, and no rectangular focus outline. Only after those checks may the municipality-grain map be described as live.
