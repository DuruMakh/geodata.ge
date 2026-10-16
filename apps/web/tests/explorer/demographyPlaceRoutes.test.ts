import { beforeAll, describe, expect, test } from "vitest";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, buildDemographyPlaces, type DemographyPlace } from "../../lib/explorer/demographyAreas";
import {
  POPULATION_PATH,
  placeHrefById,
  placeNeighbours,
  placePageHref,
  placePagePaths,
  populationHrefById,
  populationMunicipalityCodeForSlug,
  populationMunicipalitySlugs,
  populationPlaceHref,
  populationPlacePaths,
} from "../../lib/explorer/demographyPlaceRoutes";
import { getPresentation } from "../../lib/i18n/presentation.server";

let places: DemographyPlace[];
let regionIds: string[];
const place = (id: string) => places.find((candidate) => candidate.id === id)!;

beforeAll(async () => {
  const municipal = await loadServedMunicipalData();
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map((region) => region.id), ...municipal.municipalities.map((m) => m.code)];
  const presentation = await getPresentation("en", [], ids);
  places = buildDemographyPlaces({
    regions: municipal.regions,
    municipalities: municipal.municipalities,
    englishLabels: presentation.englishLabels,
    georgiaNameKa: "საქართველო",
  });
  regionIds = municipal.regions.map((region) => region.id);
});

describe("place addresses", () => {
  test("Georgia, a region and a municipality each have their own address", () => {
    expect(populationPlaceHref(GEORGIA_PLACE_ID)).toBe("/explorer/demography/population/georgia");
    expect(populationPlaceHref("region.adjara")).toBe("/explorer/demography/population/region/adjara");
    expect(populationPlaceHref("06")).toBe("/explorer/demography/population/batumi");
    expect(populationPlaceHref("11")).toBe("/explorer/demography/population/khulo");
  });

  test("Tbilisi has the region address, whether it arrives as the region or as municipality 04", () => {
    expect(populationPlaceHref(TBILISI_PLACE_ID)).toBe("/explorer/demography/population/region/tbilisi");
    expect(populationPlaceHref("04")).toBe("/explorer/demography/population/region/tbilisi");
  });

  test("a municipality code the registry does not have has no address", () => {
    expect(() => populationPlaceHref("99")).toThrow(/No population page/);
  });

  test("75 pages: every place has one distinct address, every address is a route, and the address table covers every place and municipality 04", () => {
    const hrefs = places.map((p) => populationPlaceHref(p.id));
    expect(hrefs).toHaveLength(75);
    expect(new Set(hrefs).size).toBe(75);
    const paths = populationPlacePaths(regionIds);
    expect(paths).toHaveLength(75);
    expect(new Set(paths)).toEqual(new Set(hrefs));
    expect(hrefs.every((href) => href.startsWith(`${POPULATION_PATH}/`))).toBe(true);
    // The address table covers every place and municipality 04.
    const table = populationHrefById(places);
    expect(Object.keys(table)).toHaveLength(76);
    expect(table["04"]).toBe(table[TBILISI_PLACE_ID]);
    expect(table[GEORGIA_PLACE_ID]).toBe("/explorer/demography/population/georgia");
  });

  test("the municipality slugs are the Budget ones without Tbilisi, and Tbilisi's slug is not a route", () => {
    const slugs = populationMunicipalitySlugs();
    expect(slugs).toHaveLength(63);
    expect(slugs).not.toContain("tbilisi");
    expect(slugs.some((slug) => slug === "georgia" || slug === "region")).toBe(false);
    expect(populationMunicipalityCodeForSlug("batumi")).toBe("06");
    expect(populationMunicipalityCodeForSlug("tbilisi")).toBeNull();
    expect(populationMunicipalityCodeForSlug("nonsense")).toBeNull();
  });
});

describe("neighbours", () => {
  test("Georgia has none; regions and municipalities wrap round their own ring in registry order", () => {
    expect(placeNeighbours(place(GEORGIA_PLACE_ID), places)).toBeNull();
    const regions = places.filter((p) => p.level === "region").sort((a, b) => a.sortOrder - b.sortOrder);
    expect(placeNeighbours(regions[0]!, places)).toMatchObject({ prev: { id: regions.at(-1)!.id }, next: { id: regions[1]!.id } });
    expect(placeNeighbours(regions.at(-1)!, places)?.next.id).toBe(regions[0]!.id);
    const municipalities = places.filter((p) => p.level === "municipality").sort((a, b) => a.sortOrder - b.sortOrder);
    expect(municipalities).toHaveLength(63);
    expect(placeNeighbours(municipalities[0]!, places)?.prev.id).toBe(municipalities.at(-1)!.id);
    expect(municipalities.some((p) => p.id === TBILISI_PLACE_ID)).toBe(false);
  });
});

describe("place pages under another base path", () => {
  const SCHOOLS = "/explorer/education/schools";

  test("Georgia, a region and a municipality take the base path; Tbilisi is the region, municipality 04 included", () => {
    expect(placePageHref(SCHOOLS, "04")).toBe("/explorer/education/schools/region/tbilisi");
    expect(placePageHref(SCHOOLS, GEORGIA_PLACE_ID)).toBe("/explorer/education/schools/georgia");
    expect(placePageHref(SCHOOLS, "06")).toBe("/explorer/education/schools/batumi");
    expect(() => placePageHref(SCHOOLS, "99")).toThrow(/No schools page for 99/);
  });

  test("75 paths and 76 addresses, as under Population", () => {
    const paths = placePagePaths(SCHOOLS, regionIds);
    expect(paths).toHaveLength(75);
    expect(new Set(paths).size).toBe(75);
    expect(paths.every((path) => path.startsWith(`${SCHOOLS}/`))).toBe(true);
    const table = placeHrefById(SCHOOLS, places);
    expect(Object.keys(table)).toHaveLength(76);
    expect(table["04"]).toBe(table[TBILISI_PLACE_ID]);
    expect(new Set(Object.values(table))).toEqual(new Set(paths));
  });

  test("Population's addresses are the base-path ones with its own path, byte for byte", () => {
    for (const p of places) expect(populationPlaceHref(p.id)).toBe(placePageHref(POPULATION_PATH, p.id));
    expect(populationPlacePaths(regionIds)).toEqual(placePagePaths(POPULATION_PATH, regionIds));
    expect(populationHrefById(places)).toEqual(placeHrefById(POPULATION_PATH, places));
  });
});
