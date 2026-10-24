import path from "node:path";
import { UnemploymentExplorer } from "../../components/unemployment/unemployment-explorer";
import { UnemploymentRegionsIndex } from "../../components/unemployment/unemployment-regions-index";
import { buildUnemploymentRegionMapModel, UNEMPLOYMENT_REGIONS } from "../explorer/unemploymentRegionMap";
import { unemploymentRegionHref } from "../explorer/unemploymentRegionRoutes";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedUnemploymentData, UNEMPLOYMENT_GROUPS, UNEMPLOYMENT_REGISTRY } from "../data/unemployment/importUnemployment";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectPublicSources } from "../methodology/publicSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { coverageLabel } from "../explorer/coverageLabel";
import { resolveSiteUrl } from "../siteUrl";
import { unemploymentIndicators } from "../data/unemployment/types";
import { unemploymentOverviewIndicators } from "../explorer/unemploymentOverview";
import { UNEMPLOYMENT_SECTIONS, unemploymentBreakdownsForSection, type UnemploymentSectionId } from "../explorer/unemploymentSections";
import { UNEMPLOYMENT_AGE_FIRST_YEAR } from "../explorer/unemploymentAge";

export async function unemploymentPageMetadata(locale: Locale, section: UnemploymentSectionId) {
  const messages = await getMessages(locale, ["unemployment"]);
  return fiscalMetadata({ locale, path: UNEMPLOYMENT_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `unemployment.page.${section}.title`), description: message(messages, `unemployment.page.${section}.summary`) });
}

export async function renderUnemploymentPage(locale: Locale, section: UnemploymentSectionId, regionId?: string) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedUnemploymentData(), getPresentation(locale, ["unemployment", "regionalEconomies", "format", "main", "workbook"], UNEMPLOYMENT_GROUPS.map(group => group.id), UNEMPLOYMENT_REGIONS.map(region => region.id)),
    loadReviewedSourceManifest(root, "unemployment"), loadEnglishCatalogue(root),
  ]);
  const dimensions = new Set([...unemploymentBreakdownsForSection(section), "national", ...(section === "overview" ? ["sex"] : [])]);
  const mainBreakdown = UNEMPLOYMENT_SECTIONS.find(item => item.id === section)!.breakdown;
  const facts = data.facts.filter(fact => (section !== "age" || fact.dimension === "age" && fact.year >= UNEMPLOYMENT_AGE_FIRST_YEAR) && (!regionId || fact.dimension === "region" && fact.groupId === regionId) && dimensions.has(fact.dimension) && (section === "overview" ? (fact.dimension === "sex" ? fact.indicatorId === "unemployment_rate" : unemploymentOverviewIndicators(fact.dimension).includes(fact.indicatorId)) : section === "regions" ? unemploymentOverviewIndicators("region").includes(fact.indicatorId) : unemploymentIndicators(mainBreakdown).includes(fact.indicatorId)));
  const sectionPath = regionId ? unemploymentRegionHref(regionId) : UNEMPLOYMENT_SECTIONS.find(item => item.id === section)!.href;
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  const sources = manifest.map(source => {
    const translated = publicSources.find(row => row.source_id === source.source_id)!;
    return { sourceId: source.source_id, years: source.years, title: translated.title, organization: translated.publisher, downloadHref: source.downloadHref, retrievedAt: source.retrieved_at };
  });
  const region = regionId ? UNEMPLOYMENT_GROUPS.find(group => group.id === regionId)! : null;
  const regionName = region ? locale === "en" ? region.labelEn : region.labelKa : "";
  const title = region ? message(presentation.messages, "unemployment.regionTitle", { region: regionName }) : message(presentation.messages, `unemployment.page.${section}.title`), firstYear = Math.min(...facts.map(f => f.year)), lastYear = Math.max(...facts.map(f => f.year));
  const description = region ? message(presentation.messages, "unemployment.regionSummary", { region: regionName }) : message(presentation.messages, `unemployment.page.${section}.summary`);
  const lastReviewedAt = facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: message(presentation.messages, "unemployment.title"), href: pageHref("/explorer/unemployment", locale) }, { label: region ? regionName : title }];
  if (region) crumbs.splice(3, 0, { label: message(presentation.messages, "unemployment.page.regions.title"), href: pageHref("/explorer/unemployment/regions", locale) });
  // A region first published later than the regional series starts was split out of a combined group: its page
  // carries the split-region note (U17-11). Read from the facts, not listed.
  const regionFirstYear = (id?: string) => Math.min(...data.facts.filter(f => f.dimension === "region" && (!id || f.groupId === id)).map(f => f.year));
  const regionSplit = regionId ? regionFirstYear(regionId) > regionFirstYear() : undefined;
  const explorer = { section, regionId, regionSplit, regions: regionId ? UNEMPLOYMENT_REGIONS : undefined, facts: facts.map(({ dimension, groupId, sex, indicatorId, year, value, sourceId }) => ({ dimension, groupId, sex, indicatorId, year, value, sourceId })), registry: UNEMPLOYMENT_REGISTRY, sources, lastReviewedAt, siteOrigin: origin };
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: sectionPath, datasetId: "unemployment", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // A region page is a slice of the Regions page's dataset.
      ...(region ? { spatialCoverageName: regionName, withinGeorgia: true, partOf: { path: "/explorer/unemployment/regions", name: message(presentation.messages, "unemployment.page.regions.title"), description: message(presentation.messages, "unemployment.page.regions.summary") } } : {}),
      variableMeasured: [...new Set(facts.map(f => f.indicatorId))].map(indicator => message(presentation.messages, `unemployment.indicator.${indicator}`)),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: crumbs[2].label, path: pageHref("/explorer/unemployment", locale) }, ...(region ? [{ name: message(presentation.messages, "unemployment.page.regions.title"), path: pageHref("/explorer/unemployment/regions", locale) }] : []), { name: title, path: pageHref(sectionPath, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {section === "regions" && !regionId ? <UnemploymentRegionsIndex model={buildUnemploymentRegionMapModel(facts)} explorer={explorer} /> : <UnemploymentExplorer key={regionId ?? section} {...explorer} />}
    </ExplorerPage>
  </I18nProvider>;
}
