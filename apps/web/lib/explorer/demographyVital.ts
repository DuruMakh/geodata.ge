import { SERIES } from "../data/demography/series";
import type { ServedDemographyObservation } from "../data/demography/types";
import type { ClientDemographyObservation } from "../servedRows";
import { projectDemographyObservation } from "./clientData";

/** The three series a place page's births-and-deaths section reads. Counts only: none of them breaks at the census re-base. */
export const VITAL_PLACE_SERIES: readonly string[] = [SERIES.liveBirths, SERIES.deaths, SERIES.naturalIncrease];

export type VitalStreak =
  | { kind: "deaths-ahead"; since: number; wholeSeries: boolean }
  | { kind: "births-ahead"; year: number }
  | { kind: "even"; year: number };

export type VitalPlaceModel = {
  placeId: string;
  years: number[];
  births: Record<number, number | null>;
  deaths: Record<number, number | null>;
  natural: Record<number, number | null>;
  latest: { year: number; births: number; deaths: number; natural: number; ratio: number | null };
  streak: VitalStreak;
};

/** 100 × births / deaths, unrounded; no value when there were no deaths. */
export function birthsPer100Deaths(births: number, deaths: number): number | null {
  return deaths > 0 ? (100 * births) / deaths : null;
}

/** One place's births, deaths and natural increase, as the browser receives them: never every place's 2,511 rows. */
export function vitalFactsForPlace(facts: readonly ServedDemographyObservation[], placeId: string): ClientDemographyObservation[] {
  return facts.filter((fact) => fact.geographyId === placeId && VITAL_PLACE_SERIES.includes(fact.seriesId)).map(projectDemographyObservation);
}

/** The unbroken run of years, ending at the last year, in which deaths exceeded births. An equal or missing year ends it. */
export function vitalStreak(
  years: readonly number[],
  births: Record<number, number | null>,
  deaths: Record<number, number | null>,
): VitalStreak {
  let since: number | null = null;
  for (let index = years.length - 1; index >= 0; index -= 1) {
    const year = years[index]!;
    const [born, died] = [births[year], deaths[year]];
    if (born === null || born === undefined || died === null || died === undefined || died <= born) break;
    since = year;
  }
  const last = years.at(-1)!;
  if (since !== null) return { kind: "deaths-ahead", since, wholeSeries: since === years[0] };
  return births[last] === deaths[last] ? { kind: "even", year: last } : { kind: "births-ahead", year: last };
}

export function buildVitalPlaceModel(facts: readonly ClientDemographyObservation[], placeId: string): VitalPlaceModel | null {
  const own = facts.filter((fact) => fact.geographyId === placeId);
  const years = [...new Set(own.map((fact) => fact.year))].sort((left, right) => left - right);
  if (years.length === 0) return null;
  const series = (seriesId: string): Record<number, number | null> =>
    Object.fromEntries(years.map((year) => [year, own.find((fact) => fact.seriesId === seriesId && fact.year === year)?.value ?? null]));
  const births = series(SERIES.liveBirths);
  const deaths = series(SERIES.deaths);
  const natural = series(SERIES.naturalIncrease);
  const year = years.at(-1)!;
  const [born, died, net] = [births[year], deaths[year], natural[year]];
  if (born === null || died === null || net === null) throw new Error(`No ${year} births, deaths or natural increase for ${placeId}`);
  return {
    placeId,
    years,
    births,
    deaths,
    natural,
    latest: { year, births: born, deaths: died, natural: net, ratio: birthsPer100Deaths(born, died) },
    streak: vitalStreak(years, births, deaths),
  };
}
