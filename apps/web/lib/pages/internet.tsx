import { InternetExplorer } from "../../components/internet/internet-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedInternetData } from "../data/internet/importInternet";
import { INTERNET_SECTIONS, internetCoverage, internetTopicSeries, type InternetTopicId } from "../explorer/internet";
import { internetLabels, internetPageFacts } from "../explorer/internetPageData";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { loadInternetWorkbookSources } from "./internet-shared";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

export async function internetPageMetadata(locale: Locale, section: InternetTopicId) {
  const messages = await getMessages(locale, ["internet"]);
  return fiscalMetadata({ locale, path: INTERNET_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `internet.page.${section}.metaTitle`), description: message(messages, `internet.page.${section}.summary`) });
}

export async function renderInternetPage(locale: Locale, section: InternetTopicId) {
  const [data, presentation, sources] = await Promise.all([
    loadServedInternetData(), getPresentation(locale, ["internet", "format", "main", "workbook"], []), loadInternetWorkbookSources(locale),
  ]);
  // Each page receives only the observations its list can show.
  const facts = internetPageFacts(data.facts, section);
  const { min: firstYear, max: lastYear } = internetCoverage(section, facts);
  const href = INTERNET_SECTIONS.find(item => item.id === section)!.href;
  const labels = internetLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `internet.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: t("title"), href: pageHref(topicSection("internet").href, locale) }, { label: title }];
  // The measures the page shows, by their headings.
  const measures = [...new Set(internetTopicSeries(section).map(({ heading }) => t(`heading.${heading}`)))];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({ locale, origin, path: href, datasetId: "internet", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, variableMeasured: measures })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: message(presentation.messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: t("title"), path: pageHref(topicSection("internet").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <InternetExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
