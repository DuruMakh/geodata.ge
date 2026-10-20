import { buildBreakRegister } from "../data/demography/breaks";
import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { Municipality, MunicipalRegion } from "../data/municipal/types";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { placeIndexRows } from "./demographyPopulationIndex";
import { formatInUnit, UNIT_DENSITY } from "./format";
import type { MunicipalListRow } from "./municipalData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "./municipalityMapData";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";
import { keepOneUnit } from "./unitList";

// The marriages and divorces page and the place pages' section: Georgia's counts with its average ages and marriage
// length, and every place's counts, as published or per 1,000 residents of Geostat's mid-year population.

export type MarriageSeriesId =
  | "marriages"
  | "divorces"
  | "age_marriage_male"
  | "age_marriage_female"
  | "age_first_marriage_male"
  | "age_first_marriage_female"
  | "age_divorce_male"
  | "age_divorce_female"
  | "duration";
export type MarriageHeading = "number" | "ageMarriage" | "ageDivorce" | "duration";
/** `group` is the list's unit: counts and years never share a chart. */
export type MarriageSeriesDefinition = { id: MarriageSeriesId; reference: boolean; heading: MarriageHeading; group: "count" | "years" };

/** The served series behind each row: its series id and, for an average age, the sex. */
const SOURCES: Record<MarriageSeriesId, { seriesId: string; sex?: "male" | "female" }> = {
  marriages: { seriesId: SERIES.marriages },
  divorces: { seriesId: SERIES.divorces },
  age_marriage_male: { seriesId: SERIES.meanAgeAtMarriage, sex: "male" },
  age_marriage_female: { seriesId: SERIES.meanAgeAtMarriage, sex: "female" },
  age_first_marriage_male: { seriesId: SERIES.meanAgeAtFirstMarriage, sex: "male" },
  age_first_marriage_female: { seriesId: SERIES.meanAgeAtFirstMarriage, sex: "female" },
  age_divorce_male: { seriesId: SERIES.meanAgeAtDivorce, sex: "male" },
  age_divorce_female: { seriesId: SERIES.meanAgeAtDivorce, sex: "female" },
  duration: { seriesId: SERIES.meanMarriageDuration },
};

const row = (id: MarriageSeriesId, heading: MarriageHeading): MarriageSeriesDefinition => ({ id, reference: false, heading, group: heading === "number" ? "count" : "years" });
export const MARRIAGE_SERIES: readonly MarriageSeriesDefinition[] = [
  row("marriages", "number"),
  row("divorces", "number"),
  row("age_marriage_male", "ageMarriage"),
  row("age_marriage_female", "ageMarriage"),
  row("age_first_marriage_male", "ageMarriage"),
  row("age_first_marriage_female", "ageMarriage"),
  row("age_divorce_male", "ageDivorce"),
  row("age_divorce_female", "ageDivorce"),
  row("duration", "duration"),
];
const COUNT_IDS: readonly MarriageSeriesId[] = ["marriages", "divorces"];
export const MARRIAGE_DEFAULT_SELECTION: readonly MarriageSeriesId[] = COUNT_IDS;
const groupOf = (id: string) => MARRIAGE_SERIES.find((series) => series.id === id)?.group;

export type MarriageMeasure = "count" | "per1000";
const MEASURES: readonly MarriageMeasure[] = ["count", "per1000"];
export type MarriageState = TopicState & { measure: MarriageMeasure };

export type ClientMarriageFact = { indicatorId: MarriageSeriesId; year: number; value: number; unit: "count" | "years" };
/** One place's rows as the browser receives them, with the mid-year population the per-1,000 view divides by. */
export type MarriagePlaceFacts = { facts: ClientMarriageFact[]; midYear: { year: number; persons: number }[] };

/**
 * One place's rows: the two counts unless `ids` asks for more (only Georgia has the average ages and length), and its
 * mid-year population in the years it has counts.
 */
export function marriageFactsForPlace(facts: readonly ServedDemographyObservation[], placeId: string, ids: readonly MarriageSeriesId[] = COUNT_IDS): MarriagePlaceFacts {
  const own = facts.filter((fact) => fact.geographyId === placeId);
  const rows = ids.flatMap((id) => {
    const { seriesId, sex } = SOURCES[id];
    return own
      .filter((fact) => fact.seriesId === seriesId && fact.sex === sex)
      .map((fact): ClientMarriageFact => ({ indicatorId: id, year: fact.year, value: fact.value, unit: groupOf(id)! }));
  });
  const years = new Set(rows.filter((fact) => fact.unit === "count").map((fact) => fact.year));
  const midYear = own
    .filter((fact) => fact.seriesId === SERIES.midYearPopulation && years.has(fact.year))
    .map((fact) => ({ year: fact.year, persons: fact.value }))
    .sort((left, right) => left.year - right.year);
  return { facts: rows, midYear };
}

/** Events per 1,000 of the mid-year population, Geostat's method for its crude rates; 15 digits remove the binary noise. */
export const perThousand = (count: number, persons: number): number => Number(((count * 1000) / persons).toPrecision(15));

export function defaultMarriageState(): MarriageState {
  return { mode: "line", range: { kind: "all" }, measure: "count", selectedIds: [...MARRIAGE_DEFAULT_SELECTION] };
}

const definitionsOf = (place: MarriagePlaceFacts) => MARRIAGE_SERIES.filter((series) => place.facts.some((fact) => fact.indicatorId === series.id));
const coverageOf = (place: MarriagePlaceFacts) => topicCoverage(place.facts.map((fact) => fact.year), "No marriage years");

