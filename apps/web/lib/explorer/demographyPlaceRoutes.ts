import { GEORGIA_PLACE_ID, placeIdForMunicipalityCode, type DemographyPlace } from "./demographyAreas";
import { POPULATION_PATH } from "./demographyRoutes";
import { MUNICIPALITY_ROUTES, municipalityCodeForSlug, municipalitySlugForCode } from "./municipalityRoutes";

// Defined with the Demography pages, so the address is written once; the place routes build on it and hand it on to their callers.
export { POPULATION_PATH };

/** Tbilisi has a municipality slug on the Budget pages; here it is a region and has the region page only. */
const TBILISI_SLUG = "tbilisi";

/** The address of a place's own page under a hub's base path: Georgia, a region, or one of the 63 municipalities. Municipality 04 is Tbilisi, a region. */
export function placePageHref<Base extends `/${string}`>(basePath: Base, placeId: string): `${Base}/${string}` {
  const id = placeIdForMunicipalityCode(placeId);
  if (id === GEORGIA_PLACE_ID) return `${basePath}/georgia`;
  if (id.startsWith("region.")) return `${basePath}/region/${id.slice("region.".length)}`;
  const slug = municipalitySlugForCode(id);
  if (slug === null) throw new Error(`No ${basePath.slice(basePath.lastIndexOf("/") + 1)} page for ${placeId}`);
  return `${basePath}/${slug}`;
}

/** The address of a place's own Population page. */
export const populationPlaceHref = (placeId: string): `${typeof POPULATION_PATH}/${string}` => placePageHref(POPULATION_PATH, placeId);

/** The 63 municipality slugs: every Budget slug except Tbilisi's. */
export function populationMunicipalitySlugs(): string[] {
  return MUNICIPALITY_ROUTES.filter((route) => route.slug !== TBILISI_SLUG).map((route) => route.slug);
}

/** The municipality code behind a municipality page's slug, or null for an unknown slug and for Tbilisi. */
export function populationMunicipalityCodeForSlug(slug: string): string | null {
  return slug === TBILISI_SLUG ? null : municipalityCodeForSlug(slug);
}

/** Every address under a base path by place id, plus municipality 04 (the map and the municipal lists name Tbilisi by it). Plain data, so a server page can hand it to a client component. */
export function placeHrefById(basePath: `/${string}`, places: readonly DemographyPlace[]): Record<string, string> {
  const hrefs: Record<string, string> = {};
  for (const place of places) hrefs[place.id] = placePageHref(basePath, place.id);
  hrefs["04"] = placePageHref(basePath, "04");
  return hrefs;
}

/** Every Population address by place id. */
export const populationHrefById = (places: readonly DemographyPlace[]): Record<string, string> => placeHrefById(POPULATION_PATH, places);

/** The addresses of all 75 place pages under a base path, for the sitemap and the inventory. */
export function placePagePaths(basePath: `/${string}`, regionIds: readonly string[]): string[] {
  return [
    `${basePath}/georgia`,
    ...regionIds.map((id) => `${basePath}/region/${id.slice("region.".length)}`),
    ...populationMunicipalitySlugs().map((slug) => `${basePath}/${slug}`),
  ];
}

/** The addresses of all 75 Population place pages. */
export const populationPlacePaths = (regionIds: readonly string[]): string[] => placePagePaths(POPULATION_PATH, regionIds);

/** The neighbours of a place in registry order within its own level, wrapping round. Georgia has none. */
export function placeNeighbours(
  place: DemographyPlace,
  places: readonly DemographyPlace[],
): { prev: DemographyPlace; next: DemographyPlace } | null {
  if (place.level === "country") return null;
  const ring = places.filter((candidate) => candidate.level === place.level).sort((left, right) => left.sortOrder - right.sortOrder);
  const index = ring.findIndex((candidate) => candidate.id === place.id);
  if (index === -1 || ring.length < 2) return null;
  return { prev: ring[(index - 1 + ring.length) % ring.length]!, next: ring[(index + 1) % ring.length]! };
}
