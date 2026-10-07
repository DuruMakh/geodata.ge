import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import type { Municipality } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationMunicipalityMap } from "../../lib/explorer/demographyPopulationMaps";

let facts: ServedDemographyObservation[];
let municipalities: Municipality[];

beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  municipalities = municipal.municipalities;
});

describe("population municipality map", () => {
  test("shows the latest loaded year with 60 shapes and 5 city markers, Tbilisi once", () => {
    const { year, model, values } = buildPopulationMunicipalityMap({ facts, municipalities });
    expect(year).toBe(2026);
    expect(values.size).toBe(64);
    expect(model.shapes).toHaveLength(60);
    expect(model.markers).toHaveLength(5);
    expect(model.markers.find((marker) => marker.code === "04")).toMatchObject({ budgetPerResidentGel: 1_369_356, display: "1,369,356" });
    expect(model.shapes.find((shape) => shape.code === "11")).toMatchObject({ budgetPerResidentGel: 16_098, display: "16,098" });
  });

  test("follows the newest year the municipalities have", () => {
    const withoutNewest = facts.filter((fact) => !(/^\d{2}$/.test(fact.geographyId) && fact.year === 2026));
    expect(buildPopulationMunicipalityMap({ facts: withoutNewest, municipalities }).year).toBe(2025);
  });

  test("refuses a map with a municipality missing", () => {
    const without = facts.filter((fact) => !(fact.geographyId === "33" && fact.year === 2026));
    expect(() => buildPopulationMunicipalityMap({ facts: without, municipalities })).toThrow(/Missing map value for municipality 33/);
  });
});
