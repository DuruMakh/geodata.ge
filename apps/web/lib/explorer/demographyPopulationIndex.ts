import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import { MUNICIPAL_COUNTRY_ID, type Municipality, type MunicipalRegion } from "../data/municipal/types";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { buildPopulationMunicipalityMap } from "./demographyPopulationMaps";
import type { MunicipalListRow } from "./municipalData";
import type { MunicipalityMapModel } from "./municipalityMapData";

/**
 * What the index lists and draws. The rows are the Budget index's `MunicipalListRow`: its money-named
 * `valueGel` carries persons here, the convention `buildMunicipalityValueMapModel` already uses for the map.
 */
export type PopulationIndexModel = {
  /** The latest year the municipalities have a population for; the map, the rows and the key figures use it. */
  year: number;
  map: MunicipalityMapModel;
  /** The 64 municipalities ranked by persons; Tbilisi is code `04`. */
  municipalities: MunicipalListRow[];
  /** The 11 regions ranked by persons. */
  regions: MunicipalListRow[];
  country: MunicipalListRow;
  /** Persons per km² in the latest density year, for Georgia and the regions only. */
  densityByPlace: Readonly<Record<string, number>>;
  densityYear: number;
};

const ranked = (rows: Array<Omit<MunicipalListRow, "rank">>): MunicipalListRow[] =>
  rows
    .slice()
    .sort((left, right) => right.valueGel - left.valueGel)
    .map((row, index) => ({ ...row, rank: index + 1 }));

export function buildPopulationIndexModel({
  facts,
  regions,
  municipalities,
}: {
  facts: readonly ServedDemographyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: Municipality[];
}): PopulationIndexModel {
  const { year, model: map, values } = buildPopulationMunicipalityMap({ facts, municipalities });
  const population = (id: string): number => {
    const fact = facts.find(
      (candidate) => candidate.seriesId === SERIES.populationTotal && candidate.geographyId === id && candidate.year === year,
    );
    if (!fact) throw new Error(`No ${year} population for ${id}`);
    return fact.value;
  };
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));

  const municipalityRows = ranked(
    municipalities.map((municipality) => ({
      id: municipality.code,
      kind: "municipality" as const,
      nameKa: municipality.displayNameKa,
      subtitleKa: regionLabels.get(municipality.regionId) ?? "",
      regionId: municipality.regionId,
      valueGel: values.get(municipality.code)!,
      budgetPerResidentGel: null,
    })),
  );
  const regionRows = ranked(
    regions.map((region) => ({
      id: region.id,
      kind: "region" as const,
      nameKa: region.kaLabel,
      subtitleKa: `${municipalities.filter((municipality) => municipality.regionId === region.id).length} მუნიციპალიტეტი`,
      regionId: region.id,
      valueGel: population(region.id),
      budgetPerResidentGel: null,
    })),
  );
  const country: MunicipalListRow = {
    id: MUNICIPAL_COUNTRY_ID,
    kind: "country",
    nameKa: "საქართველო",
    subtitleKa: `${municipalities.length} მუნიციპალიტეტი`,
    regionId: null,
    valueGel: population(GEORGIA_PLACE_ID),
    budgetPerResidentGel: null,
    rank: null,
  };

  const density = facts.filter((fact) => fact.seriesId === SERIES.populationDensity);
  if (density.length === 0) throw new Error("No density values for the index");
  const densityYear = Math.max(...density.map((fact) => fact.year));
  // The list prints a region's density under its persons and the key figures print the densest region of the same year, so the two
  // years must be one: a density that lagged would show an older year's figure with no word about it.
  if (densityYear !== year) throw new Error(`The latest density year ${densityYear} is not the latest population year ${year}`);
  const densityByPlace = Object.fromEntries(
    density.filter((fact) => fact.year === densityYear).map((fact) => [fact.geographyId, fact.value]),
  );

  return { year, map, municipalities: municipalityRows, regions: regionRows, country, densityByPlace, densityYear };
}
