import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { perThousand } from "./demographyMarriage";
import { placeIndexRows } from "./demographyPopulationIndex";
import { formatInUnit, UNIT_DENSITY } from "./format";
import type { MunicipalListRow } from "./municipalData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";

// Server-only: the map reads its shapes from disk, so the browser's marriage module stays apart (as demographyVitalIndex).
export type MarriageIndexModel = {
  year: number;
  map: MunicipalityMapModel;
  /** Value = marriages per 1,000 residents (unrounded), ranked highest first. */
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
  country: MunicipalListRow;
  /** Marriages and divorces of the latest year, by list row id (municipality code, region id, `country.georgia`). */
  countsById: Readonly<Record<string, { marriages: number; divorces: number }>>;
};

const isMunicipality = (id: string) => /^\d{2}$/.test(id);

/** The page's places block: the Budget index rows with marriages per 1,000 residents in the money-named `valueGel`, as the other Population indexes. */
export function buildMarriageIndexModel({
  facts,
  regions,
  municipalities,
}: {
  facts: readonly ServedDemographyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: Municipality[];
}): MarriageIndexModel {
  const municipalYears = facts.filter((fact) => fact.seriesId === SERIES.marriages && isMunicipality(fact.geographyId)).map((fact) => fact.year);
  if (municipalYears.length === 0) throw new Error("No municipal marriages for the index");
  const year = Math.max(...municipalYears);
  const valueOf = (seriesId: string, id: string): number => {
    const fact = facts.find((candidate) => candidate.seriesId === seriesId && candidate.geographyId === id && candidate.year === year);
    if (!fact) throw new Error(`No ${year} ${seriesId} for ${id}`);
    return fact.value;
  };
  const rate = (id: string) => perThousand(valueOf(SERIES.marriages, id), valueOf(SERIES.midYearPopulation, id));
  const values = new Map(municipalities.map((municipality) => [municipality.code, rate(municipality.code)]));
  const { municipalities: municipalityRows, regions: regionRows, country } = placeIndexRows({ regions, municipalities, valueOf: rate });
  const countsById = Object.fromEntries(
    [...municipalities.map((municipality) => municipality.code), ...regions.map((region) => region.id), GEORGIA_PLACE_ID].map((id) => [
      id,
      { marriages: valueOf(SERIES.marriages, id), divorces: valueOf(SERIES.divorces, id) },
    ]),
  );
  return {
    year,
    map: buildMunicipalityValueMapModel({ municipalities, values, display: (_code, value) => formatInUnit(value, UNIT_DENSITY) }),
    municipalities: municipalityRows,
    regions: regionRows,
    country,
    countsById,
  };
}
