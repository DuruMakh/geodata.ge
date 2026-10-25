import type { Locale } from "../../i18n/types";
import { ageSexEntries } from "./adapters/ageSex";
import { airQualityEntries } from "./adapters/airQuality";
import { areaFamilyEntries } from "./adapters/areaFamilies";
import { educationEntries } from "./adapters/education";
import { healthDeathsEntries } from "./adapters/healthDeaths";
import { householdEntries } from "./adapters/household";
import { inflationCityEntries } from "./adapters/inflationCities";
import { labourRegionEntries } from "./adapters/labourRegions";
import { marriageEntries } from "./adapters/marriages";
import { municipalBudgetEntries } from "./adapters/municipalBudget";
import { populationEntries } from "./adapters/population";
import { regionalEconomyEntries } from "./adapters/regionalEconomy";
import { socialEntries } from "./adapters/social";
import { vitalEntries } from "./adapters/vital";
import { loadPlaces } from "./places.server";
import type { PlaceAdapter, PlaceEntry, PlaceIndex } from "./types";

/** One adapter per place-page family. The municipal budget comes first: a place's own rows list it first. */
const ADAPTERS: readonly PlaceAdapter[] = [
  municipalBudgetEntries, populationEntries, ageSexEntries, vitalEntries, marriageEntries, educationEntries, socialEntries, inflationCityEntries,
  airQualityEntries, regionalEconomyEntries, areaFamilyEntries, householdEntries, labourRegionEntries, healthDeathsEntries,
];

const built = new Map<Locale, Promise<PlaceIndex>>();

async function build(locale: Locale): Promise<PlaceIndex> {
  const entries = (await Promise.all(ADAPTERS.map((adapter) => adapter(locale)))).flat();
  return { places: await loadPlaces(locale, entries), entries };
}

/** The places and every place page with its latest figure, built once per language for the build. */
export function buildPlaceIndex(locale: Locale): Promise<PlaceIndex> {
  if (!built.has(locale)) built.set(locale, build(locale));
  return built.get(locale)!;
}

/** The entries of one navigation page: its places' figures, for the page's region spread. */
export function entriesForPage(index: PlaceIndex, page: string): PlaceEntry[] {
  return index.entries.filter((entry) => entry.page === page);
}
