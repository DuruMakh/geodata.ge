import { HOUSEHOLD_AREAS, type HouseholdArea } from "../data/household/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { householdViewSeries, type HouseholdSectionId } from "./household";

/*
 * What the household pages hand their explorers: the observations a page shows and the names of its lines and areas.
 * Shared by the pages (lib/pages/household-shared.tsx) and the MCP snapshot build (lib/factQuery/topics/household.ts),
 * which cannot import the pages (they pull in `server-only` and React).
 */

/** Names of Georgia, towns, villages and the regions, in the page's language; region names are the Wages pages' own. */
export function householdAreaLabels(presentation: Presentation): Record<HouseholdArea, string> {
  return Object.fromEntries(HOUSEHOLD_AREAS.map(area => {
    const region = REGIONAL_ECONOMY_REGIONS.find(item => item.id === area);
    return [area, region ? publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels) : message(presentation.messages, `household.area.${area}`)];
  })) as Record<HouseholdArea, string>;
}

/** Line names; the towns and villages lines take their names from householdAreaLabels. */
export function householdLabels(presentation: Presentation, section: HouseholdSectionId): Record<string, string> {
  return Object.fromEntries(householdViewSeries(section, "georgia").filter(series => series.indicatorId === series.id).map(series => [series.id, message(presentation.messages, `household.series.${series.id}`)]));
}

/** Whether a page shows an observation: its own section's, and on an area page only its lines' (Georgia's include towns and villages). */
export function householdPageFilter(section: HouseholdSectionId, regionId: HouseholdArea | undefined): (fact: { indicatorId: string; areaId: string }) => boolean {
  const areaIds = new Set<string>(regionId ? householdViewSeries(section, regionId).map(series => series.areaId) : []);
  return fact => fact.indicatorId.startsWith(`${section}.`) && (!regionId || areaIds.has(fact.areaId));
}
