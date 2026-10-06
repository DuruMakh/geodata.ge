import { beforeAll, describe, expect, test } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import type { ServedDemographyObservation } from "../../lib/data/demography/types";
import type { Municipality, MunicipalRegion } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationMapModels, type PopulationMapModels } from "../../lib/explorer/demographyPopulationMaps";
import { formatInUnit, UNIT_DENSITY } from "../../lib/explorer/format";

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

  test("the density map has its own latest year: without the newest density year it shows the one before, and the population map stays", () => {
    // Today both series end in 2026, so "every map shows the latest loaded year" cannot tell densityYear from
    // populationYear. Dropping every density row of the newest density year makes the two differ.
    const isDensity = (fact: ServedDemographyObservation) => fact.seriesId === SERIES.populationDensity;
    const densityYears = facts.filter(isDensity).map((fact) => fact.year);
    const newest = Math.max(...densityYears);
    const previous = Math.max(...densityYears.filter((year) => year < newest));
    const withoutNewest = facts.filter((fact) => !(isDensity(fact) && fact.year === newest));
    const earlier = buildPopulationMapModels({ facts: withoutNewest, regions, municipalities, densityUnit: "/km²" });
    expect(earlier.densityYear).toBe(previous);
    expect(earlier.populationYear).toBe(maps.populationYear);
    expect(earlier.regionsDensity.year).toBe(earlier.densityYear);
    // Tbilisi prints the value of that earlier year, read from the facts.
    const tbilisi = facts.find((fact) => isDensity(fact) && fact.geographyId === "region.tbilisi" && fact.year === previous)!;
    expect(earlier.regionsDensity.regions.find((region) => region.regionId === "region.tbilisi")).toMatchObject({
      totalGdpGel: tbilisi.value,
      display: `${formatInUnit(tbilisi.value, UNIT_DENSITY)} /km²`,
    });
  });

  test("refuses maps whose levels end in different years", () => {
    const older = facts.filter((fact) => !(/^\d{2}$/.test(fact.geographyId) && fact.year === 2026));
    expect(() => buildPopulationMapModels({ facts: older, regions, municipalities, densityUnit: "/km²" }))
      .toThrow(/Regions end in 2026 but municipalities in 2025/);
  });
});
