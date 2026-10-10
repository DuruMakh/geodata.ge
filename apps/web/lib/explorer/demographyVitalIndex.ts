import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import { MUNICIPAL_COUNTRY_ID, type Municipality, type MunicipalRegion } from "../data/municipal/types";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { ranked } from "./demographyPopulationIndex";
import { birthsPer100Deaths } from "./demographyVital";
import { formatInUnit, UNIT_PERSONS } from "./format";
import type { MunicipalListRow } from "./municipalData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";

export type VitalIndexModel = {
  year: number;
  map: MunicipalityMapModel;
  /** Value = births per 100 deaths (unrounded), ranked highest first. */
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
  country: MunicipalListRow;
  /** Births and deaths of the latest year, by list row id (municipality code, region id, `country.georgia`). */
  countsById: Readonly<Record<string, { births: number; deaths: number }>>;
  /** Municipalities (Tbilisi as 04) whose deaths exceeded births in the latest year. */
  deathsAhead: number;
  municipalityCount: number;
};

const isMunicipality = (id: string) => /^\d{2}$/.test(id);

function countsFor(facts: readonly ServedDemographyObservation[], year: number): Map<string, { births: number; deaths: number }> {
  const counts = new Map<string, { births: number; deaths: number }>();
  for (const fact of facts) {
    if (fact.year !== year || (fact.seriesId !== SERIES.liveBirths && fact.seriesId !== SERIES.deaths)) continue;
    const entry = counts.get(fact.geographyId) ?? { births: Number.NaN, deaths: Number.NaN };
    if (fact.seriesId === SERIES.liveBirths) entry.births = fact.value;
    else entry.deaths = fact.value;
    counts.set(fact.geographyId, entry);
  }
  return counts;
}

/** Municipalities (Tbilisi as 04) whose registered deaths exceeded births in the year; an equal year does not count. */
export function deathsAheadCount(facts: readonly ServedDemographyObservation[], year: number): number {
  return [...countsFor(facts, year)].filter(([id, { births, deaths }]) => isMunicipality(id) && deaths > births).length;
}

/**
 * The national page's places block: the Budget index rows with births per 100 deaths in the money-named `valueGel`, the
 * convention the Population index already uses for persons. The ratio needs no population figure, so the census re-base
 * does not touch it.
 */
export function buildVitalIndexModel({
  facts,
  regions,
  municipalities,
}: {
  facts: readonly ServedDemographyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: Municipality[];
}): VitalIndexModel {
  const municipalYears = facts.filter((fact) => fact.seriesId === SERIES.liveBirths && isMunicipality(fact.geographyId)).map((fact) => fact.year);
  if (municipalYears.length === 0) throw new Error("No municipal births for the index");
  const year = Math.max(...municipalYears);
  const counts = countsFor(facts, year);
  const ratio = (id: string): number => {
    const entry = counts.get(id);
    const value = entry ? birthsPer100Deaths(entry.births, entry.deaths) : null;
    if (value === null || !Number.isFinite(value)) throw new Error(`No ${year} births per 100 deaths for ${id}`);
    return value;
  };
  const values = new Map(municipalities.map((municipality) => [municipality.code, ratio(municipality.code)]));
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
      valueGel: ratio(region.id),
      budgetPerResidentGel: null,
    })),
  );
  const country: MunicipalListRow = {
    id: MUNICIPAL_COUNTRY_ID,
    kind: "country",
    nameKa: "საქართველო",
    subtitleKa: `${municipalities.length} მუნიციპალიტეტი`,
    regionId: null,
    valueGel: ratio(GEORGIA_PLACE_ID),
    budgetPerResidentGel: null,
    rank: null,
  };
  const countsById = Object.fromEntries(
    [...municipalities.map((municipality) => municipality.code), ...regions.map((region) => region.id), GEORGIA_PLACE_ID].map((id) => [id, counts.get(id)!]),
  );
  return {
    year,
    map: buildMunicipalityValueMapModel({ municipalities, values, display: (_code, value) => formatInUnit(value, UNIT_PERSONS) }),
    municipalities: municipalityRows,
    regions: regionRows,
    country,
    countsById,
    deathsAhead: deathsAheadCount(facts, year),
    municipalityCount: municipalities.length,
  };
}
