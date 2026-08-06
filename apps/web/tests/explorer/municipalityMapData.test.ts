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
