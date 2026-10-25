import { loadServedHealthData, toClientHealthFact } from "../../../data/health/importHealth";
import { message } from "../../../i18n/messages";
import { getMessages } from "../../../i18n/messages.server";
import { GEORGIA_PLACE_ID } from "../../demographyAreas";
import { formatInUnit } from "../../format";
import { HEALTH_SECTIONS } from "../../health";
import { HEALTH_DEATH_AREAS } from "../../healthDeaths";
import type { PlaceAdapter } from "../types";

const PAGE = HEALTH_SECTIONS.find((section) => section.id === "causes-of-death")!.href;

/**
 * Georgia's and each region's death rate per 1,000 people in its latest year, as the Causes of death card and index state it,
 * captioned as the card is (a region's caption without the card's `Georgia`). An area page leads with the count of deaths, so each row
 * opens the Causes of death page, whose map and list state the rate for Georgia and every region.
 */
export const healthDeathsEntries: PlaceAdapter = async (locale) => {
  const [{ facts: served }, messages] = await Promise.all([loadServedHealthData(), getMessages(locale, ["health"])]);
  const rates = served.map(toClientHealthFact).filter((fact) => fact.indicatorId === "health.death_rate.total").sort((a, b) => a.year - b.year);
  return HEALTH_DEATH_AREAS.map((area) => {
    const fact = rates.filter((rate) => rate.areaId === area).at(-1)!;
    const georgia = area === "georgia";
    return {
      placeId: georgia ? GEORGIA_PLACE_ID : area, page: PAGE, href: PAGE,
      value: formatInUnit(fact.value, { divisor: 1, label: "", decimals: fact.decimals }), number: fact.value, period: String(fact.year),
      caption: message(messages, georgia ? "health.latest.causes-of-death" : "health.latest.deathRate"),
    };
  });
};
