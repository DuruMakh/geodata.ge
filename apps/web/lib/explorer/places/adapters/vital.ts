import { loadServedDemographyData } from "../../../data/demography/importDemography";
import { loadServedMunicipalData } from "../../../data/servedData";
import { populationPlaceHref } from "../../demographyPlaceRoutes";
import { BIRTHS_DEATHS_ANCHOR, BIRTHS_DEATHS_PATH } from "../../demographyRoutes";
import { buildVitalIndexModel } from "../../demographyVitalIndex";
import { formatInUnit, UNIT_PERSONS } from "../../format";
import type { MunicipalListRow } from "../../municipalData";
import { placePageIds } from "../places.server";
import type { PlaceAdapter } from "../types";

/** Each place's births per 100 deaths in the latest year, linked to the births and deaths section of its Population page (as the Births page's list is). */
export const vitalEntries: PlaceAdapter = async () => {
  const [{ facts }, { regions, municipalities }, ids] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData(), placePageIds()]);
  const index = buildVitalIndexModel({ facts, regions, municipalities });
  const rows = new Map<string, MunicipalListRow>([...index.municipalities, ...index.regions, index.country].map((row) => [row.id, row]));
  return ids.map((id) => {
    const number = rows.get(id)!.valueGel;
    return { placeId: id, page: BIRTHS_DEATHS_PATH, href: `${populationPlaceHref(id)}${BIRTHS_DEATHS_ANCHOR}`, value: formatInUnit(number, UNIT_PERSONS), number, period: String(index.year) };
  });
};
