import { CRIME_INDICATORS, crimeFactKey, type ClientCrimeFact, type CrimeIndicator, type CrimeSeriesBreak } from "../data/crime/types";
import { buildBreakRegister } from "../data/demography/breaks";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicCoverage, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { keepOneUnit } from "./unitList";

export const CRIME_HUB_PATH = "/explorer/crime";

export const CRIME_SECTIONS = [
  { id: "recorded", href: `${CRIME_HUB_PATH}/recorded`, labelKey: "common.crimeRecorded" },
  { id: "convictions", href: `${CRIME_HUB_PATH}/convictions`, labelKey: "common.crimeConvictions" },
  { id: "prisons", href: `${CRIME_HUB_PATH}/prisons`, labelKey: "common.crimePrisons" },
  { id: "victims", href: `${CRIME_HUB_PATH}/victims`, labelKey: "common.crimeVictims" },
  { id: "road-accidents", href: `${CRIME_HUB_PATH}/road-accidents`, labelKey: "common.crimeRoadAccidents" },
] as const;
export type CrimeSectionId = typeof CRIME_SECTIONS[number]["id"];

/** `heading` names the group a row is listed under; the page total and the first road-accident row have no group of their own. */
export type CrimeHeading = "type" | "age" | "sex" | "sentence" | "status" | "citizenship" | "accidents" | "people";
export type CrimeSeriesDefinition = { id: CrimeIndicator; reference: boolean; heading?: CrimeHeading };

const ids = (prefix: string) => CRIME_INDICATORS.filter(id => id.startsWith(prefix));
const total = (id: CrimeIndicator): CrimeSeriesDefinition => ({ id, reference: true });
const under = (heading: CrimeHeading, list: readonly CrimeIndicator[], reference = false): CrimeSeriesDefinition[] =>
  list.map((id, index) => ({ id, reference: reference && index === 0, heading }));

/** The series a section offers, in the table order of the data (road accidents list people killed before injured), the page total first. */
export function crimeSeries(section: CrimeSectionId): CrimeSeriesDefinition[] {
  switch (section) {
    case "recorded": return [total("crime.recorded.total"), ...under("type", ids("crime.recorded.").filter(id => id !== "crime.recorded.total"))];
    case "convictions": return [total("crime.convicted.total"), ...under("type", ids("crime.convicted.type_")), ...under("age", ids("crime.convicted.age_")),
      ...under("sex", ids("crime.convicted.sex_")), ...under("sentence", ids("crime.convicted.sentence_"))];
    case "prisons": return [total("crime.prison.total"), ...under("sex", ["crime.prison.women", "crime.prison.men"]), ...under("age", ["crime.prison.adults", "crime.prison.juveniles"]),
      ...under("status", ["crime.prison.sentenced", "crime.prison.pretrial"])];
    case "victims": return [total("crime.victims.total"), ...under("sex", ids("crime.victims.sex_")), ...under("age", ids("crime.victims.age_")), ...under("citizenship", ids("crime.victims.citizenship_"))];
    case "road-accidents": return [...under("accidents", ["crime.road.accidents", "crime.road.accidents_drunk"], true), ...under("people", ["crime.road.killed", "crime.road.injured"])];
  }
}

export type CrimeMeasure = "count" | "per100k";
const MEASURES: readonly CrimeMeasure[] = ["count", "per100k"];
/** The population of Georgia on 1 January of each year, the divisor of the per-100,000 rate. */
export type CrimePopulation = readonly { year: number; persons: number }[];
export type CrimeMeasureFact = ClientCrimeFact & { decimals: number; calculated: boolean };

const PER_100K = 100000;
/** A count per `per` residents, rounded to 15 digits to remove the binary noise. Shared with Social protection's shares of residents. */
export const perPopulation = (count: number, persons: number, per: number): number => Number((count / persons * per).toPrecision(15));
/**
 * The facts a measure shows. Counts are the published whole numbers. The per-100,000 rate is the count divided by the
 * population of 1 January of the same year, times 100,000, shown with one decimal and marked calculated; a year
 * without population (2001-2003) has no rate. Rounding to 15 digits removes the binary noise.
 */
export function crimeMeasureFacts(measure: CrimeMeasure, facts: readonly ClientCrimeFact[], population: CrimePopulation): readonly CrimeMeasureFact[] {
  if (measure === "count") return facts.map(f => ({ ...f, decimals: 0, calculated: false }));
  const personsByYear = new Map(population.map(p => [p.year, p.persons]));
  return facts.flatMap(f => {
    const persons = personsByYear.get(f.year);
    return persons === undefined ? [] : [{ ...f, value: perPopulation(f.value, persons, PER_100K), decimals: 1, calculated: true }];
  });
}

