import { SCIENCE_CULTURE_GROUPS, scienceCultureIndicator, type ClientScienceCultureFact, type ScienceCultureGroup, type ScienceCultureIndicator, type ScienceCultureMeasure, type ScienceCultureSeriesBreak } from "../data/scienceCulture/types";
import { INK } from "./colors";
import type { ResolvedPeriodRange } from "./periodRange";
import { serializeTopicHash, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { buildUnitListModel, changeUnitListSelection, parseUnitListHash, unitListCoverage } from "./unitList";

export const SCIENCE_CULTURE_HUB_PATH = "/explorer/science-culture";
export const SCIENCE_CULTURE_SECTIONS = [
  { id: "research", href: `${SCIENCE_CULTURE_HUB_PATH}/research`, labelKey: "common.scienceCultureResearch" },
  { id: "patents", href: `${SCIENCE_CULTURE_HUB_PATH}/patents`, labelKey: "common.scienceCulturePatents" },
  { id: "museums", href: `${SCIENCE_CULTURE_HUB_PATH}/museums`, labelKey: "common.scienceCultureMuseums" },
  { id: "theatres", href: `${SCIENCE_CULTURE_HUB_PATH}/theatres`, labelKey: "common.scienceCultureTheatres" },
] as const;
export type ScienceCultureSectionId = typeof SCIENCE_CULTURE_SECTIONS[number]["id"];
/** The three pages with a chart of national series; Museums is the map index of the area pages (scienceCultureMuseums.ts). */
export type ScienceCultureTopicId = Exclude<ScienceCultureSectionId, "museums">;

/**
 * The heading a row sits under. Research: researchers, degree, field, age, rdStaff, institutions, spending. Patents: the four
 * register columns. Theatres: audience, shows, events, theatres, seats, staff. Museum areas: visitors, tours, exhibitions,
 * museums, staff. Headings that share a unit (all the people headings on Research; all four patent headings) chart together.
 */
export type ScienceCultureHeading =
  | "researchers" | "degree" | "field" | "age" | "rdStaff" | "institutions" | "spending"
  | "inventionApplications" | "inventionPatents" | "utilityApplications" | "utilityPatents"
  | "audience" | "shows" | "events" | "theatres" | "seats" | "staff"
  | "visitors" | "tours" | "exhibitions" | "museums";
export type ScienceCultureSeriesDefinition = { id: ScienceCultureIndicator; reference: boolean; heading: ScienceCultureHeading };

/** A heading's rows for the groups given, in that order. */
export const scienceCultureRows = <M extends ScienceCultureMeasure>(measure: M, groups: readonly ScienceCultureGroup<M>[], heading: ScienceCultureHeading): ScienceCultureSeriesDefinition[] =>
  groups.map(group => ({ id: scienceCultureIndicator(measure, group), reference: false, heading }));

/** The groups of a measure that start with `prefix`, in the measure's order. */
const groupsWith = <M extends ScienceCultureMeasure>(measure: M, prefix: string): ScienceCultureGroup<M>[] =>
  (SCIENCE_CULTURE_GROUPS[measure] as readonly ScienceCultureGroup<M>[]).filter(group => group.startsWith(prefix));

/** The eight staff rows of a museum or theatre staff table. */
export const scienceCultureStaffRows = (measure: "museum_staff" | "theatre_staff"): ScienceCultureSeriesDefinition[] => scienceCultureRows(measure, SCIENCE_CULTURE_GROUPS[measure], "staff");

const PATENT_HEADINGS = [
  { measure: "invention_applications", heading: "inventionApplications" },
  { measure: "invention_patents", heading: "inventionPatents" },
  { measure: "utility_applications", heading: "utilityApplications" },
  { measure: "utility_patents", heading: "utilityPatents" },
] as const satisfies readonly { measure: ScienceCultureMeasure; heading: ScienceCultureHeading }[];

/** The series a topic page lists, in the design spec's order (§4, §5, §7); the first, the page's default, is the ink reference. */
export function scienceCultureTopicSeries(section: ScienceCultureTopicId): ScienceCultureSeriesDefinition[] {
  const rows = (() => {
    switch (section) {
      case "research": return [
        ...scienceCultureRows("researchers", ["total", "women", "men"], "researchers"),
        ...scienceCultureRows("researchers", groupsWith("researchers", "degree_"), "degree"),
        ...scienceCultureRows("researchers", groupsWith("researchers", "field_"), "field"),
        ...scienceCultureRows("researchers", groupsWith("researchers", "age_"), "age"),
        ...scienceCultureRows("rd_staff", ["total", "technicians", "support", "not_specified"], "rdStaff"),
        ...scienceCultureRows("institutions", ["total"], "institutions"),
        ...scienceCultureRows("rd_spending", ["total"], "spending"),
      ];
      case "patents": return PATENT_HEADINGS.flatMap(({ measure, heading }) => scienceCultureRows(measure, SCIENCE_CULTURE_GROUPS[measure], heading));
      case "theatres": return [
        ...scienceCultureRows("theatre_audience", ["total"], "audience"),
        ...scienceCultureRows("theatre_shows", SCIENCE_CULTURE_GROUPS.theatre_shows, "shows"),
        ...scienceCultureRows("theatre_events", SCIENCE_CULTURE_GROUPS.theatre_events, "events"),
        ...scienceCultureRows("theatres", SCIENCE_CULTURE_GROUPS.theatres, "theatres"),
        ...scienceCultureRows("theatre_seats", ["total"], "seats"),
        ...scienceCultureStaffRows("theatre_staff"),
      ];
    }
  })();
  return rows.map((row, index) => ({ ...row, reference: index === 0 }));
}

/** A page's initial selection: its first row. */
export function scienceCultureDefaultSelection(section: ScienceCultureTopicId): string[] {
  return [scienceCultureTopicSeries(section)[0].id];
}

/**
 * The reference is ink. A staff group takes the palette at its place in the eight staff groups, so it wears one colour under
 * museums and theatres (two pages); every other row, patent rows included, takes the palette at its place in its list.
 */
export function scienceCultureSeriesColor(series: ScienceCultureSeriesDefinition, index: number): string {
  if (series.reference) return INK;
  const [, measure, group] = series.id.split(".");
  if (measure.endsWith("_staff") && measure !== "rd_staff") return topicSeriesColor(series, (SCIENCE_CULTURE_GROUPS.museum_staff as readonly string[]).indexOf(group));
  return topicSeriesColor(series, index);
}

export type ScienceCultureState = TopicState;
export type ScienceCultureUnit = ClientScienceCultureFact["unit"];

const noYears = (definitions: readonly ScienceCultureSeriesDefinition[]) => `No science and culture years for ${definitions[0]?.id}`;

/** A list's years for its selection (all of its series' years when nothing is selected). */
export const scienceCultureListCoverage = (definitions: readonly ScienceCultureSeriesDefinition[], selectedIds: readonly string[], facts: readonly ClientScienceCultureFact[]) =>
  unitListCoverage(definitions, selectedIds, facts, noYears(definitions));

/** Reads a list's hash: a selection that mixes units keeps only its first row's unit (in list order), and the years fit that unit's coverage. */
export const parseScienceCultureListHash = (hash: string, definitions: readonly ScienceCultureSeriesDefinition[], fallback: readonly string[], facts: readonly ClientScienceCultureFact[]): TopicState =>
  parseUnitListHash(hash, definitions, fallback, facts, noYears(definitions));

/** A list's new selection, kept to one unit; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export const changeScienceCultureSelection = (state: TopicState, definitions: readonly ScienceCultureSeriesDefinition[], next: readonly string[], facts: readonly ClientScienceCultureFact[]): TopicState =>
  changeUnitListSelection(state, definitions, next, facts, noYears(definitions));

/** A topic page's years for its selection. */
export const scienceCultureCoverage = (section: ScienceCultureTopicId, facts: readonly ClientScienceCultureFact[], selectedIds: readonly string[] = []) =>
  scienceCultureListCoverage(scienceCultureTopicSeries(section), selectedIds, facts);

export const parseScienceCultureHash = (hash: string, section: ScienceCultureTopicId, facts: readonly ClientScienceCultureFact[]): ScienceCultureState =>
  parseScienceCultureListHash(hash, scienceCultureTopicSeries(section), scienceCultureDefaultSelection(section), facts);

/** A topic or area page's hash: the keys every topic page shares, and nothing else. */
export const serializeScienceCultureHash = (state: TopicState) => serializeTopicHash(state);

export type ScienceCultureSeriesModel = TopicSeriesModel<ScienceCultureSeriesDefinition & { decimals: number; unit: ScienceCultureUnit }>;
/** `unit` is the selection's (the list's first series' when nothing is selected). */
export type ScienceCultureListModel = { range: ResolvedPeriodRange; years: number[]; series: ScienceCultureSeriesModel[]; selected: ScienceCultureSeriesModel[]; unit: ScienceCultureUnit };
export type ScienceCultureModel = ScienceCultureListModel & {
  /** The counting changes inside the range that touch the selection: the chart draws a gap and a rule, the table marks the year. */
  breaks: { year: number; label: "newCounting" }[];
};

/**
 * The years (the selection's unit's coverage), values, colours and units of a list of series. A year Geostat left blank
 * is null, never zero. Shared by the topic and museum area pages.
 */
export const buildScienceCultureSeriesModel = (
  definitions: readonly ScienceCultureSeriesDefinition[], facts: readonly ClientScienceCultureFact[], state: TopicState,
  color: (definition: ScienceCultureSeriesDefinition, index: number) => string = scienceCultureSeriesColor,
): ScienceCultureListModel => buildUnitListModel({ definitions, facts, state, color, coverage: scienceCultureListCoverage(definitions, state.selectedIds, facts) });

const breakYear = (item: { referenceDate: string }) => Number(item.referenceDate.slice(0, 4));

export function buildScienceCultureModel(section: ScienceCultureTopicId, facts: readonly ClientScienceCultureFact[], state: ScienceCultureState, breaks: readonly ScienceCultureSeriesBreak[]): ScienceCultureModel {
  const model = buildScienceCultureSeriesModel(scienceCultureTopicSeries(section), facts, state);
  const selected = new Set(state.selectedIds);
  const years = breaks.filter(item => item.appliesTo.some(id => selected.has(id))).map(breakYear).filter(year => year > model.range.start && year <= model.range.end);
  return { ...model, breaks: [...new Set(years)].sort((a, b) => a - b).map(year => ({ year, label: "newCounting" as const })) };
}
