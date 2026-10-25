import { ENVIRONMENT_POLLUTANTS, environmentFactKey, type ClientEnvironmentFact, type EnvironmentUnit } from "../data/environment/types";
import { MISSING, formatInUnit, type ValueUnit } from "./format";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, serializeTopicHash, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { changeUnitListSelection, parseUnitListHash, unitListCoverage } from "./unitList";

export const ENVIRONMENT_HUB_PATH = "/explorer/environment";
export const ENVIRONMENT_SECTIONS = [
  { id: "greenhouse-gases", href: `${ENVIRONMENT_HUB_PATH}/greenhouse-gases`, labelKey: "common.environmentGreenhouseGases" },
  { id: "air-pollution", href: `${ENVIRONMENT_HUB_PATH}/air-pollution`, labelKey: "common.environmentAirPollution" },
  { id: "air-quality", href: `${ENVIRONMENT_HUB_PATH}/air-quality`, labelKey: "common.environmentAirQuality" },
  { id: "climate", href: `${ENVIRONMENT_HUB_PATH}/climate`, labelKey: "common.environmentClimate" },
  { id: "water", href: `${ENVIRONMENT_HUB_PATH}/water`, labelKey: "common.environmentWater" },
  { id: "waste", href: `${ENVIRONMENT_HUB_PATH}/waste`, labelKey: "common.environmentWaste" },
  { id: "forests", href: `${ENVIRONMENT_HUB_PATH}/forests`, labelKey: "common.environmentForests" },
] as const;
export type EnvironmentSectionId = typeof ENVIRONMENT_SECTIONS[number]["id"];
/** The four pages with one national list; City air quality, Waste and Forests open city or area pages (environmentCities.ts, environmentAreas.ts). */
export type EnvironmentTopicId = "greenhouse-gases" | "air-pollution" | "climate" | "water";

/** The series whose latest figure is the line under each national page's heading, and its group page card's figure. */
export const ENVIRONMENT_LATEST_ID: Record<EnvironmentTopicId, string> = {
  "greenhouse-gases": "environment.ghg.total", "air-pollution": "environment.air.co.total",
  climate: "environment.climate.temperature.georgia", water: "environment.water.lost_share",
};

/**
 * A list row. `heading` is the key of the group it is listed under (`environment.heading.{heading}`); rows under one heading
 * share one unit. The reference is drawn in ink, a limit line dashed in grey (`color`).
 */
export type EnvironmentSeriesDefinition = { id: string; reference: boolean; heading: string; stroke?: "dashed"; color?: string };

const row = (heading: string, id: string, reference = false): EnvironmentSeriesDefinition => ({ id, reference, heading });
const rows = (heading: string, prefix: string, items: readonly string[]) => items.map(item => row(heading, `${prefix}.${item}`));
const CLIMATE_AREAS = { temperature: ["georgia", "tbilisi", "warmest", "coldest"], precipitation: ["georgia", "tbilisi", "wettest", "driest"] } as const;
const climate = (heading: string, kind: string, areas: readonly string[]) => areas.map((area, index) => row(heading, `environment.climate.${kind}.${area}`, index === 0));

/** A national page's list, in the design's order: the page's total first, then each heading's rows in Geostat's order. */
export function environmentTopicSeries(section: EnvironmentTopicId): EnvironmentSeriesDefinition[] {
  switch (section) {
    case "greenhouse-gases": return [
      row("totals", "environment.ghg.total", true), row("totals", "environment.ghg.net"),
      ...rows("bySector", "environment.ghg", ["sector_energy", "sector_industry", "sector_agriculture", "sector_waste", "sector_land"]),
      ...rows("energyDetail", "environment.ghg", ["energy_stationary", "energy_transport", "energy_fugitive"]),
      ...rows("byGas", "environment.ghg", ["gas_co2", "gas_methane", "gas_nitrous_oxide"]),
      ...rows("fluorinated", "environment.ghg", ["gas_hfcs", "gas_sf6"]),
      row("ghgPerPerson", "environment.ghg.per_person"),
    ];
    // Eight pollutants share one unit and are all selected on arrival, so no total is the ink reference.
    case "air-pollution": return ENVIRONMENT_POLLUTANTS.flatMap(pollutant => rows(pollutant, `environment.air.${pollutant}`, ["total", "stationary", "mobile"]));
    case "climate": return [
      ...climate("temperature", "temperature", CLIMATE_AREAS.temperature), ...climate("anomaly", "temperature_anomaly", CLIMATE_AREAS.temperature),
      ...climate("precipitation", "precipitation", CLIMATE_AREAS.precipitation),
    ];
    case "water": return [
      row("water", "environment.water.gross", true), ...rows("water", "environment.water", ["lost", "net", "households"]),
      row("lostShare", "environment.water.lost_share"),
      ...rows("people", "environment.water", ["people_piped", "people_sewers", "people_treatment"]),
      ...rows("peopleShare", "environment.water", ["share_piped", "share_sewers", "share_treatment"]),
      row("waterPerPerson", "environment.water.per_person"),
    ];
  }
}

