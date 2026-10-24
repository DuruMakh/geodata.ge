import { EducationExplorer } from "../../components/education/education-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { LatestFigure } from "../../components/explorer-shell/latest-value-line";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedEducationData, shownEducationFacts, toClientEducationFact } from "../data/education/importEducation";
import { EDUCATION_GEORGIA, EDUCATION_SOURCES } from "../data/education/types";
import { coverageLabel } from "../explorer/coverageLabel";
import {
  EDUCATION_SECTIONS, educationCountLabel, educationCoverage, educationPeriodLabel, educationSeriesLabel, educationTemporalCoverage, educationTopicSeries,
  type EducationTopicId,
} from "../explorer/education";
import { Message } from "../i18n/message";
import { message } from "../i18n/messages";
import { getMessages } from "../i18n/messages.server";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection } from "../navigation/navTree";

/** The figure each topic page's latest line names, by the template's placeholder. */
const LATEST_FIGURE: Record<EducationTopicId, string> = { universities: "students", vocational: "admitted" };

const topicHref = (section: EducationTopicId) => EDUCATION_SECTIONS.find(item => item.id === section)!.href;

export async function educationTopicMetadata(locale: Locale, section: EducationTopicId) {
  const messages = await getMessages(locale, ["education"]);
  return fiscalMetadata({ locale, path: topicHref(section), title: message(messages, `education.page.${section}.metaTitle`), description: message(messages, `education.page.${section}.summary`) });
}

/** Universities or Vocational colleges: the latest line, then the chart workspace over Georgia's series. */
export async function renderEducationTopicPage(locale: Locale, section: EducationTopicId) {
  // The Sources sheet lists the archived Geostat workbooks (data/methodology/source-archives/education.csv) the values are read from.
  const [{ facts: served }, presentation, sources] = await Promise.all([
    loadServedEducationData(), getPresentation(locale, ["education", "format", "main", "workbook"], []), loadSourcedWorkbookSources("education", locale, row => EDUCATION_SOURCES.includes(row.source_id)),
  ]);
  const { messages } = presentation;
  const t = (key: string) => message(messages, `education.${key}`);
  const series = educationTopicSeries(section);
  // The page receives only the observations its list can show (never the old vocational fields).
  const ids = new Set<string>(series.map(({ id }) => id));
  const shown = shownEducationFacts(served).filter(f => ids.has(f.indicatorId) && f.geographyId === EDUCATION_GEORGIA);
  const facts = shown.map(toClientEducationFact);
  const { min, max } = educationCoverage(section, facts);
  const period = educationPeriodLabel(section);
  const href = topicHref(section);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = shown.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const headingLabels = Object.fromEntries(series.map(({ heading }) => [heading, t(`heading.${heading}`)]));
  const latest = facts.filter(f => f.indicatorId === series[0].id).sort((a, b) => a.year - b.year).at(-1)!;
  const crumbs = [
    { label: message(messages, "common.home"), href: pageHref("/", locale) },
    { label: message(messages, "common.data") },
    { label: t("title"), href: pageHref(topicSection("education").href, locale) },
    { label: title },
  ];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "education", name: title, description, ...educationTemporalCoverage(section, min, max), dateModified: lastReviewedAt,
      variableMeasured: [...new Set(Object.values(headingLabels))],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref(topicSection("education").path, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, period(min), period(max), lastReviewedAt)} />
      <EducationExplorer key={section} section={section} facts={facts}
        labels={Object.fromEntries(series.map(({ id }) => [id, educationSeriesLabel(messages, id)]))} headingLabels={headingLabels}
        latestLine={<Message messages={messages} id={`education.latest.${section}`} values={{ period: period(latest.year), [LATEST_FIGURE[section]]: <LatestFigure value={educationCountLabel(latest, t("unitThousand"))} /> }} />}
        sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
