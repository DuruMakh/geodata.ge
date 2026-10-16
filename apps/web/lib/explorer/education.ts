import {
  EDUCATION_GEORGIA, EDUCATION_HE_GROUPS, EDUCATION_VET_FIELDS, educationFactKey, educationIndicator,
  type ClientEducationFact, type EducationGroup, type EducationMeasure,
} from "../data/education/types";
import { INK } from "./colors";
import { refitRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicSeriesColor, type TopicCoverage, type TopicSeriesModel, type TopicState } from "./topicSeries";

export const EDUCATION_HUB_PATH = "/explorer/education";
export const EDUCATION_SECTIONS = [
  { id: "schools", href: `${EDUCATION_HUB_PATH}/schools`, labelKey: "common.educationSchools" },
  { id: "kindergartens", href: `${EDUCATION_HUB_PATH}/kindergartens`, labelKey: "common.educationKindergartens" },
  { id: "universities", href: `${EDUCATION_HUB_PATH}/universities`, labelKey: "common.educationUniversities" },
  { id: "vocational", href: `${EDUCATION_HUB_PATH}/vocational`, labelKey: "common.educationVocational" },
] as const;
export type EducationSectionId = typeof EDUCATION_SECTIONS[number]["id"];
/** The two pages with a chart of national series; Schools and Kindergartens are map indexes of place pages (educationPlaces.ts). */
export type EducationTopicId = "universities" | "vocational";

/** A school year is stored as its start year: 2025 reads `2025/26`, 1999 `1999/00`. */
export function schoolYearLabel(year: number): string {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

/** A section's year label: vocational colleges count calendar years, every other section school years. */
export function educationPeriodLabel(section: EducationSectionId): (year: number) => string {
  return section === "vocational" ? String : schoolYearLabel;
}

/** `heading` is the measure a row is listed under; a list shows every row under its heading. */
export type EducationSeriesDefinition = { id: string; reference: boolean; heading: EducationMeasure };

const TOPIC_MEASURES: Record<EducationTopicId, readonly EducationMeasure[]> = {
  universities: ["he_students", "he_admitted", "he_graduates"],
  vocational: ["vet_admitted", "vet_graduates"],
};
/** The rows under each heading: Geostat's 16 higher-education groups; vocational sex and the 9 current fields (never the old ones). */
const TOPIC_GROUPS: Record<EducationTopicId, readonly EducationGroup[]> = {
  universities: EDUCATION_HE_GROUPS,
  vocational: ["total", "women", "men", ...EDUCATION_VET_FIELDS],
};

/** The series a topic page lists, heading by heading; the first heading's total is the reference. */
export function educationTopicSeries(section: EducationTopicId): EducationSeriesDefinition[] {
  return TOPIC_MEASURES[section].flatMap((measure, measureIndex) => TOPIC_GROUPS[section].map(group => ({
    id: educationIndicator(measure, group), reference: measureIndex === 0 && group === "total", heading: measure,
  })));
}

export function educationDefaultSelection(section: EducationTopicId): string[] {
  return [educationTopicSeries(section)[0].id];
}

/** Measures charted one heading at a time (the place pages), so each heading's total is that chart's only total. */
const PLACE_MEASURES: ReadonlySet<EducationMeasure> = new Set(["schools", "teachers", "pupils", "kindergartens", "kg_children", "kg_staff"]);

/**
 * The reference is ink, and so is a place page's heading total, which never shares a chart with another heading. Every other
 * row (the topic pages' other totals included, which can share a chart with the reference) wears its palette colour.
 */
export function educationSeriesColor(series: EducationSeriesDefinition, index: number): string {
  if (series.reference || (series.id.endsWith(".total") && PLACE_MEASURES.has(series.heading))) return INK;
  return topicSeriesColor(series, index);
}

export type EducationState = TopicState;
export type EducationUnit = ClientEducationFact["unit"];

/** A list's years: every year any selected series has a value, or any listed series when nothing is selected. */
function educationSelectionCoverage(definitions: readonly { id: string }[], selectedIds: readonly string[], facts: readonly ClientEducationFact[]): TopicCoverage {
  const ids = new Set(selectedIds.length ? selectedIds : definitions.map(definition => definition.id));
  return topicCoverage(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year), `No education years for ${definitions[0]?.id}`);
}

