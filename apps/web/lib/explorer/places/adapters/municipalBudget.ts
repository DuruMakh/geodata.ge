import { loadServedMunicipalData } from "../../../data/servedData";
import { coverageFromYears } from "../../../seo/metadata";
import { GEORGIA_PLACE_ID, TBILISI_PLACE_ID, placeIdForMunicipalityCode } from "../../demographyAreas";
import { formatAmount } from "../../format";
import { buildCountryTotalByYear, buildMunicipalListRows } from "../../municipalData";
import { municipalityHrefForCode } from "../../municipalityRoutes";
import { BUDGET_SECTIONS } from "../../sections";
import type { PlaceAdapter, PlaceEntry } from "../types";

export const MUNICIPAL_BUDGET_PAGE = BUDGET_SECTIONS.municipalities.href!;

/**
 * Each place's total budget in the latest year, as its Budget page states it: Georgia's 69 budgets, a region's municipalities
 * (Adjara's with the republican adjustment) and a municipality's own. Tbilisi is its municipality page; its region page
 * repeats the same figure and is left out, so the capital has one Budget row.
 */
export const municipalBudgetEntries: PlaceAdapter = async (locale) => {
  const { municipalities, regions, totalFacts, countryTotalFacts, adjaraBudgetAdjustments } = await loadServedMunicipalData();
  const { lastYear } = coverageFromYears(totalFacts);
  const list = buildMunicipalListRows({ municipalities, regionLabels: new Map(regions.map((region) => [region.id, region.kaLabel])), totalFacts, adjaraBudgetAdjustments, year: lastYear });
  const countryYear = coverageFromYears(countryTotalFacts).lastYear;
  const entry = (placeId: string, href: string, number: number, year: number): PlaceEntry => ({
    placeId, page: MUNICIPAL_BUDGET_PAGE, href, value: formatAmount(number, locale), number, period: String(year),
  });
  return [
    entry(GEORGIA_PLACE_ID, `${MUNICIPAL_BUDGET_PAGE}/georgia`, buildCountryTotalByYear(countryTotalFacts)[countryYear]!, countryYear),
    ...list.regions.filter((row) => row.id !== TBILISI_PLACE_ID).map((row) => entry(row.id, `${MUNICIPAL_BUDGET_PAGE}/region/${row.id.slice("region.".length)}`, row.valueGel, lastYear)),
    ...list.municipalities.map((row) => entry(placeIdForMunicipalityCode(row.id), municipalityHrefForCode(row.id), row.valueGel, lastYear)),
  ];
};
