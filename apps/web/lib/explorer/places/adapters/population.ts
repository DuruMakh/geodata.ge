import { loadServedDemographyData } from "../../../data/demography/importDemography";
import { loadServedMunicipalData } from "../../../data/servedData";
import { populationPlaceHref, POPULATION_PATH } from "../../demographyPlaceRoutes";
import { buildPopulationIndexModel } from "../../demographyPopulationIndex";
import { formatInUnit, UNIT_PERSONS } from "../../format";
import type { MunicipalListRow } from "../../municipalData";
import { placePageIds } from "../places.server";
import type { PlaceAdapter } from "../types";

/** Each place's population on 1 January of the latest year, as its Population page states it. */
export const populationEntries: PlaceAdapter = async () => {
  const [{ facts }, { regions, municipalities }, ids] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData(), placePageIds()]);
  const index = buildPopulationIndexModel({ facts, regions, municipalities });
  const rows = new Map<string, MunicipalListRow>([...index.municipalities, ...index.regions, index.country].map((row) => [row.id, row]));
  return ids.map((id) => {
    const number = rows.get(id)!.valueGel;
    return { placeId: id, page: POPULATION_PATH, href: populationPlaceHref(id), value: formatInUnit(number, UNIT_PERSONS), number, period: String(index.year) };
  });
};
