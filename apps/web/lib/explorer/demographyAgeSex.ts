import { AGE_GROUPS, CENSUS_AGE_GROUPS, CENSUS_STEP, SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { ClientAgeFact } from "../servedRows";
import { projectAgeObservation } from "./clientData";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import type { ChartMode } from "./types";

/** The 18 age groups the pyramid draws, youngest first: the census's own grouping, where 0 and 1-4 of the annual table are one row. */
export const AGE_SEX_GROUPS = CENSUS_AGE_GROUPS.map((group) => group.id);
export type AgeSexGroup = (typeof CENSUS_AGE_GROUPS)[number]["id"];

/** "0–4", "85+": the id's numbers, language-neutral. */
export function ageGroupLabel(id: AgeSexGroup): string {
  const [from, to] = id.replace(/^age_/, "").split("_");
  return to === "plus" ? `${from}+` : `${from}–${to}`;
}

export type Pyramid = {
  /** Youngest first. */
  rows: { group: AgeSexGroup; male: number; female: number }[];
  male: number;
  female: number;
  total: number;
};

const ANNUAL_GROUP_IDS: readonly string[] = AGE_GROUPS.map((group) => group.id);
const CENSUS_GROUP_IDS: readonly string[] = CENSUS_AGE_GROUPS.map((group) => group.id);
const isPerson = (fact: ServedDemographyObservation) => fact.sex === "male" || fact.sex === "female";

/** Georgia's 1 January population by sex and the 19 published age rows, every year. */
export function annualAgeFacts(served: readonly ServedDemographyObservation[]): ClientAgeFact[] {
  return served
    .filter((fact) => fact.seriesId === SERIES.populationByAgeSex && fact.geographyId === GEORGIA_PLACE_ID && isPerson(fact) && ANNUAL_GROUP_IDS.includes(fact.ageGroup ?? ""))
    .map(projectAgeObservation);
}

/** A region's (or Georgia's) 2024 census count by sex, age group and settlement; a municipality has none. */
export function censusAgeFactsForPlace(served: readonly ServedDemographyObservation[], placeId: string): ClientAgeFact[] {
  return served
    .filter((fact) => fact.seriesId === SERIES.censusPopulationByAge && fact.geographyId === placeId && isPerson(fact) && CENSUS_GROUP_IDS.includes(fact.ageGroup ?? ""))
    .map(projectAgeObservation);
}

export function ageYears(facts: readonly ClientAgeFact[]): number[] {
  return [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);
}

function buildPyramid(count: (group: string, sex: ClientAgeFact["sex"]) => number | undefined, label: string): Pyramid {
  const need = (group: string, sex: ClientAgeFact["sex"]): number => {
    const value = count(group, sex);
    if (value === undefined) throw new Error(`Missing ${sex} count for ${group} (${label})`);
    return value;
  };
  const rows = AGE_SEX_GROUPS.map((group) => ({ group, male: need(group, "male"), female: need(group, "female") }));
  const male = rows.reduce((sum, row) => sum + row.male, 0);
  const female = rows.reduce((sum, row) => sum + row.female, 0);
  return { rows, male, female, total: male + female };
}

function cells(facts: readonly ClientAgeFact[]): Map<string, number> {
  return new Map(facts.map((fact) => [`${fact.year}|${fact.settlement}|${fact.sex}|${fact.ageGroup}`, fact.value]));
}

/** One 1 January: `age_0_4` is the annual table's `age_0` plus `age_1_4`. */
export function annualPyramid(facts: readonly ClientAgeFact[], year: number): Pyramid {
  const cell = cells(facts);
  const at = (group: string, sex: ClientAgeFact["sex"]) => cell.get(`${year}|total|${sex}|${group}`);
  return buildPyramid((group, sex) => {
    if (group !== "age_0_4") return at(group, sex);
    const [first, rest] = [at("age_0", sex), at("age_1_4", sex)];
    return first === undefined || rest === undefined ? undefined : first + rest;
  }, String(year));
}

/** The 2024 census count of one settlement type in the place the facts describe. */
export function censusPyramid(facts: readonly ClientAgeFact[], settlement: ClientAgeFact["settlement"]): Pyramid {
  const cell = new Map(facts.filter((fact) => fact.settlement === settlement).map((fact) => [`${fact.sex}|${fact.ageGroup}`, fact.value]));
  return buildPyramid((group, sex) => cell.get(`${sex}|${group}`), settlement);
}

/** A part as a percent of a total. */
export function shareOf(part: number, total: number): number {
  return (part / total) * 100;
}

const BAND_FIRST_OLD = AGE_SEX_GROUPS.indexOf("age_65_69");
const BAND_FIRST_WORKING = AGE_SEX_GROUPS.indexOf("age_15_19");

/** 0-14, 15-64 and 65+ as percents of the pyramid's total. */
export function bandShares(pyramid: Pyramid): { young: number; working: number; old: number } {
  const persons = (from: number, to: number) => pyramid.rows.slice(from, to).reduce((sum, row) => sum + row.male + row.female, 0);
  return {
    young: shareOf(persons(0, BAND_FIRST_WORKING), pyramid.total),
    working: shareOf(persons(BAND_FIRST_WORKING, BAND_FIRST_OLD), pyramid.total),
    old: shareOf(persons(BAND_FIRST_OLD, pyramid.rows.length), pyramid.total),
  };
}

export function womenPer100Men(pyramid: Pyramid): number {
  return (pyramid.female / pyramid.male) * 100;
}

/** The urban part of the place's census count, in percent. */
export function urbanShare(facts: readonly ClientAgeFact[]): number {
  return shareOf(censusPyramid(facts, "urban").total, censusPyramid(facts, "total").total);
}

/** Rows from 85+ at the top down to 0-4; each value is the group's share of that year's total, in percent. */
export function heatmapRows(facts: readonly ClientAgeFact[], years: readonly number[]): { rows: { id: AgeSexGroup; label: string; values: number[] }[]; maximum: number } {
  const pyramids = years.map((year) => annualPyramid(facts, year));
  const rows = AGE_SEX_GROUPS.map((id, index) => ({
    id,
    label: ageGroupLabel(id),
    values: pyramids.map((pyramid) => shareOf(pyramid.rows[index]!.male + pyramid.rows[index]!.female, pyramid.total)),
  })).reverse();
  return { rows, maximum: Math.max(...rows.flatMap((row) => row.values)) };
}

export type AgeMeasure = "share" | "persons";

export type AgeSexState = {
  year: number;
  /** A second year to set beside the first; null when none is chosen. */
  compare: number | null;
  measure: AgeMeasure;
  pyramidMode: ChartMode;
};

/** True when exactly one of the two years is on the census side of the 2025 re-base. */
export function crossesBreak(a: number, b: number): boolean {
  return a >= CENSUS_STEP.toYear !== b >= CENSUS_STEP.toYear;
}

/** Counts are not comparable across the re-base, so a comparison across it always shows shares. */
export function effectiveMeasure(state: AgeSexState): AgeMeasure {
  return state.compare !== null && crossesBreak(state.year, state.compare) ? "share" : state.measure;
}

function pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function yearParam(value: string | null, years: readonly number[]): number | null {
  const year = value === null ? NaN : Number(value);
  return Number.isInteger(year) && years.includes(year) ? year : null;
}

/** An unknown year falls back to the latest; a comparison that is unknown or equals the year is dropped. */
export function parseAgeSexHash(hash: string, years: readonly number[]): AgeSexState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const year = yearParam(params.get("year"), years) ?? years.at(-1)!;
  const compare = yearParam(params.get("cmp"), years);
  return {
    year,
    compare: compare === year ? null : compare,
    measure: pick(["share", "persons"], params.get("measure"), "share"),
    pyramidMode: pick(["line", "table"], params.get("pyramid"), "line"),
  };
}

export function serializeAgeSexHash(state: AgeSexState, years: readonly number[]): string {
  const params = new URLSearchParams();
  if (state.year !== years.at(-1)) params.set("year", String(state.year));
  if (state.compare !== null) params.set("cmp", String(state.compare));
  if (state.measure === "persons") params.set("measure", "persons");
  if (state.pyramidMode === "table") params.set("pyramid", "table");
  return params.toString();
}
