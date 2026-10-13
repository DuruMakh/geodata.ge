import { PovertyExplorer } from "../../components/poverty/poverty-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedPovertyData, toClientPovertyFact } from "../data/poverty/importPoverty";
import { POVERTY_SECTIONS, povertyCoverage, povertyViewSeries, povertyViews, type PovertySectionId } from "../explorer/poverty";
import { LIVING_STANDARDS_HUB_PATH } from "../explorer/livingStandards";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

export async function povertyPageMetadata(locale: Locale, section: PovertySectionId) {
  const messages = await getMessages(locale, ["poverty"]);
  return fiscalMetadata({ locale, path: POVERTY_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `poverty.page.${section}.metaTitle`), description: message(messages, `poverty.page.${section}.summary`) });
}

/** Display names for every series a poverty page can show, in the page's language. */
function povertyLabels(presentation: Presentation, section: PovertySectionId): Record<string, string> {
  const ids = povertyViews(section).flatMap(view => povertyViewSeries(section, view).map(series => series.id));
  return Object.fromEntries(ids.map(id => [id, message(presentation.messages, `poverty.series.${id}`)]));
}

export async function renderPovertyPage(locale: Locale, section: PovertySectionId) {
  const [data, presentation, sources] = await Promise.all([
    loadServedPovertyData(), getPresentation(locale, ["poverty", "format", "main", "workbook"], []), loadSourcedWorkbookSources("poverty", locale),
  ]);
  // Each page receives only the observations its views can show.
  const facts = data.facts.map(toClientPovertyFact).filter(f => f.indicatorId.startsWith(section === "inequality" ? "gini." : "poverty."));
  const years = [...new Set(povertyViews(section).flatMap(view => povertyCoverage(section, view, facts).years))];
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const href = POVERTY_SECTIONS.find(item => item.id === section)!.href;
  const labels = povertyLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `poverty.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const hubTitle = message(presentation.messages, "common.livingStandards");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "poverty", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // Every series the page's views can show (the inequality page's six Gini measures, not one).
      variableMeasured: [...new Set(Object.values(labels))],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <PovertyExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
