import { EDUCATION_GEORGIA, educationIndicator, type ClientEducationFact, type EducationGroup, type EducationMeasure } from "../data/education/types";
import { placeIdForMunicipalityCode } from "./demographyAreas";
import { EDUCATION_HUB_PATH, buildEducationList, buildEducationSeriesModel, serializeEducationHash, type EducationModel, type EducationSeriesDefinition, type EducationState } from "./education";
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

/** The measure that stands for a row's measure at a place that does not list it: Georgia's national pupils and every other place's pupils. */
const COUNTERPART: Partial<Record<string, string>> = { pupils_national: "pupils", pupils: "pupils_national" };

/**
 * This page's selection, moved to another place (a fact-side id, or a municipality code: 04 is Tbilisi). A row the target
 * does not list becomes its counterpart there: Georgia's pupils and the place's pupils swap, and a split Geostat publishes
 * only nationally (public, private) becomes its measure's total. The moved rows keep the target's list order, once each;
 * an empty selection stays empty.
 */
export function educationPlaceMovedSelection(selectedIds: readonly string[], set: EducationPlaceSet, targetPlaceId: string): string[] {
  const listed = educationPlaceSeries(set, placeIdForMunicipalityCode(targetPlaceId)).map(definition => definition.id);
  const moved = new Set(selectedIds.map(id => {
    if (listed.includes(id)) return id;
    const measure = id.split(".")[1]!;
    return `education.${COUNTERPART[measure] ?? measure}.total`;
  }));
  return listed.filter(id => moved.has(id));
}

/** The hash a link to another place's page carries: this page's mode and years, and its selection moved to that place. The target's parse refits the years to its own. */
export function educationPlaceLinkHash(state: EducationState, set: EducationPlaceSet, targetPlaceId: string): string {
  return `#${serializeEducationHash({ ...state, selectedIds: educationPlaceMovedSelection(state.selectedIds, set, targetPlaceId) })}`;
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

/** A place's series list: each row's latest value up to the list's end, with a heading's older year (`buildEducationList`). */
export function educationPlaceList(set: EducationPlaceSet, placeId: string, facts: readonly ClientEducationFact[], state: EducationState) {
  return buildEducationList(educationPlaceSeries(set, placeId), facts, placeId, state, educationPlaceCoverage(set, placeId, facts));
}
