import { InternetExplorer } from "../../components/internet/internet-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedInternetData, toClientInternetFact } from "../data/internet/importInternet";
import { INTERNET_HUB_PATH, INTERNET_SECTIONS, internetCoverage, internetTopicSeries, type InternetTopicId } from "../explorer/internet";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { loadInternetWorkbookSources } from "./internet-shared";

export async function internetPageMetadata(locale: Locale, section: InternetTopicId) {
  const messages = await getMessages(locale, ["internet"]);
  return fiscalMetadata({ locale, path: INTERNET_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `internet.page.${section}.metaTitle`), description: message(messages, `internet.page.${section}.summary`) });
}

/**
 * Display names for every series a topic page can show: a group (Everyone, Towns, …), an online activity or a kind of
 * contact with public services. Names carry no prefix: the heading they sit under names the measure and who it counts.
 */
function internetLabels(presentation: Presentation, section: InternetTopicId): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `internet.${key}`);
  return Object.fromEntries(internetTopicSeries(section).map(({ id, heading }) => {
    const [, measure, group] = id.split(".");
    if (heading === "activities") return [id, t(`series.activity.${measure.slice("activity_".length)}`)];
    if (heading === "egov") return [id, t(`series.egov.${measure.slice("egov_".length)}`)];
    return [id, t(`series.group.${group}`)];
  }));
}

export async function renderInternetPage(locale: Locale, section: InternetTopicId) {
  const [data, presentation, sources] = await Promise.all([
    loadServedInternetData(), getPresentation(locale, ["internet", "format", "main", "workbook"], []), loadInternetWorkbookSources(locale),
  ]);
  // Each page receives only the observations its list can show.
  const ids = new Set<string>(internetTopicSeries(section).map(series => series.id));
  const facts = data.facts.map(toClientInternetFact).filter(f => ids.has(f.indicatorId));
  const { min: firstYear, max: lastYear } = internetCoverage(section, facts);
  const href = INTERNET_SECTIONS.find(item => item.id === section)!.href;
  const labels = internetLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `internet.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref(INTERNET_HUB_PATH, locale) }, { label: title }];
  // The measures the page shows, by their headings.
  const measures = [...new Set(internetTopicSeries(section).map(({ heading }) => t(`heading.${heading}`)))];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({ locale, origin, path: href, datasetId: "internet", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, variableMeasured: measures })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref(INTERNET_HUB_PATH, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <InternetExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
