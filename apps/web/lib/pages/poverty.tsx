import path from "node:path";
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
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectPublicSources } from "../methodology/publicSources";
import { fiscalMetadata } from "../seo/metadata";
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
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedPovertyData(), getPresentation(locale, ["poverty", "common", "controls", "format", "main", "workbook"], []),
    loadReviewedSourceManifest(root, "poverty"), loadEnglishCatalogue(root),
  ]);
  // Each page receives only the observations its views can show.
  const facts = data.facts.map(toClientPovertyFact).filter(f => f.indicatorId.startsWith(section === "inequality" ? "gini." : "poverty."));
  const years = [...new Set(povertyViews(section).flatMap(view => povertyCoverage(section, view, facts).years))];
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const href = POVERTY_SECTIONS.find(item => item.id === section)!.href;
  const labels = povertyLabels(presentation, section);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  const sources = manifest.filter(source => source.media_type.includes("spreadsheet")).map(source => {
    const translated = publicSources.find(row => row.source_id === source.source_id)!;
    return { sourceId: source.source_id, years: source.years, title: translated.title, organization: translated.publisher, downloadHref: source.downloadHref, retrievedAt: source.retrieved_at };
  });
  const t = (key: string) => message(presentation.messages, `poverty.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const hubTitle = message(presentation.messages, "common.livingStandards");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }, { label: title }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}${href}#dataset`, name: title, description, url: `${origin}${pageHref(href, locale)}`,
      temporalCoverage: `${firstYear}/${lastYear}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "ka" ? "საქართველო" : "Georgia" },
      creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` },
      variableMeasured: povertyViews(section).map(view => view === "main" ? t("latest.inequality") : t(`tab.${view}`)),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <PovertyExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
