import { loadServedInflationData } from "../../../data/inflation/importInflation";
import { CPI_CITY_IDS, cityFactInput } from "../../../data/inflation/types";
import { getMessages } from "../../../i18n/messages.server";
import { placeIdForMunicipalityCode } from "../../demographyAreas";
import { buildCityIndex, cityLatestHeadline } from "../../inflationCities";
import { CITIES_PATH, cityPageHref, citySlug } from "../../inflationCityRoutes";
import { formatInflationValue, periodLabel } from "../../inflationLabels";
import { municipalityCodeForSlug } from "../../municipalityRoutes";
import type { PlaceAdapter } from "../types";

/** Each city's annual inflation in the latest month, as its city page's line states it. A city is its municipality; Tbilisi is the capital region. */
export const inflationCityEntries: PlaceAdapter = async (locale) => {
  const [{ cities }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const index = buildCityIndex(cities.map(cityFactInput));
  return CPI_CITY_IDS.map((cityId) => {
    const latest = cityLatestHeadline(index, cityId);
    const code = municipalityCodeForSlug(citySlug(cityId));
    if (!latest || !code) throw new Error(`No annual rate or municipality for ${cityId}`);
    return {
      placeId: placeIdForMunicipalityCode(code), page: CITIES_PATH, href: cityPageHref(cityId),
      value: formatInflationValue(latest.value, "yoy"), number: latest.value, period: periodLabel(messages, latest.period, "short"),
    };
  });
};
