import { toClientEnvironmentFact, loadServedEnvironmentData } from "../../../data/environment/importEnvironment";
import { ENVIRONMENT_CITIES, type EnvironmentCity } from "../../../data/environment/types";
import { getPresentation } from "../../../i18n/presentation.server";
import { environmentLatest, environmentTranslate } from "../../environment";
import { placeIdForMunicipalityCode } from "../../demographyAreas";
import { AIR_QUALITY_PATH, environmentCityHeadline, environmentCityHref } from "../../environmentCities";
import { municipalityCodeForSlug } from "../../municipalityRoutes";
import type { PlaceAdapter } from "../types";

/** Geostat spells one city as its monitoring station does; the municipality's Budget slug spells it otherwise. */
const MUNICIPALITY_SLUG: Partial<Record<EnvironmentCity, string>> = { zestaponi: "zestafoni" };

/** Each city's yearly PM10 average at its first station (Zestaponi's dust) in the latest year, as its city page's line states it, captioned with
 * the measure as the Air quality card is. */
export const airQualityEntries: PlaceAdapter = async (locale) => {
  const [served, presentation] = await Promise.all([loadServedEnvironmentData(), getPresentation(locale, ["environment"], [])]);
  const facts = served.map(toClientEnvironmentFact);
  const t = environmentTranslate(presentation);
  return ENVIRONMENT_CITIES.map((city) => {
    const code = municipalityCodeForSlug(MUNICIPALITY_SLUG[city] ?? city);
    if (!code) throw new Error(`No municipality for the air-quality city ${city}`);
    const headline = environmentCityHeadline(city);
    const latest = environmentLatest(facts, headline, t);
    return { placeId: placeIdForMunicipalityCode(code), page: AIR_QUALITY_PATH, href: environmentCityHref(city), value: latest.value, number: latest.fact.value, period: String(latest.year), caption: `${t(`city.${city}`)}, ${t(headline.includes(".tsp_avg.") ? "latest.tsp" : "latest.pm10")}` };
  });
};
