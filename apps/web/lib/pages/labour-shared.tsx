import type { ReactNode } from "react";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import type { LabourFact } from "../data/labour/types";
import { coverageLabel } from "../explorer/coverageLabel";
import { LABOUR_SECTIONS, type LabourSectionId } from "../explorer/labour";
import { getMessages } from "../i18n/messages.server";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

// Shared by the labour page module and the routes' metadata: keep explorer components out of this file.

export const labourSectionHref = (section: LabourSectionId) => LABOUR_SECTIONS.find(item => item.id === section)!.href;

export async function labourPageMetadata(locale: Locale, section: LabourSectionId) {
  const messages = await getMessages(locale, ["labour"]);
  return fiscalMetadata({ locale, path: labourSectionHref(section), title: message(messages, `labour.page.${section}.metaTitle`), description: message(messages, `labour.page.${section}.summary`) });
}

/** The frame every labour page shares: Dataset and breadcrumb JSON-LD, the Home › Data › Unemployment › page header and the page's provider. */
export function renderLabourFrame({ locale, presentation, path: href, title, description, facts, variableMeasured, children }: {
  locale: Locale; presentation: Presentation; path: `/${string}`; title: string; description: string;
  /** The served facts the page shows, for its years and review date. */
  facts: readonly LabourFact[]; variableMeasured: string[]; children: ReactNode;
}) {
  const { messages } = presentation;
  const hubTitle = message(messages, "common.unemployment"), home = message(messages, "common.home");
  const years = facts.map(f => f.year), firstYear = Math.min(...years), lastYear = Math.max(...years);
  const lastReviewedAt = facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: home, href: pageHref("/", locale) }, { label: message(messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: hubTitle, href: pageHref(topicSection("unemployment").href, locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "unemployment", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, downloadPath: "/downloads/data/unemployment.csv",
      // Every row the page lists, not only the headline one.
      variableMeasured,
    })} />
    <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, { name: message(messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: hubTitle, path: pageHref(topicSection("unemployment").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {children}
    </ExplorerPage>
  </I18nProvider>;
}
