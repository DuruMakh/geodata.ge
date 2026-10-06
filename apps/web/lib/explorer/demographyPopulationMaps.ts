import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { formatInUnit, UNIT_DENSITY, UNIT_PERSONS } from "./format";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";
import { buildRegionValueMapModel, type RegionalEconomyMapModel } from "./regionalEconomyMap";

export type PopulationMapModels = {
  populationYear: number;
  densityYear: number;
  regionsPopulation: RegionalEconomyMapModel;
  regionsDensity: RegionalEconomyMapModel;
  municipalitiesPopulation: MunicipalityMapModel;
};

const isRegion = (id: string) => id.startsWith("region.");
const isMunicipality = (id: string) => /^\d{2}$/.test(id);

/** The values of one series for the places a map draws, in the latest year the series has them for those places. */
function latestValues(
  facts: readonly ServedDemographyObservation[],
  seriesId: string,
  isPlace: (id: string) => boolean,
) {
  const rows = facts.filter((fact) => fact.seriesId === seriesId && isPlace(fact.geographyId));
  if (rows.length === 0) throw new Error(`No ${seriesId} values for the map`);
  const year = Math.max(...rows.map((fact) => fact.year));
  return {
    year,
    values: new Map(rows.filter((fact) => fact.year === year).map((fact) => [fact.geographyId, fact.value])),
  };
}

export function buildPopulationMapModels({
  facts,
  regions,
  municipalities,
  densityUnit,
}: {
  facts: readonly ServedDemographyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: Municipality[];
  densityUnit: string;
}): PopulationMapModels {
  const regionPopulation = latestValues(facts, SERIES.populationTotal, isRegion);
  const municipalityPopulation = latestValues(facts, SERIES.populationTotal, isMunicipality);
  const regionDensity = latestValues(facts, SERIES.populationDensity, isRegion);
  if (municipalityPopulation.year !== regionPopulation.year) {
    throw new Error(`Regions end in ${regionPopulation.year} but municipalities in ${municipalityPopulation.year}`);
  }
  const persons = (_id: string, value: number) => formatInUnit(value, UNIT_PERSONS);
  const density = (_id: string, value: number) => `${formatInUnit(value, UNIT_DENSITY)} ${densityUnit}`;
  return {
    populationYear: regionPopulation.year,
    densityYear: regionDensity.year,
    regionsPopulation: buildRegionValueMapModel({
      values: regionPopulation.values,
      regions,
      year: regionPopulation.year,
      display: persons,
    }),
    regionsDensity: buildRegionValueMapModel({
      values: regionDensity.values,
      regions,
      year: regionDensity.year,
      display: density,
    }),
    municipalitiesPopulation: buildMunicipalityValueMapModel({
      municipalities,
      values: municipalityPopulation.values,
      display: persons,
    }),
  };
}