/** A page's initial selection: its total, or on Air pollution the eight pollutant totals. */
export function environmentDefaultSelection(section: EnvironmentTopicId): string[] {
  const series = environmentTopicSeries(section);
  return section === "air-pollution" ? series.filter(s => s.id.endsWith(".total")).map(s => s.id) : [series[0].id];
}

/**
 * The reference is ink. On Temperature and rain each place keeps one colour under its three headings; every other row takes
 * the palette by its position in the list, which on Air pollution gives the eight totals (every third row) eight colours.
 */
export function environmentSeriesColor(series: EnvironmentSeriesDefinition, index: number): string {
  if (series.color) return series.color;
  if (series.id.startsWith("environment.climate.")) {
    const area = series.id.split(".")[3];
    const position = Math.max(CLIMATE_AREAS.temperature.indexOf(area as never), CLIMATE_AREAS.precipitation.indexOf(area as never));
    return topicSeriesColor(series, position, `environment.climate.${position}`);
  }
  return topicSeriesColor(series, index);
}

export type EnvironmentState = TopicState;

/** Only the rows the facts have: a city without a nitrogen dioxide average lists no such heading. */
export const withFacts = (definitions: readonly EnvironmentSeriesDefinition[], facts: readonly ClientEnvironmentFact[]) => {
  const ids = new Set(facts.map(f => f.indicatorId));
  return definitions.filter(definition => ids.has(definition.id));
};
const noYears = (definitions: readonly { id: string }[]) => `No environment years for ${definitions[0]?.id}`;

/** A list's years for its selection (all of its series' years when nothing is selected). */
export const environmentListCoverage = (definitions: readonly EnvironmentSeriesDefinition[], selectedIds: readonly string[], facts: readonly ClientEnvironmentFact[]) =>
  unitListCoverage(withFacts(definitions, facts), selectedIds, facts, noYears(definitions));

/**
 * Reads a list's hash: a selection that mixes units keeps only its first row's unit, and the years fit that unit's coverage.
 * A selection naming none of the list's rows (a link from another city or area) falls back to `fallback`; an explicit empty
 * one stays empty.
 */
export function parseEnvironmentListHash(hash: string, definitions: readonly EnvironmentSeriesDefinition[], fallback: readonly string[], facts: readonly ClientEnvironmentFact[]): TopicState {
  const listed = withFacts(definitions, facts);
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const sel = p.get("sel");
  if (sel && !sel.split(",").some(id => listed.some(definition => definition.id === id))) p.delete("sel");
  return parseUnitListHash(p.toString(), listed, fallback, facts, noYears(definitions));
}

/** A list's new selection, kept to one unit; the years stay, clamped to the selection's coverage. */
export const changeEnvironmentListSelection = (state: TopicState, definitions: readonly EnvironmentSeriesDefinition[], next: readonly string[], facts: readonly ClientEnvironmentFact[]): TopicState =>
  changeUnitListSelection(state, withFacts(definitions, facts), next, facts, noYears(definitions));

export const parseEnvironmentHash = (hash: string, section: EnvironmentTopicId, facts: readonly ClientEnvironmentFact[]): EnvironmentState =>
  parseEnvironmentListHash(hash, environmentTopicSeries(section), environmentDefaultSelection(section), facts);

export const changeEnvironmentSelection = (state: EnvironmentState, section: EnvironmentTopicId, next: readonly string[], facts: readonly ClientEnvironmentFact[]): EnvironmentState =>
  changeEnvironmentListSelection(state, environmentTopicSeries(section), next, facts);

/** The topic coverage of a page's selection, for the range strip. */
export const environmentCoverage = (section: EnvironmentTopicId, facts: readonly ClientEnvironmentFact[], selectedIds: readonly string[] = []) =>
  environmentListCoverage(environmentTopicSeries(section), selectedIds, facts);

/** Every environment page keeps only the keys topic pages share. */
export const serializeEnvironmentHash = (state: TopicState) => serializeTopicHash(state);

