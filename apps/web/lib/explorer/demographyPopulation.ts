import { CENSUS_STEP, SERIES, populationEstimateBasis } from "../data/demography/series";
import type { Locale } from "../i18n/types";
import type { ClientDemographyObservation } from "../servedRows";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  placeColor,
  placeIdForMunicipalityCode,
  placeLabel,
  type DemographyPlace,
} from "./demographyAreas";
import { resolveRange, type PeriodRange } from "./periodRange";
import { rankByEndValue } from "./regionalEconomies";

/** What a place page asks the model for: the places drawn and the period. */
export type PopulationQuery = {
  /** Place ids; Tbilisi is `region.tbilisi`. */
  selectedIds: readonly string[];
  range: PeriodRange;
};

/** Georgia first, then by the value at the end of the range (descending, missing last), ties by registry order. */
export function rankPlaces(
  places: readonly DemographyPlace[],
  endValues: Readonly<Record<string, number | null>>,
): DemographyPlace[] {
  return rankByEndValue(places, endValues, GEORGIA_PLACE_ID);
}

export function buildPopulationModel({
  facts,
  places,
  query,
  locale,
}: {
  facts: readonly ClientDemographyObservation[];
  places: readonly DemographyPlace[];
  query: PopulationQuery;
  locale: Locale;
}) {
  const byCell = new Map<string, number>();
  const yearSet = new Set<number>();
  for (const fact of facts) {
    if (fact.seriesId !== SERIES.populationTotal) continue;
    // Municipality 04 and the region of Tbilisi carry the same number; both land on one cell.
    byCell.set(`${placeIdForMunicipalityCode(fact.geographyId)}:${fact.year}`, fact.value);
    yearSet.add(fact.year);
  }
  const availableYears = [...yearSet].sort((left, right) => left - right);
  if (availableYears.length === 0) throw new Error("No population years are available");
  const range = {
    availableYears,
    ...resolveRange(query.range, { min: availableYears[0]!, max: availableYears.at(-1)! }),
  };
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const valueAt = (id: string, year: number): number | null => byCell.get(`${id}:${year}`) ?? null;
  const endValues = Object.fromEntries(places.map((place) => [place.id, valueAt(place.id, range.end)]));
  const ranked = rankPlaces(places, endValues);
  const selected = ranked.filter((place) => query.selectedIds.includes(place.id));
  const rows = selected.map((place) => ({
    itemId: place.id,
    kaLabel: placeLabel(place, locale),
    color: placeColor(place),
    valuesByYear: Object.fromEntries(years.map((year) => [year, valueAt(place.id, year)])),
  }));
  const series = selected.map((place) => ({
    id: place.id,
    label: placeLabel(place, locale),
    color: placeColor(place),
    vals: years.map((year) => valueAt(place.id, year)),
    planned: years.map(() => false),
  }));
  return {
    range,
    years,
    availableYears,
    ranked,
    selected,
    rows,
    series,
    endValues,
    valueAt,
    hasData: selected.some((place) => years.some((year) => valueAt(place.id, year) !== null)),
  };
}

export type PopulationModel = ReturnType<typeof buildPopulationModel>;

/** The message key for the plain-language lineage of a 1 January population (foundation section 5, R6). */
export function populationBasisKey(year: number) {
  const basis = populationEstimateBasis(year);
  if (basis === "retro_projection") return "demography.basisRetro";
  return basis === "census_based" ? "demography.basisCensus" : "demography.basisPre";
}

/**
 * One series over the range for a sparkline, with a null where the census re-base falls between two of
 * its years so the line is drawn in two segments (foundation section 5, R1).
 */
export function sparkValues(
  years: readonly number[],
  valueAt: (year: number) => number | null,
): Array<number | null> {
  const values: Array<number | null> = [];
  for (const year of years) {
    if (year === CENSUS_STEP.toYear && years.includes(CENSUS_STEP.fromYear)) values.push(null);
    values.push(valueAt(year));
  }
  return values;
}

export type Figure = { place: DemographyPlace; value: number; trend: Array<number | null> };

type HighlightBase = {
  place: DemographyPlace;
  year: number;
  persons: number | null;
  trend: Array<number | null>;
  /** The first year a region or municipality has a value: what the page says when the range ends before it. */
  regionalFrom: number | null;
};

export type PopulationHighlights =
  | (HighlightBase & {
      kind: "country";
      largestRegion: Figure | null;
      densestRegion: Figure | null;
      smallestMunicipality: Figure | null;
    })
  | (HighlightBase & {
      kind: "region";
      shareOfGeorgia: number | null;
      rank: number | null;
      ofRegions: number;
      density: number | null;
      densityRank: number | null;
      densityTrend: Array<number | null>;
      municipalityCount: number;
    })
  | (HighlightBase & {
      kind: "municipality";
      shareOfRegion: number | null;
      regionPersons: number | null;
      rank: number | null;
      ofMunicipalities: number;
      shareOfGeorgia: number | null;
      region: DemographyPlace | null;
    });

