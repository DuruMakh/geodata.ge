import { BusinessExplorer } from "../../components/business/business-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedBusinessData } from "../data/business/importBusiness";
import { BUSINESS_SECTIONS, businessCoverage, businessTopicSeries, type BusinessTopicId } from "../explorer/business";
import { BUSINESS_SECTOR_LABEL_IDS, businessLabels, businessPageFacts } from "../explorer/businessPageData";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

export async function businessPageMetadata(locale: Locale, section: BusinessTopicId) {
  const messages = await getMessages(locale, ["business"]);
  return fiscalMetadata({ locale, path: BUSINESS_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `business.page.${section}.metaTitle`), description: message(messages, `business.page.${section}.summary`) });
}

export async function renderBusinessPage(locale: Locale, section: BusinessTopicId) {
  // The Sources sheet lists the archived Geostat workbooks (data/methodology/source-archives/business.csv) behind the exported values.
  const [data, presentation, sources] = await Promise.all([
    loadServedBusinessData(), getPresentation(locale, ["business", "format", "main", "workbook"], BUSINESS_SECTOR_LABEL_IDS), loadSourcedWorkbookSources("business", locale),
  ]);
  // Each page receives only the observations its list can show.
  const facts = businessPageFacts(data.facts, section);
  const { min: firstYear, max: lastYear } = businessCoverage(section, facts);
  const href = BUSINESS_SECTIONS.find(item => item.id === section)!.href;
  const labels = businessLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `business.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: t("title"), href: pageHref(topicSection("business").href, locale) }, { label: title }];
  // The measures the page shows, by name (a rate wears its count's name).
  const measures = [...new Set(businessTopicSeries(section).map(({ id }) => t(`series.${id.split(".")[1]}`)))];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({ locale, origin, path: href, datasetId: "business", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, variableMeasured: measures })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: message(presentation.messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: t("title"), path: pageHref(topicSection("business").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <BusinessExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
