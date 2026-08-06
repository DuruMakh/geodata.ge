import { describe, expect, it } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildMunicipalListRows } from "../../lib/explorer/municipalData";
import {
  buildMunicipalityMapModel,
  MUNICIPALITY_MAP_ARTIFACT,
  validateMunicipalityMapArtifact,
} from "../../lib/explorer/municipalityMapData";

async function loadMapInput() {
  const { municipalities, regions, totalFacts } = await loadServedMunicipalData();
  const year = Math.max(...totalFacts.map((row) => row.year));
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));
  const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year });
  return { municipalities, municipalityRows: list.municipalities };
}

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

    expect(() => buildMunicipalityMapModel({ municipalities, municipalityRows: rows })).toThrow(/invalid latest-year official total/i);
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

  it("rejects invalid version, count, path, marker, and code contracts", () => {
    const artifact = structuredClone(MUNICIPALITY_MAP_ARTIFACT);

    expect(() => validateMunicipalityMapArtifact({ ...artifact, version: 2 })).toThrow(/version must be 1/i);
    expect(() => validateMunicipalityMapArtifact({ ...artifact, municipalityPaths: artifact.municipalityPaths.slice(1) })).toThrow(/contain 60 paths/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      municipalityPaths: artifact.municipalityPaths.map((shape, index) => index === 0 ? { ...shape, d: "" } : shape),
    })).toThrow(/non-empty path/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      cityMarkers: artifact.cityMarkers.map((marker, index) => index === 0 ? { ...marker, x: Number.NaN } : marker),
    })).toThrow(/finite coordinates/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      cityMarkers: artifact.cityMarkers.map((marker, index) => index === 0 ? { ...marker, code: "99" } : marker),
    })).toThrow(/unexpected marker codes/i);
  });

  it("rejects malformed artifact members and remaining exact contracts", () => {
    const artifact = structuredClone(MUNICIPALITY_MAP_ARTIFACT);

    expect(() => validateMunicipalityMapArtifact({ ...artifact, viewBox: "0 0 1 1" })).toThrow(/viewbox must be 0 0 1000 540/i);
    expect(() => validateMunicipalityMapArtifact({ ...artifact, cityMarkers: artifact.cityMarkers.slice(1) })).toThrow(/contain 5 city markers/i);
    expect(() => validateMunicipalityMapArtifact({ ...artifact, occupiedAreas: artifact.occupiedAreas.slice(1) })).toThrow(/contain 2 occupied areas/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      municipalityPaths: artifact.municipalityPaths.map((shape, index) => index === 1 ? { ...shape, code: artifact.municipalityPaths[0]!.code } : shape),
    })).toThrow(/invalid municipality polygon code/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      municipalityPaths: artifact.municipalityPaths.map((shape, index) => index === 0 ? { ...shape, relationId: Number.NaN } : shape),
    })).toThrow(/finite relation id/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      municipalityPaths: artifact.municipalityPaths.map((shape, index) => index === 1 ? { ...shape, code: "99" } : shape),
    })).toThrow(/unexpected municipality codes/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      cityMarkers: artifact.cityMarkers.map((marker, index) => index === 1 ? { ...marker, code: artifact.cityMarkers[0]!.code } : marker),
    })).toThrow(/invalid municipality marker code/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      occupiedAreas: artifact.occupiedAreas.map((area, index) => index === 0 ? { ...area, d: "" } : area),
    })).toThrow(/occupied area.*non-empty path/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      occupiedAreas: artifact.occupiedAreas.map((area, index) => index === 1 ? { ...area, key: artifact.occupiedAreas[0]!.key } : area),
    })).toThrow(/duplicate occupied area/i);
    expect(() => validateMunicipalityMapArtifact({
      ...artifact,
      occupiedAreas: artifact.occupiedAreas.map((area, index) => index === 0 ? { ...area, key: "other" } : area),
    })).toThrow(/unexpected occupied area keys/i);
  });
});