/**
 * Reads the hash. `tab` names the measure (an unknown one is count). A selection mixing counts and years keeps the first
 * row's; one naming nothing the place has falls back to the counts; an explicit empty one stays empty.
 */
export function parseMarriageHash(hash: string, place: MarriagePlaceFacts): MarriageState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const measure = topicHashView(p, MEASURES);
  const { selectedIds, ...rest } = parseTopicHash(p, definitionsOf(place), MARRIAGE_DEFAULT_SELECTION, coverageOf(place));
  return { ...rest, measure, selectedIds: selectedIds.length || p.get("sel") === "" ? keepOneUnit(selectedIds, [], place.facts, groupOf) : [...MARRIAGE_DEFAULT_SELECTION] };
}

export function serializeMarriageHash(state: MarriageState): string {
  const p = new URLSearchParams();
  p.set("tab", state.measure);
  return serializeTopicHash(state, p);
}

/** A new selection, kept to counts or to years. */
export function changeMarriageSelection(state: MarriageState, next: readonly string[], place: MarriagePlaceFacts): MarriageState {
  return { ...state, selectedIds: keepOneUnit(next, state.selectedIds, place.facts, groupOf) };
}

export type MarriageSeriesModel = TopicSeriesModel<MarriageSeriesDefinition>;
export type MarriageModel = {
  range: ResolvedPeriodRange; years: number[]; series: MarriageSeriesModel[]; selected: MarriageSeriesModel[];
  unitKey: string; decimals: number;
  /** The census re-base of the population the rates divide by, when a rate is shown and the range crosses it. */
  breaks: { year: number; label: "newCounting" }[];
};

const CENSUS_BREAK = "census_recalculation_2025";

/**
 * The chart and table. Per 1,000 residents turns the two counts into rates (one decimal, a year without a mid-year
 * population has none) and leaves the ages and length as they are; the rates cross the census re-base of 2025.
 */
export function buildMarriageModel(place: MarriagePlaceFacts, state: MarriageState): MarriageModel {
  const definitions = definitionsOf(place);
  const persons = new Map(place.midYear.map((entry) => [entry.year, entry.persons]));
  const byCell = new Map(place.facts.map((fact) => [`${fact.indicatorId}|${fact.year}`, fact]));
  const rates = state.measure === "per1000";
  const model = buildTopicModel({
    range: state.range, coverage: coverageOf(place), selectedIds: state.selectedIds, definitions,
    color: (definition, index) => topicSeriesColor(definition, index),
    value: (definition, year) => {
      const fact = byCell.get(`${definition.id}|${year}`);
      if (!fact || !rates || fact.unit === "years") return fact?.value;
      const divisor = persons.get(year);
      return divisor === undefined ? null : perThousand(fact.value, divisor);
    },
  });
  const group = groupOf((model.selected[0] ?? definitions[0]).id);
  const unitKey = group === "years" ? "demography.marriageUnitYears" : rates ? "demography.marriageUnitPer1000" : "demography.marriageUnitCount";
  const census = buildBreakRegister().find((item) => item.breakId === CENSUS_BREAK)!;
  const year = Number(census.referenceDate.slice(0, 4));
  const crossed = rates && model.selected.some((series) => series.group === "count") && year > model.range.start && year <= model.range.end;
  return { ...model, unitKey, decimals: group === "years" || rates ? 1 : 0, breaks: crossed ? [{ year, label: "newCounting" }] : [] };
}

export type MarriageIndexModel = {
  year: number;
  map: MunicipalityMapModel;
  /** Value = marriages per 1,000 residents (unrounded), ranked highest first. */
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
  country: MunicipalListRow;
  /** Marriages and divorces of the latest year, by list row id (municipality code, region id, `country.georgia`). */
  countsById: Readonly<Record<string, { marriages: number; divorces: number }>>;
};

const isMunicipality = (id: string) => /^\d{2}$/.test(id);

/** The page's places block: the Budget index rows with marriages per 1,000 residents in the money-named `valueGel`, as the other Population indexes. */
export function buildMarriageIndexModel({
  facts,
  regions,
  municipalities,
}: {
  facts: readonly ServedDemographyObservation[];
  regions: readonly MunicipalRegion[];
  municipalities: Municipality[];
}): MarriageIndexModel {
  const municipalYears = facts.filter((fact) => fact.seriesId === SERIES.marriages && isMunicipality(fact.geographyId)).map((fact) => fact.year);
  if (municipalYears.length === 0) throw new Error("No municipal marriages for the index");
  const year = Math.max(...municipalYears);
  const valueOf = (seriesId: string, id: string): number => {
    const fact = facts.find((candidate) => candidate.seriesId === seriesId && candidate.geographyId === id && candidate.year === year);
    if (!fact) throw new Error(`No ${year} ${seriesId} for ${id}`);
    return fact.value;
  };
  const rate = (id: string) => perThousand(valueOf(SERIES.marriages, id), valueOf(SERIES.midYearPopulation, id));
  const values = new Map(municipalities.map((municipality) => [municipality.code, rate(municipality.code)]));
  const { municipalities: municipalityRows, regions: regionRows, country } = placeIndexRows({ regions, municipalities, valueOf: rate });
  const countsById = Object.fromEntries(
    [...municipalities.map((municipality) => municipality.code), ...regions.map((region) => region.id), GEORGIA_PLACE_ID].map((id) => [
      id,
      { marriages: valueOf(SERIES.marriages, id), divorces: valueOf(SERIES.divorces, id) },
    ]),
  );
  return {
    year,
    map: buildMunicipalityValueMapModel({ municipalities, values, display: (_code, value) => formatInUnit(value, UNIT_DENSITY) }),
    municipalities: municipalityRows,
    regions: regionRows,
    country,
    countsById,
  };
}
