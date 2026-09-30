import { CPI_CITY_IDS, type CpiCityId } from "../data/inflation/types";

// The cities section is a Georgia page plus one page per city
// (docs/superpowers/specs/2026-09-30-inflation-city-pages-design.md §2).
// A view names which of those pages is rendering.

export type CityView = { kind: "georgia" } | { kind: "city"; cityId: CpiCityId };
export const GEORGIA_VIEW: CityView = { kind: "georgia" };

export const CITIES_PATH = "/explorer/inflation/cities";

export function citySlug(cityId: CpiCityId): string {
  return cityId.slice("city.".length);
}

export function cityPageHref(cityId: CpiCityId): string {
  return `${CITIES_PATH}/${citySlug(cityId)}`;
}

export function cityIdForSlug(slug: string): CpiCityId | null {
  return CPI_CITY_IDS.find((cityId) => citySlug(cityId) === slug) ?? null;
}

/** Previous and next city in Geostat's order, wrapping, as region pages do. */
export function neighbourCities(cityId: CpiCityId): { previous: CpiCityId; next: CpiCityId } {
  const position = CPI_CITY_IDS.indexOf(cityId);
  const count = CPI_CITY_IDS.length;
  return { previous: CPI_CITY_IDS[(position - 1 + count) % count]!, next: CPI_CITY_IDS[(position + 1) % count]! };
}

export const CITY_PAGE_PATHS: string[] = CPI_CITY_IDS.map(cityPageHref);
