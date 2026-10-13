import path from "node:path";
import { loadServedWagesData, toClientWagesFact } from "../data/wages/importWages";
import { WAGES_REGIONS, WAGES_SECTORS } from "../data/wages/types";
import { WAGES_SECTIONS, wagesSummaryValues, type WagesSectionId } from "../explorer/wages";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";

// Shared by the wages page modules. The Regions index and the explorer pages are
// separate modules, so the index ships no explorer: keep client components out of this file.

const LABEL_IDS = [...WAGES_SECTORS, ...WAGES_REGIONS];

export async function wagesPageMetadata(locale: Locale, section: WagesSectionId) {
  const [messages, data] = await Promise.all([getMessages(locale, ["wages"]), loadServedWagesData()]);
  const values = wagesSummaryValues(data.facts.map(toClientWagesFact));
  return fiscalMetadata({ locale, path: WAGES_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `wages.page.${section}.title`), description: message(messages, `wages.page.${section}.summary`, values) });
}

/** A section page's served data, presentation, sources and the observations its views can show. */
export async function loadWagesPage(locale: Locale, section: WagesSectionId) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedWagesData(), getPresentation(locale, ["wages", "regionalEconomies", "common", "controls", "format", "main", "workbook"], LABEL_IDS, WAGES_REGIONS),
    loadReviewedSourceManifest(root, "wages"), loadEnglishCatalogue(root),
  ]);
  const allFacts = data.facts.map(toClientWagesFact);
  // Each page receives only the observations its views can show.
  const dimensions = { overview: ["national", "ownership", "sex"], industries: ["national", "sex", "ownership", "business_sector"], regions: ["national", "region"] }[section];
  const facts = allFacts.filter(f => dimensions.includes(f.dimension) && (section === "industries" || f.sectorId === "total" && (section === "overview" || f.indicatorId === "average_monthly_nominal_earnings")));
  return { data, presentation, manifest, catalogue, facts };
}
