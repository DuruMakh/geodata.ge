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
  type MunicipalityGeometrySources,
} from "../../../lib/data/municipalGeometry/source";

async function loadFixture(): Promise<{
  sources: MunicipalityGeometrySources;
  servedCodes: string[];
}> {
  const [sources, municipalities] = await Promise.all([
    loadMunicipalityGeometrySources(),
    loadMunicipalitiesFile("../../data/imports/municipalities.csv"),
  ]);
  return {
    sources,
    servedCodes: municipalities.map((row) => row.code).sort(),
  };
}

function mutableCopy(sources: MunicipalityGeometrySources): Record<string, unknown> {
  return structuredClone(sources) as unknown as Record<string, unknown>;
}

function featureAt(source: Record<string, unknown>, collection: string, index: number): Record<string, unknown> {
  const featureCollection = source[collection] as { features: unknown[] };
  return featureCollection.features[index] as Record<string, unknown>;
}

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

  it.each([
    {
      label: "null root",
      mutate: () => null,
      message: "Municipality geometry sources must be a non-null object",
    },
    {
      label: "wrong collection tag",
      mutate: (source: Record<string, unknown>) => {
        (source.municipalities as Record<string, unknown>).type = "Collection";
        return source;
      },
      message: "Municipality source type must be FeatureCollection",
    },
    {
      label: "non-array features",
      mutate: (source: Record<string, unknown>) => {
        (source.municipalities as Record<string, unknown>).features = null;
        return source;
      },
      message: "Municipality source features must be an array",
    },
    {
      label: "null feature",
      mutate: (source: Record<string, unknown>) => {
        ((source.municipalities as { features: unknown[] }).features)[0] = null;
        return source;
      },
      message: "Municipality feature 0 must be a non-null object",
    },
    {
      label: "wrong feature tag",
      mutate: (source: Record<string, unknown>) => {
        featureAt(source, "municipalities", 0).type = "Boundary";
        return source;
      },
      message: "Municipality feature 0 type must be Feature",
    },
  ])("rejects a malformed $label before unsafe member access", async ({ mutate, message }) => {
    const { sources, servedCodes } = await loadFixture();
    const malformed = mutate(mutableCopy(sources));

    expect(() => validateMunicipalityGeometrySources(malformed, servedCodes)).toThrow(message);
  });

  it.each([
    {
      field: "code",
      value: 33,
      message: "Municipality feature 0 code must be a non-empty string",
    },
    {
      field: "nameKa",
      value: "",
      message: "Municipality feature 0 nameKa must be a non-empty string",
    },
    {
      field: "sourceName",
      value: null,
      message: "Municipality feature 0 sourceName must be a non-empty string",
    },
    {
      field: "sourceId",
      value: "relation-2016168",
      message: "Municipality feature 0 sourceId must match osm-relation-{number}",
    },
    {
      field: "source",
      value: "Other",
      message: "Municipality feature 0 source must be OpenStreetMap",
    },
  ])("rejects malformed municipality $field metadata", async ({ field, value, message }) => {
    const { sources, servedCodes } = await loadFixture();
    const malformed = mutableCopy(sources);
    const properties = featureAt(malformed, "municipalities", 0).properties as Record<string, unknown>;
    properties[field] = value;

    expect(() => validateMunicipalityGeometrySources(malformed, servedCodes)).toThrow(message);
  });

  it("rejects an occupied overlay whose approved key and names do not match", async () => {
    const { sources, servedCodes } = await loadFixture();
    const malformed = mutableCopy(sources);
    const properties = featureAt(malformed, "occupiedAreas", 0).properties as Record<string, unknown>;
    properties.nameEn = "Changed name";

    expect(() => validateMunicipalityGeometrySources(malformed, servedCodes)).toThrow(
      "Occupied overlay key abkhazia must match the approved names",
    );
  });

  it("rejects a city marker whose approved record does not match", async () => {
    const { sources, servedCodes } = await loadFixture();
    const malformed = mutableCopy(sources);
    const markers = malformed.cityMarkers as Array<Record<string, unknown>>;
    markers[0].nameEn = "Changed name";

    expect(() => validateMunicipalityGeometrySources(malformed, servedCodes)).toThrow(
      "City marker code 04 must match the approved marker record",
    );
  });

  it.each([
    { coordinate: [181, 42], message: "longitude must be between -180 and 180" },
    { coordinate: [44, -91], message: "latitude must be between -90 and 90" },
  ])("rejects out-of-range polygon coordinate $coordinate", async ({ coordinate, message }) => {
    const { sources, servedCodes } = await loadFixture();
    const malformed = mutableCopy(sources);
    const geometry = featureAt(malformed, "municipalities", 0).geometry as {
      coordinates: number[][][];
    };
    geometry.coordinates[0][0] = coordinate;

    expect(() => validateMunicipalityGeometrySources(malformed, servedCodes)).toThrow(message);
  });

  it("rejects an out-of-range city marker coordinate", async () => {
    const { sources, servedCodes } = await loadFixture();
    const malformed = mutableCopy(sources);
    const markers = malformed.cityMarkers as Array<Record<string, unknown>>;
    markers[0].lon = 181;

    expect(() => validateMunicipalityGeometrySources(malformed, servedCodes)).toThrow(
      "City marker code 04 longitude must be between -180 and 180",
    );
  });
});
