import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  GENERATED_ARTIFACT_PATH,
  GENERATED_MANIFEST_PATH,
  GENERATED_SVG_ASSET_PATH,
  buildMunicipalityGeometryOutputs,
  checkMunicipalityGeometryOutputs,
} from "../../../lib/data/municipalGeometry/prepareMunicipalGeometry";

function svgPathDataById(svg: string): Map<string, string> {
  return new Map(
    [...svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)].map(([, id, d]) => [id!, d!]),
  );
}

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

  it("emits an exact static SVG definition asset for every reviewed map path", async () => {
    const { artifact } = await buildMunicipalityGeometryOutputs();

    expect(existsSync(GENERATED_SVG_ASSET_PATH)).toBe(true);
    if (!existsSync(GENERATED_SVG_ASSET_PATH)) return;

    const asset = await readFile(GENERATED_SVG_ASSET_PATH, "utf8");
    const pathDataById = svgPathDataById(asset);
    expect([...pathDataById.entries()]).toEqual([
      ...artifact.municipalityPaths.map((shape) => [`municipality-shape-${shape.code}`, shape.d]),
      ...artifact.occupiedAreas.map((area) => [`occupied-overlay-${area.key}`, area.d]),
    ]);
    expect(asset).toContain('vector-effect="non-scaling-stroke"');
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
