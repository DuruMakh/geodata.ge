import { loadServedMunicipalData } from "../../data/servedData";
import type { Locale } from "../../i18n/types";
import { loadPopulationBasics } from "../../pages/demography-population";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID } from "../demographyAreas";
import { populationMunicipalityCodeForSlug, populationMunicipalitySlugs } from "../demographyPlaceRoutes";
import { BIRTHS_DEATHS_PATH, POPULATION_PATH } from "../demographyRoutes";
import { formatPerResidentGel } from "../format";
import { buildMunicipalListRows, MUNICIPAL_PER_RESIDENT_YEAR } from "../municipalData";
import { MUNICIPAL_BUDGET_PAGE } from "./adapters/municipalBudget";
import type { Place, PlaceEntry, PlaceFact } from "./types";

/** The places with a page under each place-page family: Georgia, the 11 regions and the 63 municipalities (Tbilisi is a region). */
export async function placePageIds(): Promise<string[]> {
  const { regions } = await loadServedMunicipalData();
  return [GEORGIA_PLACE_ID, ...regions.map((region) => region.id), ...populationMunicipalitySlugs().map((slug) => populationMunicipalityCodeForSlug(slug)!)];
}

/**
 * The 74 places, named in both languages, with the card's four figures: the population, the budget and the births per 100
 * deaths the place's Population, Budget and Births pages state (`entries`), and the budget per resident the Budget index gives.
 */
export async function loadPlaces(locale: Locale, entries: readonly PlaceEntry[]): Promise<Place[]> {
  const [{ places }, { municipalities, regions, totalFacts, populationFacts, adjaraBudgetAdjustments }] = await Promise.all([loadPopulationBasics(locale), loadServedMunicipalData()]);
  const perResident = buildMunicipalListRows({
    municipalities, regionLabels: new Map(regions.map((region) => [region.id, region.kaLabel])), totalFacts, populationFacts, adjaraBudgetAdjustments, year: MUNICIPAL_PER_RESIDENT_YEAR,
  });
  const perResidentById = new Map([...perResident.regions, ...perResident.municipalities].map((row) => [row.id, row.budgetPerResidentGel]));
  const pageFact = (label: PlaceFact["label"], placeId: string, page: string): PlaceFact => {
    const entry = entries.find((candidate) => candidate.placeId === placeId && candidate.page === page);
    if (!entry) throw new Error(`No ${page} figure for ${placeId}`);
    return { label, value: entry.value, period: entry.period };
  };
  return places.filter((place) => place.level !== "country").map((place): Place => {
    const capital = place.id === TBILISI_PLACE_ID;
    return {
      id: place.id,
      kind: place.level === "region" ? "region" : "municipality",
      nameKa: place.nameKa,
      nameEn: place.nameEn,
      regionId: place.regionId ?? place.id,
      capital,
      ...(place.level === "region" && !capital ? { municipalityCount: place.municipalityCount } : {}),
      facts: [
        pageFact("population", place.id, POPULATION_PATH),
        pageFact("budget", place.id, MUNICIPAL_BUDGET_PAGE),
        { label: "perResident", value: formatPerResidentGel(perResidentById.get(place.id), locale), period: String(MUNICIPAL_PER_RESIDENT_YEAR) },
        pageFact("birthsPer100Deaths", place.id, BIRTHS_DEATHS_PATH),
      ],
    };
  });
}
