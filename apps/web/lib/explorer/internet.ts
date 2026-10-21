import {
  INTERNET_ACTIVITIES, INTERNET_ADULT_GROUPS, INTERNET_EGOV, INTERNET_GROUPS, internetFactKey, internetIndicator,
  type ClientInternetFact, type InternetIndicator, type InternetMeasure,
} from "../data/internet/types";
import { INK, colorForItem } from "./colors";
import { formatInUnit, type ValueUnit } from "./format";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, serializeTopicHash, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { changeUnitListSelection, parseUnitListHash, unitListCoverage } from "./unitList";

export const INTERNET_HUB_PATH = "/explorer/internet";
export const INTERNET_SECTIONS = [
  { id: "homes", href: "/explorer/internet/homes", labelKey: "common.internetHomes" },
  { id: "users", href: "/explorer/internet/users", labelKey: "common.internetUsers" },
  { id: "online", href: "/explorer/internet/online", labelKey: "common.internetOnline" },
  { id: "devices", href: "/explorer/internet/devices", labelKey: "common.internetDevices" },
] as const;
export type InternetSectionId = typeof INTERNET_SECTIONS[number]["id"];
/** The three pages with a chart of national series; Internet at home is the map index of the area pages (internetAreas.ts). */
export type InternetTopicId = Exclude<InternetSectionId, "homes">;

/**
 * The heading a row sits under: a measure of a group of people on the topic pages, the online activities and public
 * services, or homes on the area pages (Georgia's two measures, a region's one heading). Each heading counts one group of
 * people, so a topic page's chart shows one heading at a time.
 */
export type InternetHeading =
  | "used_3m" | "never_used" | "daily" | "bought_online" | "activities" | "egov" | "own_mobile" | "own_smartphone" | "computer_3m"
  | "homes" | "homes_internet" | "homes_computer";
export type InternetSeriesDefinition = { id: InternetIndicator; reference: boolean; heading: InternetHeading };

/** A measure's rows: Everyone (the ink reference), then each group, in `INTERNET_GROUPS` order. */
const groupRows = (measure: InternetMeasure & InternetHeading, groups: readonly string[] = INTERNET_GROUPS): InternetSeriesDefinition[] =>
  groups.map(group => ({ id: internetIndicator(measure, group as typeof INTERNET_GROUPS[number]), reference: group === "total", heading: measure }));

/** The series a topic page lists, in its headings' order. */
export function internetTopicSeries(section: InternetTopicId): InternetSeriesDefinition[] {
  switch (section) {
    case "users": return [...groupRows("used_3m"), ...groupRows("never_used"), ...groupRows("daily", INTERNET_ADULT_GROUPS)];
    case "online": return [
      ...groupRows("bought_online", INTERNET_ADULT_GROUPS),
      ...INTERNET_ACTIVITIES.map(activity => ({ id: internetIndicator(`activity_${activity}`, "total"), reference: false, heading: "activities" as const })),
      ...INTERNET_EGOV.map(kind => ({ id: internetIndicator(`egov_${kind}`, "total"), reference: false, heading: "egov" as const })),
    ];
    case "devices": return [...groupRows("own_mobile"), ...groupRows("own_smartphone"), ...groupRows("computer_3m")];
  }
}

/** A page's initial selection: Everyone under its first heading. */
export function internetDefaultSelection(section: InternetTopicId): string[] {
  return [internetTopicSeries(section)[0].id];
}

const groupOf = (id: string) => id.split(".")[2];
/** Headings of one row per group of people: their rows are named by the group alone. */
const GROUP_HEADINGS: ReadonlySet<InternetHeading> = new Set(["used_3m", "never_used", "daily", "bought_online", "own_mobile", "own_smartphone", "computer_3m", "homes_internet", "homes_computer"]);

/**
 * Everyone is ink. A group (Towns, Villages, Women, Men, an age group) wears one colour under every heading and page,
 * keyed by its position in `INTERNET_GROUPS`; the activities and public services take the palette by their position in the list.
 */
export function internetSeriesColor(series: InternetSeriesDefinition, index: number): string {
  if (series.reference) return INK;
  if (GROUP_HEADINGS.has(series.heading)) {
    const group = groupOf(series.id);
    return colorForItem(`internet.group.${group}`, INTERNET_GROUPS.indexOf(group as typeof INTERNET_GROUPS[number]));
  }
  return topicSeriesColor(series, index);
}

export type InternetState = TopicState;

