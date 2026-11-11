import { loadServedWagesData, toClientWagesFact } from "../data/wages/importWages";
import { WAGES_REGIONS } from "../data/wages/types";
import { WAGES_SECTIONS, wagesSummaryValues, type WagesSectionId } from "../explorer/wages";
import { WAGES_LABEL_IDS, wagesPageFacts } from "../explorer/wagesPageData";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";

// Shared by the wages page modules. The Regions index and the explorer pages are
// separate modules, so the index ships no explorer: keep client components out of this file.

export { wagesLabels } from "../explorer/wagesPageData";

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
    loadServedWagesData(), getPresentation(locale, ["wages", "regionalEconomies", "format", "main", "workbook"], WAGES_LABEL_IDS, WAGES_REGIONS),
  ]);
  // Each page receives only the observations its views can show.
  const facts = wagesPageFacts(data.facts.map(toClientWagesFact), section);
  return { data, presentation, facts };
}
