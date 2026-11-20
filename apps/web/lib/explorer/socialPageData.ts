import { loadServedDemographyData } from "../data/demography/importDemography";
import { SOURCE_ID } from "../data/demography/series";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { loadServedMunicipalData } from "../data/servedData";
import { loadServedSocialData, toClientSocialFact } from "../data/social/importSocial";
import { FUNDED_PENSION_SOURCES, SOCIAL_GEORGIA, SOCIAL_PUBLIC_SOURCES, socialArchiveSourceId, type ClientSocialFact, type SocialFact } from "../data/social/types";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { getPresentation } from "../i18n/presentation.server";
import type { Locale, Messages } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { GEORGIA_PLACE_ID, buildDemographyPlaces } from "./demographyAreas";
import { socialAnnualCpi, socialPopulation, socialTopicSeries, type SocialPlaceSet, type SocialPopulation, type SocialSeriesDefinition, type SocialTopicId } from "./social";
import { socialPlaceSeries } from "./socialPlaces";
import type { WorkbookPublicSource } from "./workbookModel";

/*
 * What the Social protection pages hand their explorers: the facts, places and population they share, the series a page
 * lists with its facts and names, and the originals they cite. Shared by the pages (lib/pages/social.tsx, social-places.tsx)
 * and the MCP snapshot build (lib/factQuery/topics/social.ts), which cannot import the pages (they pull in React).
 */

/**
 * What the index and the place pages share: the served facts and counting changes, the population and price index the
 * calculated rows divide by, the registries, the language and the place list.
 */
export async function loadSocialPlaceBasics(locale: Locale) {
  const [{ facts: served, breaks }, demography, inflation, municipal, georgian] = await Promise.all([
    loadServedSocialData(), loadServedDemographyData(), loadServedInflationData(), loadServedMunicipalData(), getMessages("ka", ["municipal"]),
  ]);
  const ids = [GEORGIA_PLACE_ID, ...municipal.regions.map(region => region.id), ...municipal.municipalities.map(m => m.code)];
  // `municipal` is loaded for the map's and the picker's words (tabs, search, boundaries, member counts).
  const presentation = await getPresentation(locale, ["social", "format", "main", "workbook", "municipal"], ids, ids);
  const places = buildDemographyPlaces({
    regions: municipal.regions, municipalities: municipal.municipalities, englishLabels: presentation.englishLabels, georgiaNameKa: message(georgian, "municipal.georgia"),
  });
  const lastReviewedAt = served.map(f => f.lastReviewedAt).sort().at(-1)!;
  return {
    facts: served.map(toClientSocialFact), breaks, population: socialPopulation(demography.facts), cpi: socialAnnualCpi(inflation.facts),
    municipal, presentation, places, lastReviewedAt,
  };
}

/**
 * The Excel Sources sheet's files, in the page's language: each SSA table the facts cite, as its archived topic page
 * (data/methodology/source-archives/social-protection.csv) under the table's own id, the Pension Fund's six documents (the funded
 * pension page's), and Geostat's population table (shares of residents) and price index (2025 prices) from the Population and
 * Inflation archives.
 */
export async function loadSocialWorkbookSources(locale: Locale): Promise<{ ssa: SourcedWorkbookPublicSource[]; pensionFund: SourcedWorkbookPublicSource[]; population: WorkbookPublicSource[]; cpi: WorkbookPublicSource[] }> {
  const cpiId = locale === "ka" ? "source.geostat_cpi_index_2010_ka" : "source.geostat_cpi_index_2010";
  const [pages, population, cpi] = await Promise.all([
    loadSourcedWorkbookSources("social-protection", locale, row => row.source_id.startsWith("ssa_") || row.source_id.startsWith("pension_fund_")),
    loadSourcedWorkbookSources("demography", locale, row => row.source_id === SOURCE_ID.populationUnits),
    loadSourcedWorkbookSources("inflation", locale, row => row.source_id === cpiId),
  ]);
  // Each SSA table is cited by its topic's archived page; a Pension Fund document is archived under its own id. The two lists stay apart so
  // an SSA workbook is never offered the Pension Fund's PDFs, and a funded pension workbook none of SSA's pages.
  const sourced = (sourceIds: readonly string[], what: string) => sourceIds.map(sourceId => {
    const page = pages.find(row => row.sourceId === socialArchiveSourceId(sourceId));
    if (!page) throw new Error(`No archived ${what} for ${sourceId}`);
    return { ...page, sourceId };
  });
  return {
    ssa: sourced(SOCIAL_PUBLIC_SOURCES.filter(sourceId => !FUNDED_PENSION_SOURCES.includes(sourceId)), "SSA page"),
    pensionFund: sourced(FUNDED_PENSION_SOURCES, "Pension Fund document"), population, cpi,
  };
}

/** A list's names: each series' own and each heading's, as the explorers and their workbooks print them. */
export function socialListLabels(messages: Messages, series: readonly SocialSeriesDefinition[]) {
  return {
    labels: Object.fromEntries(series.map(({ id }) => [id, message(messages, `social.series.${id}`)])),
    headingLabels: Object.fromEntries(series.map(({ heading }) => [heading, message(messages, `social.heading.${heading}`)])),
  };
}

/** Social payments, Social package or the funded pension: the series the list shows, Georgia's served facts of them and their names. */
export function socialTopicPageData(served: readonly SocialFact[], messages: Messages, section: SocialTopicId) {
  const series = socialTopicSeries(section);
  // The page receives only Georgia's observations of the series its list shows.
  const ids = new Set<string>(series.map(({ id }) => id));
  const shown = served.filter(f => ids.has(f.indicatorId) && f.geographyId === SOCIAL_GEORGIA);
  return { series, shown, facts: shown.map(toClientSocialFact), ...socialListLabels(messages, series) };
}

/** One place page's list: the series it lists, the place's own facts of them and population, and their names. */
export function socialPlacePageData(basics: { facts: readonly ClientSocialFact[]; population: SocialPopulation }, messages: Messages, set: SocialPlaceSet, placeId: string) {
  const series = socialPlaceSeries(set);
  const facts = basics.facts.filter(f => f.geographyId === placeId && series.some(({ id }) => id === f.indicatorId));
  return { series, facts, population: basics.population.filter(row => row.geographyId === placeId), ...socialListLabels(messages, series) };
}
