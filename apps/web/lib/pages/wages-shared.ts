import { loadServedWagesData, toClientWagesFact } from "../data/wages/importWages";
import { WAGES_GROUPS, WAGES_REGIONS, WAGES_SECTORS } from "../data/wages/types";
import { ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { WAGES_SECTIONS, wagesSummaryValues, type WagesSectionId } from "../explorer/wages";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import type { Locale, Messages, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";

// Shared by the wages page modules. The Regions index and the explorer pages are
// separate modules, so the index ships no explorer: keep client components out of this file.

const LABEL_IDS = [...WAGES_SECTORS, ...WAGES_REGIONS];

/** Display names for every series id a wages page can show, in the page's language. */
export function wagesLabels(presentation: Presentation): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `wages.${key}`);
  const labels: Record<string, string> = { average: t("series.average"), median: t("series.median"), total: t("series.total") };
  for (const dimension of ["sex", "ownership", "business_sector"] as const) for (const id of WAGES_GROUPS[dimension]) labels[id] = t(`group.${id}`);
  for (const sector of ECONOMIC_SECTORS.filter(item => (WAGES_SECTORS as readonly string[]).includes(item.id))) labels[sector.id] = publicLabel(presentation.locale, sector.id, sector.labelKa, presentation.englishLabels);
  for (const region of REGIONAL_ECONOMY_REGIONS.filter(item => (WAGES_REGIONS as readonly string[]).includes(item.id))) labels[region.id] = publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels);
  return labels;
}

export async function wagesPageMetadata(locale: Locale, section: WagesSectionId) {
  const [messages, data] = await Promise.all([getMessages(locale, ["wages"]), loadServedWagesData()]);
  const values = wagesSummaryValues(data.facts.map(toClientWagesFact));
  return fiscalMetadata({ locale, path: WAGES_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `wages.page.${section}.title`), description: message(messages, `wages.page.${section}.summary`, values) });
}

/** The Regions index's Dataset, which every region page names as its parent. */
export function wagesRegionsDataset(messages: Messages) {
  return { path: "/explorer/wages/regions", name: message(messages, "wages.page.regions.title"), description: message(messages, "wages.page.regions.summary") } as const;
}

/** A section page's served data, presentation and the observations its views can show. */
export async function loadWagesPage(locale: Locale, section: WagesSectionId) {
  const [data, presentation] = await Promise.all([
    loadServedWagesData(), getPresentation(locale, ["wages", "regionalEconomies", "format", "main", "workbook"], LABEL_IDS, WAGES_REGIONS),
  ]);
  const allFacts = data.facts.map(toClientWagesFact);
  // Each page receives only the observations its views can show.
  const dimensions = { overview: ["national", "ownership", "sex"], industries: ["national", "sex", "ownership", "business_sector"], regions: ["national", "region"] }[section];
  const facts = allFacts.filter(f => dimensions.includes(f.dimension) && (section === "industries" || f.sectorId === "total" && (section === "overview" || f.indicatorId === "average_monthly_nominal_earnings")));
  return { data, presentation, facts };
}
