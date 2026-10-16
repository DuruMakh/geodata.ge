import { HOUSING_DISTRICTS, HOUSING_INDICATORS, HOUSING_TYPES, housingFactKey, housingIndicator, type ClientHousingFact, type HousingGroup, type HousingIndicator, type HousingMeasure } from "../data/housing/types";
import { INK } from "./colors";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, serializeTopicHash, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { changeUnitListSelection, keepOneUnit, parseUnitListHash, unitListCoverage } from "./unitList";

export const HOUSING_HUB_PATH = "/explorer/housing";
export const HOUSING_SECTIONS = [
  { id: "permits", href: "/explorer/housing/permits", labelKey: "common.housingPermits" },
  { id: "completed", href: "/explorer/housing/completed", labelKey: "common.housingCompleted" },
  { id: "prices", href: "/explorer/housing/prices", labelKey: "common.housingPrices" },
  { id: "regions", href: "/explorer/housing/regions", labelKey: "common.housingRegions" },
] as const;
export type HousingSectionId = typeof HOUSING_SECTIONS[number]["id"];
/** The three pages with a chart of national series; Regions is the map index of the area pages (housingAreas.ts). */
export type HousingTopicId = Exclude<HousingSectionId, "regions">;

/**
 * The heading a row sits under: a number or floor-area group on Permits, Completed and the area pages, or the price
 * index, flat prices and house prices on Prices. Rows under one heading share one unit.
 */
export type HousingHeading = "count" | "area" | "index" | "flats" | "houses";
export type HousingSeriesDefinition = { id: HousingIndicator; reference: boolean; heading: HousingHeading };

/** A page's group of rows: its total (the ink reference), then Geostat's building types in `HOUSING_TYPES` order. */
const measureRows = (measure: HousingMeasure, heading: HousingHeading): HousingSeriesDefinition[] => [
  { id: housingIndicator(measure, "total"), reference: true, heading },
  ...HOUSING_TYPES.map(type => housingIndicator(measure, `type_${type}`)).filter(id => HOUSING_INDICATORS.includes(id)).map(id => ({ id, reference: false, heading })),
];

/** The series a topic page lists, the reference first. Completed objects have no holiday-camps column, so the indicator list decides which types exist. */
export function housingTopicSeries(section: HousingTopicId): HousingSeriesDefinition[] {
  switch (section) {
    case "permits": return [...measureRows("permits_count", "count"), ...measureRows("permits_area", "area")];
    case "completed": return [...measureRows("completed_count", "count"), ...measureRows("completed_area", "area")];
    case "prices": return [
      { id: housingIndicator("price_index", "total"), reference: true, heading: "index" },
      { id: housingIndicator("price_index", "flats"), reference: false, heading: "index" },
      { id: housingIndicator("price_index", "houses"), reference: false, heading: "index" },
      ...HOUSING_DISTRICTS.map(district => ({ id: housingIndicator("price_flat", `district_${district}`), reference: false, heading: "flats" as const })),
      ...HOUSING_DISTRICTS.map(district => ({ id: housingIndicator("price_house", `district_${district}`), reference: false, heading: "houses" as const })),
    ];
  }
}

/** A page's initial selection: its total number of objects, or the price index. */
export function housingDefaultSelection(section: HousingTopicId): string[] {
  return [housingTopicSeries(section)[0].id];
}

const groupOf = (id: string) => id.split(".")[2] as HousingGroup;

/**
 * The reference is ink. A building type wears one colour under every heading and page (the number and the floor area of
 * hotels share it), and a Tbilisi district one under flats and houses, each keyed by its position in its fixed list.
 * The price index's flats and houses take their colour by position.
 */
export function housingSeriesColor(series: HousingSeriesDefinition, index: number): string {
  const group = groupOf(series.id);
  if (series.reference) return INK;
  if (group.startsWith("type_")) {
    const type = group.slice("type_".length);
    return topicSeriesColor(series, HOUSING_TYPES.indexOf(type as typeof HOUSING_TYPES[number]), `housing.type.${type}`);
  }
  if (group.startsWith("district_")) {
    const district = group.slice("district_".length);
    return topicSeriesColor(series, HOUSING_DISTRICTS.indexOf(district as typeof HOUSING_DISTRICTS[number]), `housing.district.${district}`);
  }
  return topicSeriesColor(series, index);
}

