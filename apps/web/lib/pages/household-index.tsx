import { HouseholdIndex } from "../../components/household/household-index";
import { HOUSEHOLD_MEASURES, type HouseholdMeasure } from "../data/household/types";
import { sectionTotal, type HouseholdSectionId } from "../explorer/household";
import { buildHouseholdRegionMapModel } from "../explorer/householdRegionMap";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import type { Locale } from "../i18n/types";
import { renderHouseholdPage } from "./household-shared";

/** A section's index page: the map and list whose rows open their own pages (household.tsx). */
export function renderHouseholdIndexPage(locale: Locale, section: HouseholdSectionId) {
  // The map for each measure is built on the server; the page itself receives only Georgia's section total.
  return renderHouseholdPage(locale, section, undefined, ({ facts }) =>
    <HouseholdIndex key={section} section={section} facts={facts.filter(f => f.indicatorId === sectionTotal(section) && f.areaId === "georgia")}
      regionMaps={Object.fromEntries(HOUSEHOLD_MEASURES.map(measure => [measure, buildHouseholdRegionMapModel(section, measure, facts)])) as Record<HouseholdMeasure, RegionMapModel>} />);
}
