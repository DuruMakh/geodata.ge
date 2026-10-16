import { EDUCATION_GEORGIA, educationIndicator, type ClientEducationFact } from "../data/education/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { placeIdForMunicipalityCode } from "./demographyAreas";
import { placeIndexRows } from "./demographyPopulationIndex";
import type { EducationPlaceSet } from "./educationPlaces";
import { formatInUnit, UNIT_PERSONS } from "./format";
import type { MunicipalListRow } from "./municipalData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";

// The index's map reads the boundary file from disk, so this module stays on the server: the place pages' client
// code (educationPlaces.ts) must not import it, as the Population index (demographyPopulationIndex.ts) is kept apart.

/**
 * What an index lists and draws, as on the Population index: the rows are the Budget index's `MunicipalListRow`, whose
 * money-named `valueGel` carries persons here.
 */
export type EducationIndexModel = {
  /** The latest school year the municipalities have a value for; the map and the rows use it. */
  year: number;
  map: MunicipalityMapModel;
  /** The 64 registry municipalities ranked highest first; Tbilisi is code `04`, with its region's value. */
  municipalities: MunicipalListRow[];
  /** The 11 regions ranked highest first. */
  regions: MunicipalListRow[];
  country: MunicipalListRow;
};

/** The index's measure: pupils (Georgia's from the national table) or kindergarten children. */
const INDEX_MEASURE: Record<EducationPlaceSet, { place: string; country: string }> = {
  schools: { place: educationIndicator("pupils", "total"), country: educationIndicator("pupils_national", "total") },
  kindergartens: { place: educationIndicator("kg_children", "total"), country: educationIndicator("kg_children", "total") },
};

export function buildEducationIndexModel(set: EducationPlaceSet, facts: readonly ClientEducationFact[], regions: readonly MunicipalRegion[], municipalities: Municipality[]): EducationIndexModel {
  const measure = INDEX_MEASURE[set];
  const rows = facts.filter(f => f.indicatorId === measure.place && /^\d{2}$/.test(f.geographyId));
  if (!rows.length) throw new Error(`No ${set} municipal values for the index`);
  const year = Math.max(...rows.map(f => f.year));
  const values = new Map(facts.filter(f => f.year === year && f.indicatorId === (f.geographyId === EDUCATION_GEORGIA ? measure.country : measure.place)).map(f => [f.geographyId, f.value]));
  // The facts name Tbilisi `region.tbilisi`; the registry, the map and the municipal list name it 04.
  const valueOf = (id: string): number => {
    const value = values.get(placeIdForMunicipalityCode(id));
    if (value === undefined) throw new Error(`No ${year} ${set} value for ${id}`);
    return value;
  };
  return {
    year,
    map: buildMunicipalityValueMapModel({ municipalities, values: new Map(municipalities.map(m => [m.code, valueOf(m.code)])), display: (_code, value) => formatInUnit(value, UNIT_PERSONS) }),
    ...placeIndexRows({ regions, municipalities, valueOf }),
  };
}
