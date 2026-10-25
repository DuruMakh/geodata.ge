import { loadServedDemographyData } from "../../data/demography/importDemography";
import { loadServedMunicipalData } from "../../data/servedData";
import type { Locale } from "../../i18n/types";
import { loadPopulationBasics } from "../../pages/demography-population";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID } from "../demographyAreas";
import { populationMunicipalityCodeForSlug, populationMunicipalitySlugs } from "../demographyPlaceRoutes";
import { POPULATION_PATH } from "../demographyRoutes";
import { buildVitalIndexModel } from "../demographyVitalIndex";
import { formatInUnit, formatPerResidentGel, UNIT_PERSONS } from "../format";
import { buildMunicipalListRows, MUNICIPAL_PER_RESIDENT_YEAR } from "../municipalData";
import { MUNICIPAL_BUDGET_PAGE } from "./adapters/municipalBudget";
import type { Place, PlaceEntry, PlaceFact } from "./types";

/** The places with a page under each place-page family: Georgia, the 11 regions and the 63 municipalities (Tbilisi is a region). */
export async function placePageIds(): Promise<string[]> {
  const { regions } = await loadServedMunicipalData();
  return [GEORGIA_PLACE_ID, ...regions.map((region) => region.id), ...populationMunicipalitySlugs().map((slug) => populationMunicipalityCodeForSlug(slug)!)];
}

/**
 * Spellings in common use beside the site's own names, which search also reads: the air-quality page's `Zestaponi`, the
 * older `Ajara` and `Signagi`, the town `Stepantsminda` that names Kazbegi, and `q` for `ყ` as the national romanisation writes it.
 */
const PLACE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "region.adjara": ["Ajara", "Achara"],
  "14": ["Dedoplistsqaro"],
  "18": ["Signagi", "Sighnagi"],
  "19": ["Qvareli"],
  "22": ["Tqibuli"],
  "23": ["Tsqaltubo"],
  "26": ["Zestaponi"],
  "38": ["Chkhorotsqu"],
  "52": ["Tetritsqaro"],
  "68": ["Stepantsminda", "სტეფანწმინდა"],
};

/**
 * The 74 places, named in both languages, with the card's four figures: the population and the budget the place's Population
 * and Budget pages state (`entries`), the budget per resident the Budget index gives, and the births per 100 deaths the
 * Births page's places list gives.
 */
export async function loadPlaces(locale: Locale, entries: readonly PlaceEntry[]): Promise<Place[]> {
  const [{ places }, { municipalities, regions, totalFacts, populationFacts, adjaraBudgetAdjustments }, { facts: demography }] = await Promise.all([
    loadPopulationBasics(locale), loadServedMunicipalData(), loadServedDemographyData(),
  ]);
  const vital = buildVitalIndexModel({ facts: demography, regions, municipalities });
  const birthsPer100Deaths = new Map([...vital.municipalities, ...vital.regions].map((row) => [row.id, row.valueGel]));
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
      ...(PLACE_ALIASES[place.id] ? { aliases: [...PLACE_ALIASES[place.id]] } : {}),
      regionId: place.regionId ?? place.id,
      capital,
      ...(place.level === "region" && !capital ? { municipalityCount: place.municipalityCount } : {}),
      facts: [
        pageFact("population", place.id, POPULATION_PATH),
        pageFact("budget", place.id, MUNICIPAL_BUDGET_PAGE),
        { label: "perResident", value: formatPerResidentGel(perResidentById.get(place.id), locale), period: String(MUNICIPAL_PER_RESIDENT_YEAR) },
        { label: "birthsPer100Deaths", value: formatInUnit(birthsPer100Deaths.get(place.id)!, UNIT_PERSONS), period: String(vital.year) },
      ],
    };
  });
}
