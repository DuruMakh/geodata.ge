import { HousingExplorer } from "../../components/housing/housing-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedHousingData, toClientHousingFact } from "../data/housing/importHousing";
import { HOUSING_SECTIONS, housingCoverage, housingTopicSeries, type HousingTopicId } from "../explorer/housing";
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
import { loadHousingWorkbookSources } from "./housing-shared";
import { topicSection } from "../navigation/navTree";

export async function housingPageMetadata(locale: Locale, section: HousingTopicId) {
  const messages = await getMessages(locale, ["housing"]);
  return fiscalMetadata({ locale, path: HOUSING_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `housing.page.${section}.metaTitle`), description: message(messages, `housing.page.${section}.summary`) });
}

/**
 * Display names for every series a topic page can show: all buildings and the building types, or the price index's
 * three rows and the Tbilisi districts. Names carry no prefix: the heading they sit under names their measure and unit.
 */
function housingLabels(presentation: Presentation, section: HousingTopicId): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `housing.${key}`);
  return Object.fromEntries(housingTopicSeries(section).map(({ id }) => {
    const [, measure, group] = id.split(".");
    if (measure === "price_index") return [id, t(`series.index.${group}`)];
    if (group.startsWith("district_")) return [id, t(`series.district.${group.slice("district_".length)}`)];
    return [id, group === "total" ? t("series.total") : t(`series.type.${group.slice("type_".length)}`)];
  }));
}

export async function renderHousingPage(locale: Locale, section: HousingTopicId) {
  const [data, presentation, sources] = await Promise.all([
    loadServedHousingData(), getPresentation(locale, ["housing", "format", "main", "workbook"], []), loadHousingWorkbookSources(locale),
  ]);
  // Each page receives only the observations its list can show.
  const ids = new Set<string>(housingTopicSeries(section).map(series => series.id));
  const facts = data.facts.map(toClientHousingFact).filter(f => ids.has(f.indicatorId));
  const { min: firstYear, max: lastYear } = housingCoverage(section, facts);
  const href = HOUSING_SECTIONS.find(item => item.id === section)!.href;
  const labels = housingLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `housing.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref(topicSection("housing").href, locale) }, { label: title }];
  // The measures the page shows, by their headings.
  const measures = [...new Set(housingTopicSeries(section).map(({ heading }) => t(`heading.${heading}`)))];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({ locale, origin, path: href, datasetId: "housing", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, variableMeasured: measures })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref(topicSection("housing").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <HousingExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
