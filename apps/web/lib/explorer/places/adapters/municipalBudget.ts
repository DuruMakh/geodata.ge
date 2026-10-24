import type { MunicipalTotalFact } from "../../../data/municipal/types";
import { loadServedMunicipalData } from "../../../data/servedData";
import { municipalEntityHref } from "../../../seo/internalLinks";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, placeIdForMunicipalityCode } from "../../demographyAreas";
import { formatAmount } from "../../format";
import { regionOwnFacts } from "../../municipalData";
import { BUDGET_SECTIONS } from "../../sections";
import type { PlaceAdapter, PlaceEntry } from "../types";

export const MUNICIPAL_BUDGET_PAGE = BUDGET_SECTIONS.municipalities.href!;

/** A Budget page's latest total: the place's own latest year. A place with no total at all is an error, never 0 ₾. */
export function latestOwnTotal(totalFacts: readonly MunicipalTotalFact[], placeId: string): MunicipalTotalFact {
  let latest: MunicipalTotalFact | undefined;
  for (const fact of totalFacts) if (!latest || fact.year > latest.year) latest = fact;
  if (!latest) throw new Error(`No budget total for ${placeId}`);
  return latest;
}

/**
 * Each place's total budget in its latest year, as its Budget page states it: Georgia's 69 budgets, a region's municipalities
 * (Adjara's with the republican adjustment) and a municipality's own. Tbilisi is its municipality page; its region page
 * repeats the same figure and is left out, so the capital has one Budget row.
 */
export const municipalBudgetEntries: PlaceAdapter = async (locale) => {
  const { municipalities, regions, functionFacts, totalFacts, countryTotalFacts, adjaraBudgetAdjustments } = await loadServedMunicipalData();
  const entry = (placeId: string, href: string, total: MunicipalTotalFact): PlaceEntry => ({
    placeId, page: MUNICIPAL_BUDGET_PAGE, href, value: formatAmount(total.publicTotalGel, locale), number: total.publicTotalGel, period: String(total.year),
  });
  return [
    entry(GEORGIA_PLACE_ID, municipalEntityHref("country", GEORGIA_PLACE_ID), latestOwnTotal(countryTotalFacts, GEORGIA_PLACE_ID)),
    ...regions.filter((region) => region.id !== TBILISI_PLACE_ID).map((region) => entry(region.id, municipalEntityHref("region", region.id),
      latestOwnTotal(regionOwnFacts(region.id, municipalities, functionFacts, totalFacts, adjaraBudgetAdjustments).own.totalFacts, region.id))),
    ...municipalities.map((municipality) => entry(placeIdForMunicipalityCode(municipality.code), municipalEntityHref("municipality", municipality.code),
      latestOwnTotal(totalFacts.filter((fact) => fact.municipalityCode === municipality.code), municipality.code))),
  ];
};