export type EnvironmentSeriesModel = TopicSeriesModel<EnvironmentSeriesDefinition & { decimals: number; unit: EnvironmentUnit }>;
/** `unit` and `decimals` are the selection's (the list's first series' when nothing is selected): the most decimals any selected year was published with. */
export type EnvironmentModel = { range: ResolvedPeriodRange; years: number[]; series: EnvironmentSeriesModel[]; selected: EnvironmentSeriesModel[]; unit: EnvironmentUnit; decimals: number };

/**
 * The years (the selection's unit's coverage), values, colours, units and decimals of a list. Rows without any fact are
 * dropped; a year Geostat left blank is null, never zero, so 1991-1994 on Temperature and rain are gaps. Shared by the
 * national, city and area pages.
 */
export function buildEnvironmentSeriesModel(
  definitions: readonly EnvironmentSeriesDefinition[], facts: readonly ClientEnvironmentFact[], state: TopicState,
  color: (definition: EnvironmentSeriesDefinition, index: number) => string = environmentSeriesColor,
): EnvironmentModel {
  const byCell = new Map(facts.map(f => [environmentFactKey(f), f]));
  const units = new Map<string, EnvironmentUnit>(), decimals = new Map<string, number>();
  for (const fact of facts) {
    units.set(fact.indicatorId, fact.unit);
    decimals.set(fact.indicatorId, Math.max(decimals.get(fact.indicatorId) ?? 0, fact.decimals));
  }
  const listed = withFacts(definitions, facts);
  const model = buildTopicModel({
    range: state.range, coverage: environmentListCoverage(definitions, state.selectedIds, facts), selectedIds: state.selectedIds, color,
    definitions: listed.map(definition => ({ ...definition, decimals: decimals.get(definition.id)!, unit: units.get(definition.id)! })),
    value: (definition, year) => byCell.get(environmentFactKey({ indicatorId: definition.id, year }))?.value,
  });
  const shown = model.selected.length ? model.selected : model.series.slice(0, 1);
  return { ...model, unit: shown[0].unit, decimals: Math.max(...shown.map(series => series.decimals)) };
}

export const buildEnvironmentModel = (section: EnvironmentTopicId, facts: readonly ClientEnvironmentFact[], state: EnvironmentState): EnvironmentModel =>
  buildEnvironmentSeriesModel(environmentTopicSeries(section), facts, state);

/** Reads an `environment.*` message. */
export type EnvironmentTranslate = (key: string, values?: Record<string, string | number>) => string;

/** A value as published: no divisor, its own decimals. */
export const environmentValueUnit = (decimals: number): ValueUnit => ({ divisor: 1, label: "", decimals });

/** The message key of a unit's name. */
export const environmentUnitLabelKey = (unit: EnvironmentUnit) => `unit.${unit}`;

/** A tooltip or list value with its unit's name (a per cent or degree sign follows the number directly), or the missing dash. */
export function environmentValueLabel(value: number | null | undefined, unit: EnvironmentUnit, decimals: number, t: EnvironmentTranslate): string {
  if (value == null) return MISSING;
  const number = formatInUnit(value, environmentValueUnit(decimals));
  return unit === "percent" || unit === "celsius" ? `${number}${t(environmentUnitLabelKey(unit))}` : `${number}\u00a0${t(environmentUnitLabelKey(unit))}`;
}

/**
 * The message key of a series' name (`environment.{key}`). A station's averages and days are named by the station, a city's
 * limit is its yearly limit, a pollutant's rows by their source, a climate row by its place and an area row by its measure.
 */
export function environmentLabelKey(id: string): string {
  const [, topic, item, place] = id.split(".");
  if (topic === "aq") return item.endsWith("_limit") ? "series.limit" : `station.${place}`;
  if (topic === "air") return `series.air.${place}`;
  if (topic === "climate") return `series.climate.${place}`;
  return `series.${topic}.${item}`;
}

/**
 * Headings whose rows repeat one another's names: a pollutant's Total and its two sources, a place under each climate
 * measure, a station under each city measure, and the timber and logging rows of the Forests area pages.
 */
const NAMED_BY_HEADING = new Set<string>([...ENVIRONMENT_POLLUTANTS, "temperature", "anomaly", "precipitation", "pm10Avg", "pm25Avg", "no2Avg", "pm10Days", "tspAvg", "so2Avg", "mno2Avg", "timber", "protected"]);

/** A series' name outside the list (chart, table, workbook): a row whose name repeats under another heading carries its heading's text before the unit. */
export function environmentSeriesLabel(series: Pick<EnvironmentSeriesDefinition, "id" | "heading">, labels: Readonly<Record<string, string>>, t: EnvironmentTranslate): string {
  return NAMED_BY_HEADING.has(series.heading) ? `${labels[series.id]} — ${t(`heading.${series.heading}`).split(" · ")[0]}` : labels[series.id];
}
