import { EDUCATION_GEORGIA, educationIndicator, type ClientEducationFact, type EducationGroup, type EducationMeasure } from "../data/education/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { placeIdForMunicipalityCode } from "./demographyAreas";
import { placeIndexRows } from "./demographyPopulationIndex";
import { EDUCATION_HUB_PATH, buildEducationSeriesModel, type EducationModel, type EducationSeriesDefinition, type EducationState } from "./education";
import { formatInUnit, UNIT_PERSONS } from "./format";
import type { MunicipalListRow } from "./municipalData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";
import { changeUnitListSelection, parseUnitListHash, unitListCoverage } from "./unitList";

/** The two Education page sets with a map index and a page per place (Georgia, the 11 regions and the 63 other municipalities). */
export type EducationPlaceSet = "schools" | "kindergartens";

/** The base path a set's index and place pages sit under; `placePageHref` adds the place. */
export const educationPlaceBase = (set: EducationPlaceSet): `${typeof EDUCATION_HUB_PATH}/${EducationPlaceSet}` => `${EDUCATION_HUB_PATH}/${set}`;

/** A place's headings and their rows. Georgia's Schools page adds the public and private split Geostat publishes only nationally. */
function placeHeadings(set: EducationPlaceSet, placeId: string): readonly [heading: EducationMeasure, measure: EducationMeasure, groups: readonly EducationGroup[]][] {
  if (set === "kindergartens") return [["kg_children", "kg_children", ["total"]], ["kg_staff", "kg_staff", ["total"]], ["kindergartens", "kindergartens", ["total"]]];
  if (placeId === EDUCATION_GEORGIA) return [
    ["pupils", "pupils_national", ["total", "public", "private"]],
    ["teachers", "teachers", ["total", "public", "private", "women", "men"]],
    ["schools", "schools", ["total", "public", "private"]],
  ];
  return [["pupils", "pupils", ["total"]], ["teachers", "teachers", ["total", "women", "men"]], ["schools", "schools", ["total"]]];
}

/** A place's series under their headings; the first heading's total, the default, is the reference. */
export function educationPlaceSeries(set: EducationPlaceSet, placeId: string): EducationSeriesDefinition[] {
  return placeHeadings(set, placeId).flatMap(([heading, measure, groups], headingIndex) => groups.map(group => ({
    id: educationIndicator(measure, group), reference: headingIndex === 0 && group === "total", heading,
  })));
}

export function educationPlaceDefaultSelection(set: EducationPlaceSet, placeId: string): string[] {
  return [educationPlaceSeries(set, placeId)[0].id];
}

/** The list's one-heading rule: a row's group is its heading. */
const headingOf = (definitions: readonly EducationSeriesDefinition[]) => {
  const headings = new Map(definitions.map(definition => [definition.id, definition.heading]));
  return (id: string) => headings.get(id);
};
const placeFacts = (facts: readonly ClientEducationFact[], placeId: string) => facts.filter(f => f.geographyId === placeId);

/** A place's years for a selection: every year any row of the selection's heading has a value (any of its rows when nothing is selected). */
export function educationPlaceCoverage(set: EducationPlaceSet, placeId: string, facts: readonly ClientEducationFact[], selectedIds: readonly string[] = []) {
  const definitions = educationPlaceSeries(set, placeId);
  return unitListCoverage(definitions, selectedIds, placeFacts(facts, placeId), `No education years for ${placeId}`, headingOf(definitions));
}

/** Reads a place page's hash: a selection that mixes headings keeps only its first row's heading, and the years fit that heading. */
export function parseEducationPlaceHash(hash: string, set: EducationPlaceSet, placeId: string, facts: readonly ClientEducationFact[]): EducationState {
  const definitions = educationPlaceSeries(set, placeId);
  return parseUnitListHash(hash, definitions, educationPlaceDefaultSelection(set, placeId), placeFacts(facts, placeId), headingOf(definitions));
}

/** A place page's new selection: a row under another heading replaces it. The years stay, clamped to the heading's (never collapsed to "all"). */
export function changeEducationPlaceSelection(state: EducationState, set: EducationPlaceSet, placeId: string, next: readonly string[], facts: readonly ClientEducationFact[]): EducationState {
  const definitions = educationPlaceSeries(set, placeId);
  return changeUnitListSelection(state, definitions, next, placeFacts(facts, placeId), headingOf(definitions));
}

export function buildEducationPlaceModel(set: EducationPlaceSet, placeId: string, facts: readonly ClientEducationFact[], state: EducationState): EducationModel {
  return buildEducationSeriesModel(educationPlaceSeries(set, placeId), placeFacts(facts, placeId), placeId, state, educationPlaceCoverage(set, placeId, facts, state.selectedIds));
}

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
