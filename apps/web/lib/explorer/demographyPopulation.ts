import { CENSUS_STEP, SERIES, populationEstimateBasis } from "../data/demography/series";
import type { Locale } from "../i18n/types";
import type { ClientDemographyObservation } from "../servedRows";
import {
  GEORGIA_PLACE_ID,
  TBILISI_PLACE_ID,
  placeColor,
  placeIdForMunicipalityCode,
  placeLabel,
  placesAtLevel,
  type DemographyPlace,
} from "./demographyAreas";
import { resolveRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export type PopulationLevel = "regions" | "municipalities";
export type PopulationMapMeasure = "population" | "density";

export type PopulationState = {
  /** Place ids; Tbilisi is `region.tbilisi`. */
  selectedIds: string[];
  level: PopulationLevel;
  map: PopulationMapMeasure;
  mode: "line" | "table";
  range: PeriodRange;
};

export const DEFAULT_POPULATION_STATE: PopulationState = {
  selectedIds: [GEORGIA_PLACE_ID],
  level: "regions",
  map: "population",
  mode: "line",
  range: { kind: "all" },
};

/** Unknown values are rejected, duplicates removed; an absent `sel` means Georgia only and an explicit empty one stays empty. */
export function parsePopulationHash(hash: string, validIds: readonly string[]): PopulationState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const level: PopulationLevel = params.get("level") === "municipalities" ? "municipalities" : "regions";
  return {
    selectedIds: params.has("sel")
      ? [...new Set(params.get("sel")!.split(",").map(placeIdForMunicipalityCode))].filter((id) => validIds.includes(id))
      : [GEORGIA_PLACE_ID],
    level,
    // Density is published for Georgia and the regions only.
    map: level === "regions" && params.get("map") === "density" ? "density" : "population",
    mode: params.get("view") === "table" ? "table" : "line",
    range: parseYearRangeKeys(params),
  };
}

export function serializePopulationHash(state: PopulationState): string {
  const params = new URLSearchParams({
    sel: state.selectedIds.join(","),
    level: state.level,
    map: state.map,
    view: state.mode,
  });
  writeYearRangeKeys(params, state.range);
  return params.toString();
}

/** Choosing a place on a map replaces the selection with that place alone. */
export function chooseOnMap(state: PopulationState, id: string): PopulationState {
  return { ...state, selectedIds: [id] };
}

export function chooseGeorgia(state: PopulationState): PopulationState {
  return { ...state, selectedIds: [GEORGIA_PLACE_ID] };
}

/** The selection survives a level change; density does not exist below the regions, so the map falls back to population. */
export function changeLevel(state: PopulationState, level: PopulationLevel): PopulationState {
  return { ...state, level, map: level === "municipalities" ? "population" : state.map };
}

export function changeMeasure(state: PopulationState, map: PopulationMapMeasure): PopulationState {
  return state.level === "municipalities" ? state : { ...state, map };
}

/** Ticking a place in the list adds it to, or removes it from, the selection. */
export function toggleSelected(state: PopulationState, id: string): PopulationState {
  return {
    ...state,
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter((selected) => selected !== id)
      : [...state.selectedIds, id],
  };
}

/** Select all or clear for the places of the active tab; places chosen under the other tab are left as they are. */
export function setTabSelection(state: PopulationState, tabIds: readonly string[], selected: boolean): PopulationState {
  const tab = new Set(tabIds);
  return {
    ...state,
    selectedIds: selected
      ? [...state.selectedIds, ...tabIds.filter((id) => !state.selectedIds.includes(id))]
      : state.selectedIds.filter((id) => !tab.has(id)),
  };
}

/** Georgia first, then by the value at the end of the range (descending, missing last), ties by registry order. */
export function rankPlaces(
  places: readonly DemographyPlace[],
  endValues: Readonly<Record<string, number | null>>,
): DemographyPlace[] {
  return [...places].sort((left, right) => {
    if (left.id === GEORGIA_PLACE_ID) return -1;
    if (right.id === GEORGIA_PLACE_ID) return 1;
    const leftValue = endValues[left.id] ?? null;
    const rightValue = endValues[right.id] ?? null;
    if (leftValue === null && rightValue !== null) return 1;
    if (rightValue === null && leftValue !== null) return -1;
    return (
      (leftValue !== null && rightValue !== null ? rightValue - leftValue : 0) ||
      left.sortOrder - right.sortOrder ||
      left.id.localeCompare(right.id)
    );
  });
}

export function buildPopulationModel({
  facts,
  places,
  state,
  locale,
}: {
  facts: readonly ClientDemographyObservation[];
  places: readonly DemographyPlace[];
  state: PopulationState;
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
    ...resolveRange(state.range, { min: availableYears[0]!, max: availableYears.at(-1)! }),
  };
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const valueAt = (id: string, year: number): number | null => byCell.get(`${id}:${year}`) ?? null;
  const endValues = Object.fromEntries(places.map((place) => [place.id, valueAt(place.id, range.end)]));
  const ranked = rankPlaces(places, endValues);
  const listed = placesAtLevel(ranked, state.level);
  const selected = ranked.filter((place) => state.selectedIds.includes(place.id));
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
    listed,
    selected,
    rows,
    series,
    endValues,
    valueAt,
    firstSelected: selected[0] ?? null,
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

type Figure = { place: DemographyPlace; value: number; trend: Array<number | null> };

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
 * The highlights describe the first selected place for the end year of the range. Nothing here is a
 * change over time, so nothing spans the census re-base (foundation section 5, R4).
 */
export function buildPopulationHighlights(
  model: PopulationModel,
  facts: readonly ClientDemographyObservation[],
  places: readonly DemographyPlace[],
): PopulationHighlights | null {
  const place = model.firstSelected;
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
