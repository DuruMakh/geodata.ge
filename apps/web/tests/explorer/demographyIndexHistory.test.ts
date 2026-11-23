import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildMarriageIndexModel, type MarriageIndexModel } from "../../lib/explorer/demographyMarriageIndex";
import { buildPopulationIndexModel, type PopulationIndexModel } from "../../lib/explorer/demographyPopulationIndex";
import { buildVitalIndexModel, type VitalIndexModel } from "../../lib/explorer/demographyVitalIndex";

let population: PopulationIndexModel;
let vital: VitalIndexModel;
let marriages: MarriageIndexModel;
beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  const input = { facts, regions: municipal.regions, municipalities: municipal.municipalities };
  population = buildPopulationIndexModel(input);
  vital = buildVitalIndexModel(input);
  marriages = buildMarriageIndexModel(input);
});

describe("demography index histories", () => {
  it("Population: every 1 January for every place", () => {
    expect(population.history.figures.map((figure) => figure.id)).toEqual(["population"]);
    expect(population.history.years.at(-1)).toBe(2026);
    expect(population.history.figures[0]!.valueAt("11", 2014)).toBeNull();
    expect(population.history.figures[0]!.valueAt("11", 2015)).toBe(23976);
    expect(population.history.figures[0]!.valueAt("11", 2026)).toBe(16098);
  });

  it("Births and deaths: both counts and the ratio the map shows", () => {
    expect(vital.history.figures.map((figure) => figure.id)).toEqual(["births", "deaths", "birthsPer100Deaths"]);
    const [births, deaths, ratio] = vital.history.figures;
    expect(vital.history.years.at(-1)).toBe(2025);
    expect(births!.valueAt("11", 2015)).toBe(456);
    expect(deaths!.valueAt("11", 2015)).toBe(248);
    expect(ratio!.valueAt("country.georgia", vital.year)).toBe(vital.country.valueGel);
  });

  it("Marriages and divorces: the counts only, from 2009", () => {
    expect(marriages.history.figures.map((figure) => figure.id)).toEqual(["marriages", "divorces"]);
    expect(marriages.history.years).toContain(2009);
    expect(marriages.history.figures[0]!.valueAt("11", 2008)).toBeNull();
    expect(marriages.history.figures[0]!.valueAt("11", 2009)).toBe(276);
    expect(marriages.history.figures[1]!.valueAt("11", 2009)).toBe(7);
  });
});
