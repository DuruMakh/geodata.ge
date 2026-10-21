import { ENVIRONMENT_CITIES, ENVIRONMENT_MANUAL_MEASURES, ENVIRONMENT_STATION_MEASURES, ENVIRONMENT_STATIONS, type ClientEnvironmentFact, type EnvironmentCity } from "../data/environment/types";
import { OTHER_COLOR } from "./colors";
import {
  ENVIRONMENT_SECTIONS, buildEnvironmentSeriesModel, changeEnvironmentListSelection, environmentListCoverage, parseEnvironmentListHash, withFacts,
  type EnvironmentModel, type EnvironmentSeriesDefinition, type EnvironmentState,
} from "./environment";
import { topicSeriesColor } from "./topicSeries";

/** The City air quality index, whose cards open the nine city pages at `<index>/<city>`. */
export const AIR_QUALITY_PATH = ENVIRONMENT_SECTIONS.find(section => section.id === "air-quality")!.href;
export const environmentCityHref = (city: EnvironmentCity): `/${string}` => `${AIR_QUALITY_PATH}/${city}`;
export const environmentCityForSlug = (slug: string): EnvironmentCity | null => ENVIRONMENT_CITIES.find(city => city === slug) ?? null;

/** Previous and next city in Geostat's order, wrapping, as the inflation city pages do. */
export function neighbourEnvironmentCities(city: EnvironmentCity): { previous: EnvironmentCity; next: EnvironmentCity } {
  const position = ENVIRONMENT_CITIES.indexOf(city), count = ENVIRONMENT_CITIES.length;
  return { previous: ENVIRONMENT_CITIES[(position - 1 + count) % count], next: ENVIRONMENT_CITIES[(position + 1) % count] };
}

export const environmentCityStations = (city: EnvironmentCity) => ENVIRONMENT_STATIONS.filter(station => station.city === city).map(station => station.id);

/**
 * A city's list: each measure's stations in Geostat's order then the city's yearly limit (dashed, grey), then the days over
 * the daily PM10 limit at each station. Zestaponi's manual station measures dust, sulphur dioxide, nitrogen dioxide and
 * manganese dioxide, with no yearly limit. Rows and headings the city never published are dropped.
 */
export function environmentCitySeries(city: EnvironmentCity, facts: readonly ClientEnvironmentFact[]): EnvironmentSeriesDefinition[] {
  const stations = environmentCityStations(city);
  const definitions: EnvironmentSeriesDefinition[] = city === "zestaponi"
    ? ENVIRONMENT_MANUAL_MEASURES.map(measure => ({ id: `environment.aq.${measure}_avg.zestaponi_e1`, reference: false, heading: `${measure}Avg` }))
    : [
      ...ENVIRONMENT_STATION_MEASURES.flatMap(measure => [
        ...stations.map(id => ({ id: `environment.aq.${measure}_avg.${id}`, reference: false, heading: `${measure}Avg` })),
        { id: `environment.aq.${measure}_limit.${city}`, reference: false, heading: `${measure}Avg`, stroke: "dashed" as const, color: OTHER_COLOR },
      ]),
      ...stations.map(id => ({ id: `environment.aq.pm10_days.${id}`, reference: false, heading: "pm10Days" })),
    ];
  return withFacts(definitions, facts);
}

/** The PM10 average at every station of the city and the PM10 limit; Zestaponi's dust. */
export function environmentCityDefaultSelection(city: EnvironmentCity, facts: readonly ClientEnvironmentFact[]): string[] {
  const series = environmentCitySeries(city, facts);
  return city === "zestaponi" ? [series[0].id] : series.filter(s => s.heading === "pm10Avg").map(s => s.id);
}

/** A limit wears the shared grey; a station keeps one colour under every measure, by its place in the city. */
export function environmentCityColor(definition: EnvironmentSeriesDefinition): string {
  if (definition.color) return definition.color;
  const station = definition.id.split(".")[3];
  const position = ENVIRONMENT_STATIONS.filter(s => s.city === ENVIRONMENT_STATIONS.find(other => other.id === station)!.city).findIndex(s => s.id === station);
  return topicSeriesColor(definition, position, `environment.station.${position}`);
}

export const environmentCityCoverage = (city: EnvironmentCity, facts: readonly ClientEnvironmentFact[], selectedIds: readonly string[] = []) =>
  environmentListCoverage(environmentCitySeries(city, facts), selectedIds, facts);

/** Reads a city page's view; a selection from another city names none of this city's stations and falls back to its default. */
export const parseEnvironmentCityHash = (hash: string, city: EnvironmentCity, facts: readonly ClientEnvironmentFact[]): EnvironmentState =>
  parseEnvironmentListHash(hash, environmentCitySeries(city, facts), environmentCityDefaultSelection(city, facts), facts);

export const changeEnvironmentCitySelection = (city: EnvironmentCity, state: EnvironmentState, next: readonly string[], facts: readonly ClientEnvironmentFact[]): EnvironmentState =>
  changeEnvironmentListSelection(state, environmentCitySeries(city, facts), next, facts);

export const buildEnvironmentCityModel = (city: EnvironmentCity, facts: readonly ClientEnvironmentFact[], state: EnvironmentState): EnvironmentModel =>
  buildEnvironmentSeriesModel(environmentCitySeries(city, facts), facts, state, environmentCityColor);

/** The station average a city's card and line follow: its first station's PM10, Zestaponi's dust. */
export const environmentCityHeadline = (city: EnvironmentCity) =>
  city === "zestaponi" ? "environment.aq.tsp_avg.zestaponi_e1" : `environment.aq.pm10_avg.${environmentCityStations(city)[0]}`;

/** The station with the highest yearly PM10 average in the latest year any station has one: the City air quality index's line. */
export function environmentHighestPm10(facts: readonly ClientEnvironmentFact[]): { city: EnvironmentCity; indicatorId: string; year: number; value: number } {
  const pm10 = facts.filter(f => f.indicatorId.startsWith("environment.aq.pm10_avg."));
  const year = Math.max(...pm10.map(f => f.year));
  const highest = pm10.filter(f => f.year === year).sort((a, b) => b.value - a.value)[0];
  const station = ENVIRONMENT_STATIONS.find(s => s.id === highest.indicatorId.split(".")[3])!;
  return { city: station.city, indicatorId: highest.indicatorId, year, value: highest.value };
}
