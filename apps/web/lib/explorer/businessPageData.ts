import { toClientBusinessFact } from "../data/business/importBusiness";
import { BUSINESS_DEMOGRAPHY_SECTORS, type BusinessFact, type BusinessGroup, type BusinessMeasure, type ClientBusinessFact } from "../data/business/types";
import { ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import type { Messages, Presentation } from "../i18n/types";
import { businessTopicSeries, type BusinessTopicId } from "./business";
import { BUSINESS_AREAS, businessAreaSeries, businessMapId, type BusinessArea } from "./businessAreas";
import { regionAreaLabels, regionAreaPages } from "./regionAreaPages";

/*
 * What the Business pages hand their explorers: the observations a page shows and the names of its series and areas.
 * Shared by the pages (lib/pages/business*.tsx) and the MCP snapshot build (lib/factQuery/topics/business.ts), which
 * cannot import the pages (they pull in `server-only` and React).
 */

/** The shared economic-sector labels the industry rows wear (`sector_x` is `sector.x`); the survey's B–E group and the unknown activity have their own. */
export const BUSINESS_SECTOR_LABEL_IDS = BUSINESS_DEMOGRAPHY_SECTORS.map(group => `sector.${group.slice("sector_".length)}`);

/** A size's or industry's name, in the page's language: industries take the Economy pages' sector names, as Wages does. */
function businessGroupLabel(presentation: Presentation, group: BusinessGroup): string {
  const sector = ECONOMIC_SECTORS.find(item => item.id === `sector.${group.slice("sector_".length)}`);
  return group.startsWith("sector_") && sector ? publicLabel(presentation.locale, sector.id, sector.labelKa, presentation.englishLabels) : message(presentation.messages, `business.group.${group}`);
}

/**
 * Display names for every series a topic page can show. Sales and Jobs call their total "All firms"; elsewhere a total
 * is its measure's name (Investment, New firms…). Parts carry no prefix: the heading or parent they sit under names them
 * (the chart, table and workbook add a nested part's parent name).
 */
export function businessLabels(presentation: Presentation, section: BusinessTopicId): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `business.${key}`);
  return Object.fromEntries(businessTopicSeries(section).map(({ id }) => {
    const [, measure, group] = id.split(".") as [string, BusinessMeasure, BusinessGroup];
    return [id, group !== "total" ? businessGroupLabel(presentation, group) : section === "sales" || section === "jobs" ? t("series.total") : t(`series.${measure}`)];
  }));
}

/** The observations a topic page's list can show. */
export function businessPageFacts(facts: readonly BusinessFact[], section: BusinessTopicId): ClientBusinessFact[] {
  const ids = new Set<string>(businessTopicSeries(section).map(series => series.id));
  return facts.map(toClientBusinessFact).filter(f => ids.has(f.indicatorId));
}

/** Georgia and the eleven regions, in the picker's and previous/next order. */
export const BUSINESS_AREA_PAGES = regionAreaPages(BUSINESS_AREAS, businessMapId);
export const BUSINESS_AREA_LABEL_IDS = BUSINESS_AREA_PAGES.map(area => area.id);

/** Names of Georgia and the regions, in the page's language. */
export const businessAreaLabels = (presentation: Presentation): Record<BusinessArea, string> => regionAreaLabels(presentation, "business", BUSINESS_AREAS, BUSINESS_AREA_PAGES);

/** The observations an area page's list shows. */
export function businessAreaFacts(facts: readonly BusinessFact[], area: BusinessArea): ClientBusinessFact[] {
  const ids = new Set<string>(businessAreaSeries(area).map(series => series.id));
  return facts.map(toClientBusinessFact).filter(f => ids.has(f.indicatorId));
}

/** An area page's row names: each row is its measure's name, the area being the page's own. */
export function businessAreaSeriesLabels(messages: Messages, area: BusinessArea): Record<string, string> {
  return Object.fromEntries(businessAreaSeries(area).map(({ id }) => [id, message(messages, `business.series.${id.split(".")[1]}`)]));
}