const noInternetYears = (definitions: readonly InternetSeriesDefinition[]) => `No internet years for ${definitions[0]?.id}`;
/** A topic page's one-heading rule: a row's group is its heading. */
const headingOf = (definitions: readonly InternetSeriesDefinition[]) => {
  const headings = new Map<string, string>(definitions.map(definition => [definition.id, definition.heading]));
  return (id: string) => headings.get(id);
};

/** A topic page's years for its selection's heading (all of its series' years when nothing is selected). */
export const internetCoverage = (section: InternetTopicId, facts: readonly ClientInternetFact[], selectedIds: readonly string[] = []) => {
  const definitions = internetTopicSeries(section);
  return unitListCoverage(definitions, selectedIds, facts, noInternetYears(definitions), headingOf(definitions));
};

/** Reads a topic page's hash: a selection that mixes headings keeps only its first row's heading, and the years fit that heading. */
export const parseInternetHash = (hash: string, section: InternetTopicId, facts: readonly ClientInternetFact[]): InternetState => {
  const definitions = internetTopicSeries(section);
  return parseUnitListHash(hash, definitions, internetDefaultSelection(section), facts, noInternetYears(definitions), headingOf(definitions));
};

/** A topic page's new selection: a row under another heading replaces it. The years stay, clamped to the heading's (never collapsed to "all"). */
export const changeInternetSelection = (section: InternetTopicId, state: InternetState, next: readonly string[], facts: readonly ClientInternetFact[]): InternetState => {
  const definitions = internetTopicSeries(section);
  return changeUnitListSelection(state, definitions, next, facts, noInternetYears(definitions), headingOf(definitions));
};

/** A topic or area page's hash: the keys every topic page shares, and nothing else. */
export const serializeInternetHash = (state: TopicState) => serializeTopicHash(state);

export type InternetStroke = "solid" | "dashed";
/** `stroke` tells a computer row from the internet row of the same homes, which wears the same colour. */
export type InternetSeriesModel = TopicSeriesModel<InternetSeriesDefinition & { stroke: InternetStroke }>;
export type InternetModel = { range: ResolvedPeriodRange; years: number[]; series: InternetSeriesModel[]; selected: InternetSeriesModel[] };

/**
 * The years (the selection's coverage under `coverage`), values and colours of a list of series. A year Geostat did not
 * publish is null, never zero. Shared by the topic and area pages.
 */
export function buildInternetSeriesModel(
  definitions: readonly InternetSeriesDefinition[], facts: readonly ClientInternetFact[], state: TopicState,
  color: (definition: InternetSeriesDefinition, index: number) => string = internetSeriesColor, grouping?: (id: string) => string | undefined,
): InternetModel {
  const byCell = new Map(facts.map(f => [internetFactKey(f), f]));
  return buildTopicModel({ range: state.range, coverage: unitListCoverage(definitions, state.selectedIds, facts, noInternetYears(definitions), grouping), selectedIds: state.selectedIds, color,
    definitions: definitions.map(definition => ({ ...definition, stroke: definition.id.startsWith("internet.homes_computer.") ? "dashed" as const : "solid" as const })),
    value: (definition, year) => byCell.get(internetFactKey({ indicatorId: definition.id, year }))?.value });
}

export const buildInternetModel = (section: InternetTopicId, facts: readonly ClientInternetFact[], state: InternetState): InternetModel => {
  const definitions = internetTopicSeries(section);
  return buildInternetSeriesModel(definitions, facts, state, internetSeriesColor, headingOf(definitions));
};

/** Reads an `internet.*` message. */
export type InternetTranslate = (key: string, values?: Record<string, string | number>) => string;

/** Shares read to one decimal, as Geostat prints them; the heading or the unit label names the per cent. */
export const INTERNET_PERCENT: ValueUnit = { divisor: 1, label: "", decimals: 1 };

/** A share as Geostat prints it: one decimal and a per cent sign. */
export const internetPercent = (value: number) => `${formatInUnit(value, INTERNET_PERCENT)}%`;

/**
 * A series' name outside the list (chart, table, workbook): a group row carries its heading's text before the "·", since
 * the group's name repeats under every heading; an activity, a public service or a region's row keeps its own name.
 */
export function internetSeriesLabel(series: Pick<InternetSeriesDefinition, "id" | "heading">, labels: Readonly<Record<string, string>>, t: InternetTranslate): string {
  return GROUP_HEADINGS.has(series.heading) ? `${labels[series.id]} — ${t(`heading.${series.heading}`).split(" · ")[0]}` : labels[series.id];
}
