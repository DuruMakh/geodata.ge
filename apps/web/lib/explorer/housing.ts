import { HOUSING_DISTRICTS, HOUSING_INDICATORS, HOUSING_TYPES, housingFactKey, housingIndicator, type ClientHousingFact, type HousingGroup, type HousingIndicator, type HousingMeasure } from "../data/housing/types";
import { INK, OTHER_COLOR } from "./colors";
import { MISSING, formatInUnit, type ValueUnit } from "./format";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, serializeTopicHash, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { changeUnitListSelection, parseUnitListHash, unitListCoverage } from "./unitList";

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

/**
 * Four types have a fixed colour: the palette (14 hexes, the last of which is the shared "other" colour) cannot colour 17 types
 * by position. Culture, pharmacy and holiday camps wear three existing site hexes that no palette hex is within 15 CIEDE2000 of
 * (and that keep 3:1 on paper and tint); other wears the shared "other" colour. They stay out of SERIES_COLORS, where the
 * sector colours already use #C16671 and #0D89C2. The other 13 types take the palette by position in `HOUSING_TYPES`.
 */
const FIXED_TYPE_COLORS: Readonly<Record<string, string>> = { culture: "#C16671", pharmacy: "#667722", holiday_camps: "#0D89C2", other: OTHER_COLOR };

const groupOf = (id: string) => id.split(".")[2] as HousingGroup;

/**
 * The reference is ink. A building type wears one colour under every heading and page (the number and the floor area of
 * hotels share it), and a Tbilisi district one under flats and houses (a house row is told apart by its dashed stroke),
 * each keyed by its position in its fixed list; four types have fixed colours, so none of a list's 17 repeats.
 * The price index's flats and houses take their colour by position.
 */
export function housingSeriesColor(series: HousingSeriesDefinition, index: number): string {
  const group = groupOf(series.id);
  if (series.reference) return INK;
  if (group.startsWith("type_")) {
    const type = group.slice("type_".length);
    return FIXED_TYPE_COLORS[type] ?? topicSeriesColor(series, HOUSING_TYPES.indexOf(type as typeof HOUSING_TYPES[number]), `housing.type.${type}`);
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

/** Reads a list's hash: a selection that mixes units keeps only its first row's unit (in list order), and the years fit that unit's coverage. */
export const parseHousingListHash = (hash: string, definitions: readonly HousingSeriesDefinition[], fallback: readonly string[], facts: readonly ClientHousingFact[]): TopicState =>
  parseUnitListHash(hash, definitions, fallback, facts, noHousingYears(definitions));

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

export type HousingStroke = "solid" | "dashed";
/** `stroke` tells a district's house row from its flat row, which wears the same colour. */
export type HousingSeriesModel = TopicSeriesModel<HousingSeriesDefinition & { decimals: number; unit: HousingUnit; stroke: HousingStroke }>;
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
    definitions: definitions.map(definition => ({ ...definition, decimals: first.get(definition.id)?.decimals ?? 0, unit: first.get(definition.id)!.unit,
      stroke: definition.heading === "houses" ? "dashed" as const : "solid" as const })),
    value: (definition, year) => byCell.get(housingFactKey({ indicatorId: definition.id, year }))?.value });
  return { ...model, unit: (model.selected[0] ?? model.series[0]).unit };
}

export const buildHousingModel = (section: HousingTopicId, facts: readonly ClientHousingFact[], state: HousingState): HousingModel =>
  buildHousingSeriesModel(housingTopicSeries(section), facts, state);

/** Reads a `housing.*` message. */
export type HousingTranslate = (key: string, values?: Record<string, string | number>) => string;

/** How a unit reads in charts, tables and lists: whole objects, thousand m² to one decimal, the index to one decimal, whole GEL per m². */
export function housingValueUnit(unit: HousingUnit): ValueUnit {
  return unit === "area" ? { divisor: 1_000, label: "", decimals: 1 } : { divisor: 1, label: "", decimals: unit === "index" ? 1 : 0 };
}

/** The unit's name beside a chart or table. */
export function housingUnitLabel(unit: HousingUnit, t: HousingTranslate): string {
  return t({ count: "unitCount", area: "unitThousandSquareMetres", index: "unitIndex", price: "unitGelPerSquareMetre" }[unit]);
}

/** A tooltip or list value: floor area and prices name their unit, a count or the index stands alone. */
export function housingValueLabel(value: number | null | undefined, unit: HousingUnit, t: HousingTranslate): string {
  if (value == null) return MISSING;
  const number = formatInUnit(value, housingValueUnit(unit));
  return unit === "area" || unit === "price" ? `${number} ${housingUnitLabel(unit, t)}` : number;
}

/** Floor area in a latest-value line: million m² to one decimal, thousand m² below a million. */
export function housingFloorArea(value: number, t: HousingTranslate): string {
  return value >= 1_000_000 ? `${formatInUnit(value, { divisor: 1_000_000, label: "", decimals: 1 })} ${t("unitMillionSquareMetres")}`
    : `${formatInUnit(value, { divisor: 1_000, label: "", decimals: 1 })} ${t("unitThousandSquareMetres")}`;
}

/** A whole number of permits or buildings. */
export const housingCount = (value: number) => formatInUnit(value, { divisor: 1, label: "", decimals: 0 });
