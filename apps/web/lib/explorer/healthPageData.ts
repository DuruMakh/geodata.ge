import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { toClientHealthFact } from "../data/health/importHealth";
import type { HealthArea, HealthFact, HealthSeriesBreak } from "../data/health/types";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import type { Locale, Messages, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { healthViews, healthViewSeries, type HealthNationalSectionId } from "./health";
import { buildHealthDeathRateMapModel } from "./healthDeathRateMap";
import { HEALTH_DEATH_AREAS, healthDeathsSeries } from "./healthDeaths";

/*
 * What the Health pages hand their explorers: the series they list, the served facts of them, their names, the areas and
 * the originals they cite. Shared by the pages (lib/pages/health*.tsx) and the MCP snapshot build
 * (lib/factQuery/topics/health.ts), which cannot import the pages (they pull in `server-only` and React).
 */

const RATE = "health.death_rate.total";

/**
 * The workbook cites each archived Geostat file the page's values were read from, for the years that file supplies.
 * Links point to the copies in the fiscal.ge source archive.
 */
export async function healthSources(locale: Locale, facts: readonly { sourceId: string; year: number }[]): Promise<SourcedWorkbookPublicSource[]> {
  const used = [...new Set(facts.map(f => f.sourceId))];
  const archived = await loadSourcedWorkbookSources("health", locale, row => used.includes(row.source_id));
  return used.map(sourceId => {
    const source = archived.find(row => row.sourceId === sourceId);
    if (!source) throw new Error(`Missing reviewed health source ${sourceId}`);
    return { ...source, years: [...new Set(facts.filter(f => f.sourceId === sourceId).map(f => f.year))].sort((a, b) => a - b) };
  });
}

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
export const HEALTH_AREA_PAGES: readonly MunicipalRegion[] = HEALTH_DEATH_AREAS.map(id => id === "georgia" ? { id, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === id)!);

/** Names of Georgia and the regions in the page's language; region names are the Wages pages' own. */
export function healthAreaLabels(presentation: Presentation): Record<HealthArea, string> {
  return Object.fromEntries(HEALTH_AREA_PAGES.map(area => [area.id, area.id === "georgia" ? message(presentation.messages, "health.area.georgia") : publicLabel(presentation.locale, area.id, area.kaLabel, presentation.englishLabels)])) as Record<HealthArea, string>;
}

/** Each listed series' name. */
const seriesLabels = (messages: Messages, ids: ReadonlySet<string>) => Object.fromEntries([...ids].map(id => [id, message(messages, `health.series.${id}`)]));

/** Doctors and hospitals or Illnesses: every view's series, Georgia's served facts of them, the counting changes that touch them and their names. */
export function healthNationalPageData(data: { facts: readonly HealthFact[]; breaks: readonly HealthSeriesBreak[] }, messages: Messages, section: HealthNationalSectionId) {
  // Each page receives only the observations its series show, and only the counting changes that touch them.
  const ids = new Set<string>(healthViews(section).flatMap(view => healthViewSeries(section, view).map(series => series.id)));
  const served = data.facts.filter(f => f.areaId === "georgia" && ids.has(f.indicatorId));
  const breaks = data.breaks.filter(item => item.appliesTo.some(id => ids.has(id)));
  return { served, facts: served.map(toClientHealthFact), breaks, labels: seriesLabels(messages, ids) };
}

/** One area's causes-of-death page: the area's served deaths by cause and the causes' names. */
export function healthDeathsAreaPageData(facts: readonly HealthFact[], messages: Messages, area: HealthArea) {
  const ids = new Set<string>(healthDeathsSeries().map(series => series.id));
  const served = facts.filter(f => f.areaId === area && ids.has(f.indicatorId));
  return { served, facts: served.map(toClientHealthFact), labels: seriesLabels(messages, ids) };
}

/** The Causes of death index: every area's death rate, Georgia's for its latest line and the regions' map, built on the server. */
export function healthDeathRatePageData(facts: readonly HealthFact[]) {
  const served = facts.filter(f => f.indicatorId === RATE);
  const rates = served.map(toClientHealthFact);
  return { served, georgiaRates: rates.filter(f => f.areaId === "georgia"), regionMap: buildHealthDeathRateMapModel(rates) };
}
