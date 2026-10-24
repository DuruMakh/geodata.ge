import { loadServedHouseholdData, toClientHouseholdFact } from "../../../data/household/importHousehold";
import { message } from "../../../i18n/messages";
import { getMessages } from "../../../i18n/messages.server";
import { GEORGIA_PLACE_ID } from "../../demographyAreas";
import { formatInUnit } from "../../format";
import { HOUSEHOLD_PAGE_AREAS, HOUSEHOLD_SECTIONS, householdAreaLatest, householdRegionHref } from "../../household";
import type { PlaceAdapter, PlaceEntry } from "../types";

/** Georgia's and each region's income and spending per household in the latest year, as its page's line states them (₾ to one decimal). */
export const householdEntries: PlaceAdapter = async (locale) => {
  const [{ facts: served }, messages] = await Promise.all([loadServedHouseholdData(), getMessages(locale, ["household"])]);
  const facts = served.map(toClientHouseholdFact);
  const gel = message(messages, "household.unitGel");
  return HOUSEHOLD_SECTIONS.flatMap(({ id: section, href: page }) => HOUSEHOLD_PAGE_AREAS.map((area): PlaceEntry => {
    const fact = householdAreaLatest(section, area, facts);
    return {
      placeId: area === "georgia" ? GEORGIA_PLACE_ID : area, page, href: householdRegionHref(section, area),
      value: `${formatInUnit(fact.value, { divisor: 1, label: gel, decimals: 1 })} ${gel}`, number: fact.value, period: String(fact.year),
    };
  }));
};
