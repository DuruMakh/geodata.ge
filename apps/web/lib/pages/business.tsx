import { BusinessExplorer, type BusinessExplorerProps } from "../../components/business/business-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedBusinessData, toClientBusinessFact } from "../data/business/importBusiness";
import { BUSINESS_DEMOGRAPHY_SECTORS, type BusinessGroup, type BusinessMeasure } from "../data/business/types";
import { ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { BUSINESS_HUB_PATH, BUSINESS_SECTIONS, businessCoverage, businessViews, businessViewSeries, type BusinessTopicId } from "../explorer/business";
import { buildBusinessHubCards } from "../explorer/businessHubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { TopicHub } from "./hub";

/** The shared economic-sector labels the industry rows wear (`sector_x` is `sector.x`); the survey's B–E group and the unknown activity have their own. */
const BUSINESS_SECTOR_LABEL_IDS = BUSINESS_DEMOGRAPHY_SECTORS.map(group => `sector.${group.slice("sector_".length)}`);

/** A size's or industry's name, in the page's language: industries take the Economy pages' sector names, as Wages does. */
function businessGroupLabel(presentation: Presentation, group: BusinessGroup): string {
  const sector = ECONOMIC_SECTORS.find(item => item.id === `sector.${group.slice("sector_".length)}`);
  return group.startsWith("sector_") && sector ? publicLabel(presentation.locale, sector.id, sector.labelKa, presentation.englishLabels) : message(presentation.messages, `business.group.${group}`);
}

export async function businessHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["business"]);
  return fiscalMetadata({ locale, path: BUSINESS_HUB_PATH, title: message(messages, "business.metaTitle"), description: message(messages, "business.metaDescription") });
}

export async function renderBusinessHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedBusinessData(), getPresentation(locale, ["business"], [])]);
  const title = message(presentation.messages, "business.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "business.hubSummary")} path={BUSINESS_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildBusinessHubCards(facts.map(toClientBusinessFact), presentation)} testId="business-hub" />;
}

export async function businessPageMetadata(locale: Locale, section: BusinessTopicId) {
  const messages = await getMessages(locale, ["business"]);
  return fiscalMetadata({ locale, path: BUSINESS_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `business.page.${section}.metaTitle`), description: message(messages, `business.page.${section}.summary`) });
}

/** Every series a topic page can show (Firms' two views list different ones). */
function sectionSeries(section: BusinessTopicId) {
  return businessViews(section).flatMap(view => businessViewSeries(section, view));
}

/**
 * Display names for every series a topic page can show. Sales and Jobs call their total "All firms"; elsewhere a total
 * is its measure's name (Investment, New firms…). Parts carry no prefix: the heading or parent they sit under names them
 * (the chart, table and workbook add a nested part's parent name).
 */
function businessLabels(presentation: Presentation, section: BusinessTopicId): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `business.${key}`);
  return Object.fromEntries(sectionSeries(section).map(({ id }) => {
    const [, measure, group] = id.split(".") as [string, BusinessMeasure, BusinessGroup];
    return [id, group !== "total" ? businessGroupLabel(presentation, group) : section === "sales" || section === "jobs" ? t("series.total") : t(`series.${measure}`)];
  }));
}

export async function renderBusinessPage(locale: Locale, section: BusinessTopicId) {
  const [data, presentation] = await Promise.all([
    loadServedBusinessData(), getPresentation(locale, ["business", "format", "main", "workbook"], BUSINESS_SECTOR_LABEL_IDS),
  ]);
  // Each page receives only the observations its views can show.
  const ids = new Set<string>(sectionSeries(section).map(series => series.id));
  const facts = data.facts.map(toClientBusinessFact).filter(f => ids.has(f.indicatorId));
  // The archived Geostat workbooks join with the business methodology (Task 8); until then the Sources sheet lists none.
  const sources: BusinessExplorerProps["sources"] = [];
  const years = [...new Set(businessViews(section).flatMap(view => businessCoverage(section, view, facts).years))];
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const href = BUSINESS_SECTIONS.find(item => item.id === section)!.href;
  const labels = businessLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `business.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref(BUSINESS_HUB_PATH, locale) }, { label: title }];
  // The measures the page shows, by name (a rate wears its count's name).
  const measures = [...new Set(sectionSeries(section).map(({ id }) => t(`series.${id.split(".")[1]}`)))];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({ locale, origin, path: href, datasetId: "business", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, variableMeasured: measures })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref(BUSINESS_HUB_PATH, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <BusinessExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
