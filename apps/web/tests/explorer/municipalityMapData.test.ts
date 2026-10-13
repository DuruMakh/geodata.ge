import { describe, expect, it } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildMunicipalListRows } from "../../lib/explorer/municipalData";
import {
  buildMunicipalityMapModel,
  MUNICIPALITY_MAP_ARTIFACT,
  validateMunicipalityMapArtifact,
} from "../../lib/explorer/municipalityMapData";

async function loadMapInput() {
  const { municipalities, regions, totalFacts, populationFacts } = await loadServedMunicipalData();
  const year = Math.max(...totalFacts.map((row) => row.year));
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
  const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, populationFacts, year });
  return { municipalities, municipalityRows: list.municipalities };
}

describe("municipality map server composition", () => {
  it("joins every polygon and marker to a registered latest-year official total", async () => {
    const { municipalities, regions, totalFacts, populationFacts } = await loadServedMunicipalData();
    const year = Math.max(...totalFacts.map((row) => row.year));
    const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
    const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, populationFacts, year });
    const model = buildMunicipalityMapModel({ municipalities, municipalityRows: list.municipalities });

    expect(model.viewBox).toBe("0 0 1000 540");
    expect(model.shapes).toHaveLength(60);
    expect(model.markers).toHaveLength(5);
    expect(model.occupiedAreas).toHaveLength(2);
    expect(model.shapes.every((shape) => shape.budgetPerResidentGel > 0 && shape.totalBudgetGel > 0 && shape.bucket >= 0 && shape.bucket <= 5)).toBe(true);
    expect(model.markers.every((marker) => marker.budgetPerResidentGel > 0 && marker.totalBudgetGel > 0)).toBe(true);
    expect(model.legendMinPerResidentGel).toBe(Math.min(...model.shapes.map((shape) => shape.budgetPerResidentGel)));
    expect(model.legendMaxPerResidentGel).toBe(Math.max(...model.shapes.map((shape) => shape.budgetPerResidentGel)));
    expect(new Set([...model.shapes.map((shape) => shape.code), ...model.markers.map((marker) => marker.code)]).size).toBe(64);
  });

  it("rejects a missing latest-year municipality value", async () => {
    const { municipalities, regions, totalFacts, populationFacts } = await loadServedMunicipalData();
    const year = Math.max(...totalFacts.map((row) => row.year));
    const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
    const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, populationFacts, year });
    const withoutZugdidi = list.municipalities.filter((row) => row.id !== "33");

    expect(() => buildMunicipalityMapModel({ municipalities, municipalityRows: withoutZugdidi })).toThrow(
      /missing latest-year official total.*33/i,
    );
  });

  it("assigns color buckets from budget per resident, not total budget", async () => {
    const { municipalities, municipalityRows } = await loadMapInput();
    const rows = municipalityRows.map((row) => ({
      ...row,
      valueGel: row.id === "04" ? 1 : row.id === "33" ? 100_000 : 1_000,
      budgetPerResidentGel: row.id === "04" ? 100_000 : row.id === "33" ? 1 : 1_000,
    }));
    const model = buildMunicipalityMapModel({ municipalities, municipalityRows: rows });

    expect(model.shapes.find((shape) => shape.code === "04")?.bucket).toBe(5);
    expect(model.shapes.find((shape) => shape.code === "33")?.bucket).toBe(0);
  });

  it("keeps the generated artifact's Tbilisi duplicate and Zugdidi relation", () => {
    expect(MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.find((shape) => shape.code === "33")?.relationId).toBe(2016161);
    expect(MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.some((shape) => shape.code === "04")).toBe(true);
    expect(MUNICIPALITY_MAP_ARTIFACT.cityMarkers.some((marker) => marker.code === "04")).toBe(true);
  });

  it("rejects a non-municipality list row", async () => {
    const { municipalities, municipalityRows } = await loadMapInput();
    const rows = municipalityRows.map((row, index) => index === 0 ? { ...row, kind: "region" as const } : row);

    expect(() => buildMunicipalityMapModel({ municipalities, municipalityRows: rows })).toThrow(/expected municipality row/i);
  });

  it("rejects duplicate municipality list rows", async () => {
    const { municipalities, municipalityRows } = await loadMapInput();

    expect(() => buildMunicipalityMapModel({ municipalities, municipalityRows: [...municipalityRows, { ...municipalityRows[0]! }] })).toThrow(
      /duplicate municipality row code/i,
    );
  });

  it("rejects an unknown municipality list row", async () => {
    const { municipalities, municipalityRows } = await loadMapInput();
    const rows = [...municipalityRows, { ...municipalityRows[0]!, id: "99" }];

    expect(() => buildMunicipalityMapModel({ municipalities, municipalityRows: rows })).toThrow(/unknown municipality row code 99/i);
  });

  it("rejects a non-finite municipality total", async () => {
    const { municipalities, municipalityRows } = await loadMapInput();
    const rows = municipalityRows.map((row, index) => index === 0 ? { ...row, valueGel: Number.NaN } : row);

    expect(() => buildMunicipalityMapModel({ municipalities, municipalityRows: rows })).toThrow(/invalid total budget/i);
  });

  it("rejects a non-finite municipality budget per resident", async () => {
    const { municipalities, municipalityRows } = await loadMapInput();
    const rows = municipalityRows.map((row, index) => index === 0 ? { ...row, budgetPerResidentGel: Number.NaN } : row);

    expect(() => buildMunicipalityMapModel({ municipalities, municipalityRows: rows })).toThrow(/invalid budget per resident/i);
  });

  it("rejects duplicate municipality registry codes", async () => {
    const { municipalities, municipalityRows } = await loadMapInput();

    expect(() => buildMunicipalityMapModel({ municipalities: [...municipalities, { ...municipalities[0]! }], municipalityRows })).toThrow(
      /duplicate municipality registry code/i,
    );
  });

  it("rejects a municipality registry code without geometry", async () => {
    const { municipalities, municipalityRows } = await loadMapInput();
    const registry = [...municipalities, { ...municipalities[0]!, code: "99" }];

    expect(() => buildMunicipalityMapModel({ municipalities: registry, municipalityRows })).toThrow(/registry code 99 has no map geometry/i);
  });

  it("rejects a finite but incorrect Zugdidi relation", () => {
    const artifact = {
      ...MUNICIPALITY_MAP_ARTIFACT,
      municipalityPaths: MUNICIPALITY_MAP_ARTIFACT.municipalityPaths.map((shape) =>
        shape.code === "33" ? { ...shape, relationId: 2016160 } : shape,
      ),
    };

    expect(() => validateMunicipalityMapArtifact(artifact)).toThrow(/polygon 33 must use relation 2016161/i);
  });

  it("rejects occupied-area metadata that is not part of the model", () => {
    const artifact = {
      ...MUNICIPALITY_MAP_ARTIFACT,
      occupiedAreas: MUNICIPALITY_MAP_ARTIFACT.occupiedAreas.map((area, index) =>
        index === 0 ? { ...area, onClick: "unexpected" } : area,
      ),
    };

    expect(() => validateMunicipalityMapArtifact(artifact)).toThrow(/unexpected fields.*occupied area/i);
  });

  type Artifact = typeof MUNICIPALITY_MAP_ARTIFACT;
  const polygon = (index: number, change: Record<string, unknown>) => (artifact: Artifact) => ({
    ...artifact,
    municipalityPaths: artifact.municipalityPaths.map((shape, at) => at === index ? { ...shape, ...change } : shape),
  });
  const marker = (index: number, change: Record<string, unknown>) => (artifact: Artifact) => ({
    ...artifact,
    cityMarkers: artifact.cityMarkers.map((entry, at) => at === index ? { ...entry, ...change } : entry),
  });
  const area = (index: number, change: Record<string, unknown>) => (artifact: Artifact) => ({
    ...artifact,
    occupiedAreas: artifact.occupiedAreas.map((entry, at) => at === index ? { ...entry, ...change } : entry),
  });
  const replaceFirst = (key: "municipalityPaths" | "cityMarkers" | "occupiedAreas", member: unknown) => (artifact: Artifact) => ({
    ...artifact,
    [key]: [member, ...artifact[key].slice(1)],
  });

  // Every invalid artifact is its own case, so a failure names the contract it broke.
  it.each<[string, (artifact: Artifact) => unknown, RegExp]>([
    // Null and non-object nested geometry members, reported in context.
    ["null polygon", replaceFirst("municipalityPaths", null), /municipality polygon at index 0 must be an object/i],
    ["null marker", replaceFirst("cityMarkers", null), /municipality marker at index 0 must be an object/i],
    ["null occupied area", replaceFirst("occupiedAreas", null), /occupied area at index 0 must be an object/i],
    ["numeric polygon", replaceFirst("municipalityPaths", 42), /municipality polygon at index 0 must be an object/i],
    ["numeric marker", replaceFirst("cityMarkers", 42), /municipality marker at index 0 must be an object/i],
    ["numeric occupied area", replaceFirst("occupiedAreas", 42), /occupied area at index 0 must be an object/i],
    // Non-string and empty nested SVG paths.
    ["numeric polygon path", polygon(0, { d: 42 }), /municipality polygon 04 must have a non-empty string path/i],
    ["object polygon path", polygon(0, { d: {} }), /municipality polygon 04 must have a non-empty string path/i],
    ["empty polygon path", polygon(0, { d: "" }), /municipality polygon 04 must have a non-empty string path/i],
    ["numeric occupied-area path", area(0, { d: 42 }), /occupied area abkhazia must have a non-empty string path/i],
    ["object occupied-area path", area(0, { d: {} }), /occupied area abkhazia must have a non-empty string path/i],
    ["empty occupied-area path", area(0, { d: "" }), /occupied area abkhazia must have a non-empty string path/i],
    // Invalid nested field types, reported in context.
    ["numeric polygon code", polygon(0, { code: 36 }), /municipality polygon at index 0 must have a non-empty string code/i],
    ["string polygon relation id", polygon(0, { relationId: "2016168" }), /municipality polygon 04 must have a finite numeric relation id/i],
    ["numeric marker code", marker(0, { code: 4 }), /municipality marker at index 0 must have a non-empty string code/i],
    ["string marker coordinate", marker(0, { x: "1" }), /municipality marker 04 must have finite numeric coordinates/i],
    ["numeric occupied-area key", area(0, { key: 1 }), /occupied area at index 0 must have a non-empty string key/i],
    // Version, count, path, marker and code contracts.
    ["version 2", (artifact) => ({ ...artifact, version: 2 }), /version must be 1/i],
    ["59 polygons", (artifact) => ({ ...artifact, municipalityPaths: artifact.municipalityPaths.slice(1) }), /contain 60 paths/i],
    ["empty polygon path (contract)", polygon(0, { d: "" }), /non-empty string path/i],
    ["NaN marker coordinate", marker(0, { x: Number.NaN }), /finite numeric coordinates/i],
    ["unexpected marker code", marker(0, { code: "99" }), /unexpected marker codes/i],
    // Malformed artifact members and the remaining exact contracts.
    ["wrong viewBox", (artifact) => ({ ...artifact, viewBox: "0 0 1 1" }), /viewbox must be 0 0 1000 540/i],
    ["4 city markers", (artifact) => ({ ...artifact, cityMarkers: artifact.cityMarkers.slice(1) }), /contain 5 city markers/i],
    ["1 occupied area", (artifact) => ({ ...artifact, occupiedAreas: artifact.occupiedAreas.slice(1) }), /contain 2 occupied areas/i],
    ["duplicate polygon code", (artifact) => polygon(1, { code: artifact.municipalityPaths[0]!.code })(artifact), /invalid municipality polygon code/i],
    ["NaN polygon relation id", polygon(0, { relationId: Number.NaN }), /finite numeric relation id/i],
    ["unexpected polygon code", polygon(1, { code: "99" }), /unexpected municipality codes/i],
    ["duplicate marker code", (artifact) => marker(1, { code: artifact.cityMarkers[0]!.code })(artifact), /invalid municipality marker code/i],
    ["empty occupied-area path (contract)", area(0, { d: "" }), /occupied area.*non-empty string path/i],
    ["duplicate occupied-area key", (artifact) => area(1, { key: artifact.occupiedAreas[0]!.key })(artifact), /duplicate occupied area/i],
    ["unexpected occupied-area key", area(0, { key: "other" }), /unexpected occupied area keys/i],
  ])("rejects an invalid artifact: %s", (_name, mutate, message) => {
    const artifact = structuredClone(MUNICIPALITY_MAP_ARTIFACT);
    expect(() => validateMunicipalityMapArtifact(mutate(artifact))).toThrow(message);
  });
});