function extreme(
  group: readonly DemographyPlace[],
  valueOf: (id: string) => number | null,
  pick: "max" | "min",
): { place: DemographyPlace; value: number } | null {
  let best: { place: DemographyPlace; value: number } | null = null;
  for (const place of group) {
    const value = valueOf(place.id);
    if (value === null) continue;
    const better =
      best === null ||
      (pick === "max" ? value > best.value : value < best.value) ||
      (value === best.value && place.sortOrder < best.place.sortOrder);
    if (better) best = { place, value };
  }
  return best;
}

function rankOf(group: readonly DemographyPlace[], id: string, valueOf: (id: string) => number | null): number | null {
  const ranked = group
    .map((place) => ({ place, value: valueOf(place.id) }))
    .filter((entry): entry is { place: DemographyPlace; value: number } => entry.value !== null)
    .sort((left, right) => right.value - left.value || left.place.sortOrder - right.place.sortOrder);
  const index = ranked.findIndex((entry) => entry.place.id === id);
  return index === -1 ? null : index + 1;
}

const fraction = (part: number | null, whole: number | null) =>
  part === null || whole === null || whole === 0 ? null : part / whole;

/**
 * The highlights describe one place, for the end year of the range. Nothing here is a change over time,
 * so nothing spans the census re-base (foundation section 5, R4).
 */
export function buildPopulationHighlights(
  model: PopulationModel,
  facts: readonly ClientDemographyObservation[],
  places: readonly DemographyPlace[],
  placeId: string,
): PopulationHighlights | null {
  const place = places.find((candidate) => candidate.id === placeId);
  if (!place) return null;
  const { years, valueAt } = model;
  const year = model.range.end;
  const densityByCell = new Map<string, number>();
  const regionalYears: number[] = [];
  for (const fact of facts) {
    if (fact.seriesId === SERIES.populationDensity) densityByCell.set(`${fact.geographyId}:${fact.year}`, fact.value);
    if (fact.seriesId === SERIES.populationTotal && fact.geographyId.startsWith("region.")) regionalYears.push(fact.year);
  }
  const densityAt = (id: string, atYear: number) => densityByCell.get(`${id}:${atYear}`) ?? null;
  const personsOf = (id: string) => valueAt(id, year);
  const densityOf = (id: string) => densityAt(id, year);
  const trendOf = (id: string) => sparkValues(years, (atYear) => valueAt(id, atYear));
  const densityTrendOf = (id: string) => sparkValues(years, (atYear) => densityAt(id, atYear));
  const regions = places.filter((candidate) => candidate.level === "region");
  const municipalities = places.filter(
    (candidate) => candidate.level === "municipality" || candidate.id === TBILISI_PLACE_ID,
  );
  const base: HighlightBase = {
    place,
    year,
    persons: personsOf(place.id),
    trend: trendOf(place.id),
    regionalFrom: regionalYears.length > 0 ? Math.min(...regionalYears) : null,
  };

  if (place.level === "country") {
    const figure = (found: { place: DemographyPlace; value: number } | null, trend: (id: string) => Array<number | null>): Figure | null =>
      found && { ...found, trend: trend(found.place.id) };
    return {
      ...base,
      kind: "country",
      largestRegion: figure(extreme(regions, personsOf, "max"), trendOf),
      densestRegion: figure(extreme(regions, densityOf, "max"), densityTrendOf),
      smallestMunicipality: figure(extreme(municipalities, personsOf, "min"), trendOf),
    };
  }

  const georgia = personsOf(GEORGIA_PLACE_ID);
  if (place.level === "region") {
    return {
      ...base,
      kind: "region",
      shareOfGeorgia: fraction(base.persons, georgia),
      rank: rankOf(regions, place.id, personsOf),
      ofRegions: regions.length,
      density: densityOf(place.id),
      densityRank: rankOf(regions, place.id, densityOf),
      densityTrend: densityTrendOf(place.id),
      municipalityCount: place.municipalityCount,
    };
  }

  const regionPersons = place.regionId === null ? null : personsOf(place.regionId);
  return {
    ...base,
    kind: "municipality",
    shareOfRegion: fraction(base.persons, regionPersons),
    regionPersons,
    rank: rankOf(municipalities, place.id, personsOf),
    ofMunicipalities: municipalities.length,
    shareOfGeorgia: fraction(base.persons, georgia),
    region: places.find((candidate) => candidate.id === place.regionId) ?? null,
  };
}
