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
