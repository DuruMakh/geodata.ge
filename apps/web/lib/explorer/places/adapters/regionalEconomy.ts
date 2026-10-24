import { loadServedRegionalEconomyData, REGIONAL_ECONOMY_REGIONS } from "../../../data/regionalEconomies/importRegionalEconomies";
import { formatAmount } from "../../format";
import { latestRegionalGdpTotal } from "../../regionalEconomies";
import { regionalEconomyHref } from "../../regionalEconomyRoutes";
import type { PlaceAdapter } from "../types";

const PAGE = "/explorer/economy/regions";

/** Each region's nominal GDP in the latest year of its whole series (the line on its page before a reader narrows the years). */
export const regionalEconomyEntries: PlaceAdapter = async (locale) => {
  const { facts } = await loadServedRegionalEconomyData();
  return REGIONAL_ECONOMY_REGIONS.map((region) => {
    const latest = latestRegionalGdpTotal(facts.filter((fact) => fact.regionId === region.id && fact.measure === "nominal"));
    if (!latest) throw new Error(`No regional GDP for ${region.id}`);
    return { placeId: region.id, page: PAGE, href: regionalEconomyHref(region.id), value: formatAmount(latest.value, locale), number: latest.value, period: String(latest.year) };
  });
};