const ACCIDENTS: readonly CrimeIndicator[] = ["crime.road.accidents", "crime.road.accidents_drunk"];
/** The message key of a series' unit. */
export function crimeUnitKey(measure: CrimeMeasure, indicatorId: string): string {
  if (measure === "per100k") return "crime.unitPer100k";
  if (indicatorId.startsWith("crime.recorded.")) return "crime.unitCrimes";
  return ACCIDENTS.includes(indicatorId as CrimeIndicator) ? "crime.unitAccidents" : "crime.unitPersons";
}

/** A section's years: every year any of its series has a count. The per-100,000 view keeps this range and shows the years without a rate as gaps. */
export function crimeCoverage(section: CrimeSectionId, facts: readonly ClientCrimeFact[]): TopicCoverage {
  const wanted = new Set<string>(crimeSeries(section).map(s => s.id));
  return topicCoverage(facts.filter(f => wanted.has(f.indicatorId)).map(f => f.year), `No crime years for ${section}`);
}

export const crimeDefaultSelection = (section: CrimeSectionId): string[] => [crimeSeries(section)[0].id];

export const crimeSeriesColor = (series: { id: string; reference: boolean }, index: number): string => topicSeriesColor(series, index);

export type CrimeState = TopicState & { measure: CrimeMeasure };

export function defaultCrimeState(section: CrimeSectionId): CrimeState {
  return { mode: "line", range: { kind: "all" }, measure: "count", selectedIds: crimeDefaultSelection(section) };
}

/**
 * Reads the hash. `tab` names the measure (an unknown one is count). A selection mixing units keeps the first row's
 * unit; one naming nothing the section has, such as a link from another section, falls back to the default; an
 * explicit empty one stays empty.
 */
export function parseCrimeHash(hash: string, section: CrimeSectionId, facts: readonly ClientCrimeFact[]): CrimeState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const measure = topicHashView(p, MEASURES);
  const fallback = crimeDefaultSelection(section);
  const { selectedIds, ...rest } = parseTopicHash(p, crimeSeries(section), fallback, crimeCoverage(section, facts));
  return { ...rest, measure, selectedIds: selectedIds.length || p.get("sel") === "" ? keepOneUnit(selectedIds, [], facts) : fallback };
}

export function serializeCrimeHash(state: CrimeState): string {
  const p = new URLSearchParams();
  p.set("tab", state.measure);
  return serializeTopicHash(state, p);
}

/** Switching measure keeps the selection, range and mode: both views cover the same years. */
export function changeCrimeMeasure(state: CrimeState, measure: CrimeMeasure): CrimeState {
  return { ...state, measure };
}

export type CrimeSeriesModel = TopicSeriesModel<CrimeSeriesDefinition & { decimals: number }>;
export type CrimeModel = {
  range: ResolvedPeriodRange; years: number[]; series: CrimeSeriesModel[]; selected: CrimeSeriesModel[];
  unitKey: string; decimals: number;
  /** The counting changes inside the range that touch the selection: the chart draws a gap and a rule, the table marks the year. */
  breaks: { year: number; label: "newCounting" }[];
};

/** The census recalculation of the 1 January population, which every rate on a population crosses. Shared with Social protection's shares of residents. */
export const CENSUS_BREAK = "census_recalculation_2025";
const breakYear = (item: { referenceDate: string }) => Number(item.referenceDate.slice(0, 4));

export function buildCrimeModel(section: CrimeSectionId, facts: readonly ClientCrimeFact[], population: CrimePopulation, state: CrimeState, breaks: readonly CrimeSeriesBreak[]): CrimeModel {
  const definitions = crimeSeries(section);
  const shown = crimeMeasureFacts(state.measure, facts, population);
  const byCell = new Map(shown.map(f => [crimeFactKey(f), f.value]));
  const decimals = state.measure === "per100k" ? 1 : 0;
  const model = buildTopicModel({
    range: state.range, coverage: crimeCoverage(section, facts), selectedIds: state.selectedIds, color: crimeSeriesColor,
    definitions: definitions.map(definition => ({ ...definition, decimals })),
    value: (definition, year) => byCell.get(crimeFactKey({ indicatorId: definition.id, year })),
  });
  const selected = new Set(state.selectedIds);
  // Population is recalculated at the census, so every rate crosses that break whatever is selected.
  const census = buildBreakRegister().find(item => item.breakId === CENSUS_BREAK)!;
  const applicable = [
    ...breaks.filter(item => item.appliesTo.some(id => selected.has(id))),
    ...(state.measure === "per100k" && selected.size ? [census] : []),
  ];
  const years = applicable.map(breakYear).filter(year => year > model.range.start && year <= model.range.end);
  const unitKey = crimeUnitKey(state.measure, (model.selected[0] ?? definitions[0]).id);
  return { ...model, unitKey, decimals, breaks: [...new Set(years)].sort((a, b) => a - b).map(year => ({ year, label: "newCounting" as const })) };
}
