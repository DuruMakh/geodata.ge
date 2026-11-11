import { ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { WAGES_GROUPS, WAGES_REGIONS, WAGES_SECTORS, type ClientWagesFact } from "../data/wages/types";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import type { WagesSectionId } from "./wages";

/*
 * What the Wages pages hand their explorers: the observations a section (or a region page) shows and the series' names.
 * Shared by the pages (lib/pages/wages*.ts[x]) and the MCP snapshot build (lib/factQuery/topics/wages.ts), which cannot
 * import the pages (they pull in `server-only` and React).
 */

/** Every series id a wages page can name: the sections and the regions. */
export const WAGES_LABEL_IDS = [...WAGES_SECTORS, ...WAGES_REGIONS];

/** Display names for every series id a wages page can show, in the page's language. */
export function wagesLabels(presentation: Presentation): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `wages.${key}`);
  const labels: Record<string, string> = { average: t("series.average"), median: t("series.median"), total: t("series.total") };
  for (const dimension of ["sex", "ownership", "business_sector"] as const) for (const id of WAGES_GROUPS[dimension]) labels[id] = t(`group.${id}`);
  for (const sector of ECONOMIC_SECTORS.filter(item => (WAGES_SECTORS as readonly string[]).includes(item.id))) labels[sector.id] = publicLabel(presentation.locale, sector.id, sector.labelKa, presentation.englishLabels);
  for (const region of REGIONAL_ECONOMY_REGIONS.filter(item => (WAGES_REGIONS as readonly string[]).includes(item.id))) labels[region.id] = publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels);
  return labels;
}

/** The observations a section's views can show (the Regions index's map and list, or a region page before its region is picked). */
export function wagesPageFacts(allFacts: readonly ClientWagesFact[], section: WagesSectionId): ClientWagesFact[] {
  const dimensions = { overview: ["national", "ownership", "sex"], industries: ["national", "sex", "ownership", "business_sector"], regions: ["national", "region"] }[section];
  return allFacts.filter(f => dimensions.includes(f.dimension) && (section === "industries" || f.sectorId === "total" && (section === "overview" || f.indicatorId === "average_monthly_nominal_earnings")));
}

/** A region page: its own region beside Georgia, and the national line named as Georgia's. */
export function wagesRegionPageData(facts: readonly ClientWagesFact[], presentation: Presentation, regionId: string) {
  const labels = wagesLabels(presentation);
  labels.average = message(presentation.messages, "wages.series.georgiaAverage");
  return { facts: facts.filter(f => f.dimension !== "region" || f.groupId === regionId), labels };
}
