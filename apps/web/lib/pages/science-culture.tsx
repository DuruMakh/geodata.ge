import { ScienceCultureExplorer } from "../../components/science-culture/science-culture-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedScienceCultureData, toClientScienceCultureFact } from "../data/scienceCulture/importScienceCulture";
import { coverageLabel } from "../explorer/coverageLabel";
import { SCIENCE_CULTURE_SECTIONS, scienceCultureCoverage, scienceCultureTopicSeries, type ScienceCultureTopicId } from "../explorer/scienceCulture";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { loadScienceCultureWorkbookSources, scienceCultureLabels } from "./science-culture-shared";
import { topicSection } from "../navigation/navTree";

const topicHref = (section: ScienceCultureTopicId) => SCIENCE_CULTURE_SECTIONS.find(item => item.id === section)!.href;

export async function scienceCulturePageMetadata(locale: Locale, section: ScienceCultureTopicId) {
  const messages = await getMessages(locale, ["scienceCulture"]);
  return fiscalMetadata({ locale, path: topicHref(section), title: message(messages, `scienceCulture.page.${section}.metaTitle`), description: message(messages, `scienceCulture.page.${section}.summary`) });
}

/** Research, Patents or Theatres: the latest line, then the chart workspace over Georgia's series. */
export async function renderScienceCulturePage(locale: Locale, section: ScienceCultureTopicId) {
  const [data, presentation, sources] = await Promise.all([
    loadServedScienceCultureData(), getPresentation(locale, ["scienceCulture", "format", "main", "workbook"], []), loadScienceCultureWorkbookSources(locale),
  ]);
  const series = scienceCultureTopicSeries(section);
  // Each page receives only the observations its list can show, and the counting changes that touch them.
  const ids = new Set<string>(series.map(({ id }) => id));
  const facts = data.facts.map(toClientScienceCultureFact).filter(f => ids.has(f.indicatorId));
  const breaks = data.breaks.filter(item => item.appliesTo.some(id => ids.has(id)));
  const { min: firstYear, max: lastYear } = scienceCultureCoverage(section, facts);
  const href = topicHref(section);
  const t = (key: string) => message(presentation.messages, `scienceCulture.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref(topicSection("science-culture").href, locale) }, { label: title }];
  // The measures the page shows, by their headings.
  const measures = [...new Set(series.map(({ heading }) => t(`heading.${heading}`)))];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({ locale, origin, path: href, datasetId: "science-culture", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, variableMeasured: measures })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref(topicSection("science-culture").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <ScienceCultureExplorer key={section} section={section} facts={facts} breaks={breaks} labels={scienceCultureLabels(presentation.messages, series)} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
