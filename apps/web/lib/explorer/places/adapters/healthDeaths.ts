import { loadServedHealthData, toClientHealthFact } from "../../../data/health/importHealth";
import { GEORGIA_PLACE_ID } from "../../demographyAreas";
import { formatInUnit, UNIT_PERSONS } from "../../format";
import { HEALTH_SECTIONS } from "../../health";
import { HEALTH_DEATH_AREAS, healthDeathsAreaHref, healthDeathsAreaLatest } from "../../healthDeaths";
import type { PlaceAdapter } from "../types";

const PAGE = HEALTH_SECTIONS.find((section) => section.id === "causes-of-death")!.href;

/** Georgia's and each region's deaths from all causes in the latest year, as its page's line states them. */
export const healthDeathsEntries: PlaceAdapter = async () => {
  const facts = (await loadServedHealthData()).facts.map(toClientHealthFact);
  return HEALTH_DEATH_AREAS.map((area) => {
    const fact = healthDeathsAreaLatest(area, facts);
    return { placeId: area === "georgia" ? GEORGIA_PLACE_ID : area, page: PAGE, href: healthDeathsAreaHref(area), value: formatInUnit(fact.value, UNIT_PERSONS), number: fact.value, period: String(fact.year) };
  });
};
