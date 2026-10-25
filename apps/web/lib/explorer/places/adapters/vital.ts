import { loadServedDemographyData } from "../../../data/demography/importDemography";
import { loadServedMunicipalData } from "../../../data/servedData";
import { message } from "../../../i18n/messages";
import { getMessages } from "../../../i18n/messages.server";
import { populationPlaceHref } from "../../demographyPlaceRoutes";
import { BIRTHS_DEATHS_ANCHOR, BIRTHS_DEATHS_PATH } from "../../demographyRoutes";
import { buildVitalIndexModel } from "../../demographyVitalIndex";
import { formatInUnit, UNIT_PERSONS } from "../../format";
import { placePageIds } from "../places.server";
import type { PlaceAdapter } from "../types";

/**
 * Each place's births in the latest year, linked to the births and deaths section of its Population page (as the Births page's
 * list is): the count that section and the Births card state, captioned as the card is.
 */
export const vitalEntries: PlaceAdapter = async (locale) => {
  const [{ facts }, { regions, municipalities }, ids, messages] = await Promise.all([
    loadServedDemographyData(), loadServedMunicipalData(), placePageIds(), getMessages(locale, ["groups"]),
  ]);
  const index = buildVitalIndexModel({ facts, regions, municipalities });
  const caption = message(messages, "groups.headline.demography.births-deaths");
  return ids.map((id) => {
    const number = index.countsById[id]!.births;
    return { placeId: id, page: BIRTHS_DEATHS_PATH, href: `${populationPlaceHref(id)}${BIRTHS_DEATHS_ANCHOR}`, value: formatInUnit(number, UNIT_PERSONS), number, period: String(index.year), caption };
  });
};
