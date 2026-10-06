import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationMapModels, type PopulationMapModels } from "../../lib/explorer/demographyPopulationMaps";

let facts: ServedDemographyObservation[];
let regions: MunicipalRegion[];
let municipalities: Municipality[];
let maps: PopulationMapModels;

beforeAll(async () => {
  const [served, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  facts = served.facts;
  regions = municipal.regions;
  municipalities = municipal.municipalities;
  maps = buildPopulationMapModels({ facts, regions, municipalities, densityUnit: "/km²" });
});

describe("population map models", () => {
  test("every map shows the latest loaded year", () => {
    expect(maps.populationYear).toBe(2026);
    expect(maps.densityYear).toBe(2026);
    expect(maps.regionsPopulation.year).toBe(2026);
    expect(maps.regionsDensity.year).toBe(2026);
  });

  test("the region maps draw eleven regions, largest and densest first", () => {
    expect(maps.regionsPopulation.regions).toHaveLength(11);
    expect(maps.regionsPopulation.regions[0]).toMatchObject({ regionId: "region.tbilisi", totalGdpGel: 1_369_356, display: "1,369,356" });
    expect(maps.regionsPopulation.regions.at(-1)).toMatchObject({ regionId: "region.racha_lechkhumi_kvemo_svaneti", totalGdpGel: 29_481 });
    expect(maps.regionsDensity.regions[0]).toMatchObject({ regionId: "region.tbilisi", totalGdpGel: 2715.7, display: "2,715.7 /km²" });
    expect(maps.regionsDensity.regions.at(-1)).toMatchObject({ regionId: "region.racha_lechkhumi_kvemo_svaneti", display: "6.4 /km²" });
  });

  test("the municipality map draws 60 shapes and 5 city markers with Tbilisi as one place", () => {
    expect(maps.municipalitiesPopulation.shapes).toHaveLength(60);
    expect(maps.municipalitiesPopulation.markers).toHaveLength(5);
    expect(maps.municipalitiesPopulation.markers.find((marker) => marker.code === "04")).toMatchObject({ budgetPerResidentGel: 1_369_356, display: "1,369,356" });
    expect(maps.municipalitiesPopulation.shapes.find((shape) => shape.code === "11")).toMatchObject({ budgetPerResidentGel: 16_098, display: "16,098" });
  });

  test("refuses maps whose levels end in different years", () => {
    const older = facts.filter((fact) => !(/^\d{2}$/.test(fact.geographyId) && fact.year === 2026));
    expect(() => buildPopulationMapModels({ facts: older, regions, municipalities, densityUnit: "/km²" }))
      .toThrow(/Regions end in 2026 but municipalities in 2025/);
  });
});