/** A topic page's years for its selection (all of its series' years when nothing is selected). Every row counts people, so any mix is charted. */
export function educationCoverage(section: EducationTopicId, facts: readonly ClientEducationFact[], selectedIds: readonly string[] = []): TopicCoverage {
  return educationSelectionCoverage(educationTopicSeries(section), selectedIds, facts);
}

export function defaultEducationState(section: EducationTopicId): EducationState {
  return { mode: "line", range: { kind: "all" }, selectedIds: educationDefaultSelection(section) };
}

/** Reads a topic page's hash: its selection (any mix of rows) and the years, fitted to the selection's coverage. */
export function parseEducationHash(hash: string, section: EducationTopicId, facts: readonly ClientEducationFact[]): EducationState {
  const parsed = parseTopicHash(new URLSearchParams(hash.replace(/^#/, "")), educationTopicSeries(section), educationDefaultSelection(section), educationCoverage(section, facts));
  return { ...parsed, range: refitRange(parsed.range, educationCoverage(section, facts, parsed.selectedIds), { collapseToAll: true }) };
}

/** A topic page's new selection; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export function changeEducationSelection(state: EducationState, section: EducationTopicId, next: readonly string[], facts: readonly ClientEducationFact[]): EducationState {
  return { ...state, selectedIds: [...next], range: refitRange(state.range, educationCoverage(section, facts, next), { collapseToAll: false }) };
}

/** A topic or place page's hash: the keys every topic page shares, and nothing else. */
export const serializeEducationHash = (state: EducationState) => serializeTopicHash(state);

export type EducationSeriesModel = TopicSeriesModel<EducationSeriesDefinition & { decimals: number; unit: EducationUnit }>;
/** `unit` and `heading` are the selection's (the list's first series' when nothing is selected). */
export type EducationModel = { range: ResolvedPeriodRange; years: number[]; series: EducationSeriesModel[]; selected: EducationSeriesModel[]; unit: EducationUnit; heading: EducationMeasure };

/**
 * The years (`coverage`), values, colours and units of one place's list of series. A year Geostat left blank (graduates'
 * last school year, a field before Geostat first lists it) is null, never zero. Shared by the topic and place pages.
 */
export function buildEducationSeriesModel(definitions: readonly EducationSeriesDefinition[], facts: readonly ClientEducationFact[], geographyId: string, state: EducationState, coverage: TopicCoverage): EducationModel {
  const byCell = new Map(facts.map(f => [educationFactKey(f), f]));
  const first = new Map<string, ClientEducationFact>();
  for (const fact of facts) if (fact.geographyId === geographyId && !first.has(fact.indicatorId)) first.set(fact.indicatorId, fact);
  const firstOf = (id: string) => {
    const fact = first.get(id);
    if (!fact) throw new Error(`No ${id} facts for ${geographyId}`);
    return fact;
  };
  const model = buildTopicModel({ range: state.range, coverage, selectedIds: state.selectedIds, color: educationSeriesColor,
    definitions: definitions.map(definition => {
      const { decimals, unit } = firstOf(definition.id);
      return { ...definition, decimals, unit };
    }),
    value: (definition, year) => byCell.get(educationFactKey({ indicatorId: definition.id as ClientEducationFact["indicatorId"], geographyId, year }))?.value });
  const lead = model.selected[0] ?? model.series[0];
  return { ...model, unit: lead.unit, heading: lead.heading };
}

export function buildEducationModel(section: EducationTopicId, facts: readonly ClientEducationFact[], state: EducationState): EducationModel {
  return buildEducationSeriesModel(educationTopicSeries(section), facts, EDUCATION_GEORGIA, state, educationCoverage(section, facts, state.selectedIds));
}
