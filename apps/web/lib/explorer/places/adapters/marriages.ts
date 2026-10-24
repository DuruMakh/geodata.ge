import { loadServedDemographyData } from "../../../data/demography/importDemography";
import { loadServedMunicipalData } from "../../../data/servedData";
import { buildMarriageIndexModel } from "../../demographyMarriageIndex";
import { populationPlaceHref } from "../../demographyPlaceRoutes";
import { MARRIAGES_DIVORCES_PATH } from "../../demographyRoutes";
import { formatInUnit, UNIT_PERSONS } from "../../format";
import { placePageIds } from "../places.server";
import type { PlaceAdapter } from "../types";

/** Each place's marriages in the latest year, linked to the marriages section of its Population page (as the Marriages page's list is). */
export const marriageEntries: PlaceAdapter = async () => {
  const [{ facts }, { regions, municipalities }, ids] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData(), placePageIds()]);
  const index = buildMarriageIndexModel({ facts, regions, municipalities });
  return ids.map((id) => {
    const number = index.countsById[id]!.marriages;
    return { placeId: id, page: MARRIAGES_DIVORCES_PATH, href: `${populationPlaceHref(id)}#marriages-divorces`, value: formatInUnit(number, UNIT_PERSONS), number, period: String(index.year) };
  });
};
