import path from "node:path";
import { UnemploymentExplorer } from "../../components/unemployment/unemployment-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS } from "../data/unemployment/importUnemployment";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectPublicSources } from "../methodology/publicSources";
import { fiscalMetadata } from "../seo/metadata";
import { formatDisplayDate } from "../explorer/format";
import { resolveSiteUrl } from "../siteUrl";

export async function unemploymentPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["unemployment"]);
  return fiscalMetadata({ locale, path: "/explorer/unemployment", title: message(messages, "unemployment.metaTitle"), description: message(messages, "unemployment.metaDescription") });
}
export async function renderUnemploymentPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [{ facts }, presentation, manifest, catalogue] = await Promise.all([
    loadServedUnemploymentData(), getPresentation(locale, ["unemployment", "common", "controls", "format", "main", "workbook"], UNEMPLOYMENT_GROUPS.map(group => group.id)),
    loadReviewedSourceManifest(root, "unemployment"), loadEnglishCatalogue(root),
  ]);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  const sources = manifest.map(source => {
    const translated = publicSources.find(row => row.source_id === source.source_id)!;
    return { sourceId: source.source_id, years: source.years, title: translated.title, organization: translated.publisher, downloadHref: source.downloadHref, retrievedAt: source.retrieved_at };
  });
  const title = message(presentation.messages, "unemployment.title"), firstYear = Math.min(...facts.map(f => f.year)), lastYear = Math.max(...facts.map(f => f.year));
  const lastReviewedAt = facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: title }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/unemployment#dataset`, name: title,
      description: message(presentation.messages, "unemployment.metaDescription"), url: `${origin}${pageHref("/explorer/unemployment", locale)}`,
      temporalCoverage: `${firstYear}/${lastYear}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "ka" ? "საქართველო" : "Georgia" },
      measurementTechnique: "Labour Force Survey", creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" },
      publisher: { "@id": `${origin}/#organization` },
      variableMeasured: [...new Set(facts.map(f => f.indicatorId))].map(indicator => message(presentation.messages, `unemployment.indicator.${indicator}`)),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: title, path: pageHref("/explorer/unemployment", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${firstYear}–${lastYear} · ${message(presentation.messages, "main.updated", { date: locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt })}`} />
      <UnemploymentExplorer facts={facts.map(({ dimension, groupId, sex, indicatorId, year, value, publishedValue, sourceId }) => ({ dimension, groupId, sex, indicatorId, year, value, publishedValue, sourceId }))} registry={UNEMPLOYMENT_GROUPS} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
