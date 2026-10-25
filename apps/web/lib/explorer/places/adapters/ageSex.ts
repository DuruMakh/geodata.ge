import { loadServedDemographyData } from "../../../data/demography/importDemography";
import { CENSUS_YEAR } from "../../../data/demography/series";
import { loadServedMunicipalData } from "../../../data/servedData";
import { message } from "../../../i18n/messages";
import { getMessages } from "../../../i18n/messages.server";
import { buildAgeSexRegionModel } from "../../demographyAgeSexRegions";
import { AGE_SEX_PATH } from "../../demographyRoutes";
import { formatShare } from "../../format";
import type { PlaceAdapter } from "../types";

/**
 * Each region's census share aged 65+, as the Age and sex page's regions block maps it. The regions have no age page of their own,
 * so each links to the general page (spec 2026-10-24-explorer-regroup §8), captioned as the Age and sex card is.
 */
export const ageSexEntries: PlaceAdapter = async (locale) => {
  const [{ facts }, { regions }, messages] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData(), getMessages(locale, ["groups"])]);
  const caption = message(messages, "groups.headline.demography.age-sex");
  return buildAgeSexRegionModel(facts, regions).regions.map((region) => ({
    placeId: region.regionId, page: AGE_SEX_PATH, href: AGE_SEX_PATH, value: formatShare(region.value / 100), number: region.value, period: String(CENSUS_YEAR), caption,
  }));
};
