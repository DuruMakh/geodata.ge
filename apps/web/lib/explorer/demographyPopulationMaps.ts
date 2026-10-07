import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { Municipality } from "../data/municipal/types";
import { formatInUnit, UNIT_PERSONS } from "./format";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";

const isMunicipality = (id: string) => /^\d{2}$/.test(id);

/**
 * The municipality map for the latest year the municipalities have a population for. The number goes in the
 * model's existing numeric field and `display` is the text the map prints for each place.
 */
export function buildPopulationMunicipalityMap({
  facts,
  municipalities,
}: {
  facts: readonly ServedDemographyObservation[];
  municipalities: Municipality[];
}): { year: number; model: MunicipalityMapModel; values: ReadonlyMap<string, number> } {
  const rows = facts.filter((fact) => fact.seriesId === SERIES.populationTotal && isMunicipality(fact.geographyId));
  if (rows.length === 0) throw new Error("No population values for the map");
  const year = Math.max(...rows.map((fact) => fact.year));
  const values = new Map(rows.filter((fact) => fact.year === year).map((fact) => [fact.geographyId, fact.value]));
  return {
    year,
    values,
    model: buildMunicipalityValueMapModel({
      municipalities,
      values,
      display: (_code, value) => formatInUnit(value, UNIT_PERSONS),
    }),
  };
}
