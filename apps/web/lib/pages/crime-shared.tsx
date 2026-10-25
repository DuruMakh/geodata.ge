import type { ReactNode } from "react";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import type { CrimeFact } from "../data/crime/types";
import { SOURCE_ID } from "../data/demography/series";
import { CRIME_SECTIONS, type CrimeSectionId } from "../explorer/crime";
import { coverageLabel } from "../explorer/coverageLabel";
import { getMessages } from "../i18n/messages.server";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

// Shared by the crime page module and the routes' metadata: keep explorer components out of this file.

export const crimeSectionHref = (section: CrimeSectionId) => CRIME_SECTIONS.find(item => item.id === section)!.href;

export async function crimePageMetadata(locale: Locale, section: CrimeSectionId) {
  const messages = await getMessages(locale, ["crime"]);
  return fiscalMetadata({ locale, path: crimeSectionHref(section), title: message(messages, `crime.page.${section}.metaTitle`), description: message(messages, `crime.page.${section}.summary`) });
}

/**
 * The archived Geostat workbooks a page's values were read from, each with the years it supplies, then the archived
 * population table the per-100,000 view divides by. Links point to the copies in the fiscal.ge source archive.
 */
export async function crimeSources(locale: Locale, facts: readonly { sourceId: string; year: number }[]): Promise<SourcedWorkbookPublicSource[]> {
  const used = [...new Set(facts.map(f => f.sourceId))];
  const [archived, population] = await Promise.all([
    loadSourcedWorkbookSources("crime", locale, row => used.includes(row.source_id)),
    loadSourcedWorkbookSources("demography", locale, row => row.source_id === SOURCE_ID.populationUnits),
  ]);
  return [...used.map(sourceId => {
    const source = archived.find(row => row.sourceId === sourceId);
    if (!source) throw new Error(`Missing reviewed crime source ${sourceId}`);
    return { ...source, years: [...new Set(facts.filter(f => f.sourceId === sourceId).map(f => f.year))].sort((a, b) => a - b) };
  }), ...population];
}

/** The frame every crime page shares: Dataset and breadcrumb JSON-LD, the breadcrumb header and the page's provider. */
export function renderCrimeFrame({ locale, presentation, path: href, title, description, facts, variableMeasured, children }: {
  locale: Locale; presentation: Presentation; path: `/${string}`; title: string; description: string;
  /** The served facts the page shows, for its years and review date. */
  facts: readonly CrimeFact[]; variableMeasured: string[]; children: ReactNode;
}) {
  const { messages } = presentation;
  const hubTitle = message(messages, "crime.title"), home = message(messages, "common.home");
  const years = facts.map(f => f.year), firstYear = Math.min(...years), lastYear = Math.max(...years);
  const lastReviewedAt = facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: home, href: pageHref("/", locale) }, { label: message(messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: hubTitle, href: pageHref(topicSection("crime").href, locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "crime", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // Every series the page offers, not only the headline one.
      variableMeasured,
    })} />
    <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, { name: message(messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: hubTitle, path: pageHref(topicSection("crime").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {children}
    </ExplorerPage>
  </I18nProvider>;
}