export type HousingState = TopicState;
export type HousingUnit = ClientHousingFact["unit"];

const noHousingYears = (definitions: readonly HousingSeriesDefinition[]) => `No housing years for ${definitions[0]?.id}`;

/** A list's years for its selection (all of its series' years when nothing is selected). */
export const housingListCoverage = (definitions: readonly HousingSeriesDefinition[], selectedIds: readonly string[], facts: readonly ClientHousingFact[]) =>
  unitListCoverage(definitions, selectedIds, facts, noHousingYears(definitions));

/**
 * Reads a list's hash. A selection that mixes units keeps the unit of the first row *in the hash* (a saved link
 * `sel=<district>,<index>` keeps the district), and the years fit that unit's coverage.
 */
export function parseHousingListHash(hash: string, definitions: readonly HousingSeriesDefinition[], fallback: readonly string[], facts: readonly ClientHousingFact[]): TopicState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (p.has("sel")) {
    const listed = new Set<string>(definitions.map(definition => definition.id));
    p.set("sel", keepOneUnit(p.get("sel")!.split(",").filter(id => listed.has(id)), [], facts).join(","));
  }
  return parseUnitListHash(p.toString(), definitions, fallback, facts, noHousingYears(definitions));
}

/** A list's new selection, kept to one unit; the years stay, clamped to the selection's coverage (never collapsed to "all"). */
export const changeHousingSelection = (state: TopicState, definitions: readonly HousingSeriesDefinition[], next: readonly string[], facts: readonly ClientHousingFact[]): TopicState =>
  changeUnitListSelection(state, definitions, next, facts, noHousingYears(definitions));

/** A topic page's years for its selection. */
export const housingCoverage = (section: HousingTopicId, facts: readonly ClientHousingFact[], selectedIds: readonly string[] = []) =>
  housingListCoverage(housingTopicSeries(section), selectedIds, facts);

export const parseHousingHash = (hash: string, section: HousingTopicId, facts: readonly ClientHousingFact[]): HousingState =>
  parseHousingListHash(hash, housingTopicSeries(section), housingDefaultSelection(section), facts);

/** A topic or area page's hash: the keys every topic page shares, and nothing else. */
export const serializeHousingHash = (state: TopicState) => serializeTopicHash(state);

export type HousingSeriesModel = TopicSeriesModel<HousingSeriesDefinition & { decimals: number; unit: HousingUnit }>;
/** `unit` is the selection's (the list's first series' when nothing is selected). */
export type HousingModel = { range: ResolvedPeriodRange; years: number[]; series: HousingSeriesModel[]; selected: HousingSeriesModel[]; unit: HousingUnit };

/**
 * The years (the selection's unit's coverage), values, colours and units of a list of series. A year Geostat left blank
 * (a type missing from a sheet, a region's early gaps) is null, never zero. Shared by the topic and area pages.
 */
export function buildHousingSeriesModel(
  definitions: readonly HousingSeriesDefinition[], facts: readonly ClientHousingFact[], state: TopicState, color: (definition: HousingSeriesDefinition, index: number) => string = housingSeriesColor,
): HousingModel {
  const byCell = new Map(facts.map(f => [housingFactKey(f), f]));
  const first = new Map<string, ClientHousingFact>();
  for (const fact of facts) if (!first.has(fact.indicatorId)) first.set(fact.indicatorId, fact);
  const model = buildTopicModel({ range: state.range, coverage: housingListCoverage(definitions, state.selectedIds, facts), selectedIds: state.selectedIds, color,
    definitions: definitions.map(definition => ({ ...definition, decimals: first.get(definition.id)?.decimals ?? 0, unit: first.get(definition.id)!.unit })),
    value: (definition, year) => byCell.get(housingFactKey({ indicatorId: definition.id, year }))?.value });
  return { ...model, unit: (model.selected[0] ?? model.series[0]).unit };
}

export const buildHousingModel = (section: HousingTopicId, facts: readonly ClientHousingFact[], state: HousingState): HousingModel =>
  buildHousingSeriesModel(housingTopicSeries(section), facts, state);
