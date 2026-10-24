import { REGIONAL_ECONOMY_REGIONS } from "../../../data/regionalEconomies/importRegionalEconomies";
import { loadServedUnemploymentData } from "../../../data/unemployment/importUnemployment";
import { loadServedWagesData, toClientWagesFact } from "../../../data/wages/importWages";
import { WAGES_REGIONS } from "../../../data/wages/types";
import { message } from "../../../i18n/messages";
import { getMessages } from "../../../i18n/messages.server";
import type { Locale, Messages } from "../../../i18n/types";
import { GEORGIA_PLACE_ID } from "../../demographyAreas";
import { formatInUnit } from "../../format";
import { formatUnemploymentValue, unemploymentPlaceLatest } from "../../unemployment";
import { unemploymentRegionHref } from "../../unemploymentRegionRoutes";
import { UNEMPLOYMENT_SECTIONS } from "../../unemploymentSections";
import { WAGES_SECTIONS, wagesPlaceLatest, wagesRegionHref } from "../../wages";
import type { PlaceAdapter, PlaceEntry } from "../types";

const UNEMPLOYMENT_REGIONS_PAGE = UNEMPLOYMENT_SECTIONS.find((section) => section.id === "regions")!.href;
const WAGES_REGIONS_PAGE = WAGES_SECTIONS.find((section) => section.id === "regions")!.href;

/** The unemployment rate of each region, and Georgia's on the Regions page itself, in its latest year. */
async function unemployment(messages: Messages): Promise<PlaceEntry[]> {
  const { facts } = await loadServedUnemploymentData();
  return [undefined, ...REGIONAL_ECONOMY_REGIONS.map((region) => region.id)].flatMap((regionId) => {
    const latest = unemploymentPlaceLatest(facts, regionId, "unemployment_rate");
    if (!latest) return [];
    return [{
      placeId: regionId ?? GEORGIA_PLACE_ID, page: UNEMPLOYMENT_REGIONS_PAGE, href: regionId ? unemploymentRegionHref(regionId) : UNEMPLOYMENT_REGIONS_PAGE,
      value: formatUnemploymentValue(latest.value, true, messages), number: latest.value!, period: String(latest.year),
    }];
  });
}

/** The average monthly wage, all sectors, of each region, and Georgia's on the Regions page itself, in its latest year (₾ to one decimal). */
async function wages(messages: Messages): Promise<PlaceEntry[]> {
  const facts = (await loadServedWagesData()).facts.map(toClientWagesFact);
  const gel = message(messages, "wages.unit");
  return [undefined, ...WAGES_REGIONS].map((regionId) => {
    const latest = wagesPlaceLatest(facts, regionId);
    return {
      placeId: regionId ?? GEORGIA_PLACE_ID, page: WAGES_REGIONS_PAGE, href: regionId ? wagesRegionHref(regionId) : WAGES_REGIONS_PAGE,
      value: `${formatInUnit(latest.value, { divisor: 1, label: gel, decimals: 1 })} ${gel}`, number: latest.value!, period: String(latest.year),
    };
  });
}

/** Unemployment and Wages regions. */
export const labourRegionEntries: PlaceAdapter = async (locale: Locale) => {
  const messages = await getMessages(locale, ["unemployment", "wages"]);
  return [...(await unemployment(messages)), ...(await wages(messages))];
};
