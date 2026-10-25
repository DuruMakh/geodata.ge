import { loadServedDemographyData } from "../../../data/demography/importDemography";
import { loadServedMunicipalData } from "../../../data/servedData";
import { message } from "../../../i18n/messages";
import { getMessages } from "../../../i18n/messages.server";
import { buildMarriageIndexModel } from "../../demographyMarriageIndex";
import { populationPlaceHref } from "../../demographyPlaceRoutes";
import { MARRIAGES_DIVORCES_ANCHOR, MARRIAGES_DIVORCES_PATH } from "../../demographyRoutes";
import { formatInUnit, UNIT_PERSONS } from "../../format";
import { placePageIds } from "../places.server";
import type { PlaceAdapter } from "../types";

/**
 * Each place's marriages in the latest year, linked to the marriages section of its Population page (as the Marriages page's list
 * is), captioned as the Marriages card is.
 */
export const marriageEntries: PlaceAdapter = async (locale) => {
  const [{ facts }, { regions, municipalities }, ids, messages] = await Promise.all([
    loadServedDemographyData(), loadServedMunicipalData(), placePageIds(), getMessages(locale, ["groups"]),
  ]);
  const index = buildMarriageIndexModel({ facts, regions, municipalities });
  const caption = message(messages, "groups.caption.marriages");
  return ids.map((id) => {
    const number = index.countsById[id]!.marriages;
    return { placeId: id, page: MARRIAGES_DIVORCES_PATH, href: `${populationPlaceHref(id)}${MARRIAGES_DIVORCES_ANCHOR}`, value: formatInUnit(number, UNIT_PERSONS), number, period: String(index.year), caption };
  });
};
