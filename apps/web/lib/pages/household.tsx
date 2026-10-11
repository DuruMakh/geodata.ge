import path from "node:path";
import { HouseholdExplorer } from "../../components/household/household-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedHouseholdData, toClientHouseholdFact } from "../data/household/importHousehold";
import { HOUSEHOLD_AREAS, HOUSEHOLD_MEASURES, type HouseholdArea, type HouseholdMeasure } from "../data/household/types";
import { WAGES_REGIONS } from "../data/wages/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { HOUSEHOLD_SECTIONS, householdCoverage, householdViewSeries, type HouseholdSectionId } from "../explorer/household";
import { householdWorkbookSources } from "../explorer/householdWorkbook";
import { buildHouseholdRegionMapModel } from "../explorer/householdRegionMap";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import { LIVING_STANDARDS_HUB_PATH } from "../explorer/livingStandards";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { projectPublicSources } from "../methodology/publicSources";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";

export async function householdPageMetadata(locale: Locale, section: HouseholdSectionId) {
  const messages = await getMessages(locale, ["household"]);
  return fiscalMetadata({ locale, path: HOUSEHOLD_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `household.page.${section}.metaTitle`), description: message(messages, `household.page.${section}.summary`) });
}

/** Names of Georgia, towns, villages and the regions, in the page's language; region names are the Wages pages' own. */
function householdAreaLabels(presentation: Presentation): Record<HouseholdArea, string> {
  return Object.fromEntries(HOUSEHOLD_AREAS.map(area => {
    const region = REGIONAL_ECONOMY_REGIONS.find(item => item.id === area);
    return [area, region ? publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels) : message(presentation.messages, `household.area.${area}`)];
  })) as Record<HouseholdArea, string>;
}

export async function renderHouseholdPage(locale: Locale, section: HouseholdSectionId) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedHouseholdData(), getPresentation(locale, ["household", "regionalEconomies", "common", "controls", "format", "main", "workbook"], WAGES_REGIONS),
    loadReviewedSourceManifest(root, "household-income"), loadEnglishCatalogue(root),
  ]);
  // Each page receives only its own section's observations.
  const facts = data.facts.map(toClientHouseholdFact).filter(f => f.indicatorId.startsWith(`${section}.`));
  const years = householdCoverage(section, "georgia", "per_household", facts).years;
  const firstYear = years[0], lastYear = years.at(-1)!;
  const href = HOUSEHOLD_SECTIONS.find(item => item.id === section)!.href;
  const t = (key: string) => message(presentation.messages, `household.${key}`);
  // Line names; the towns and villages lines take their names from areaLabels.
  const labels = Object.fromEntries(householdViewSeries(section, "georgia").filter(series => series.indicatorId === series.id).map(series => [series.id, t(`series.${series.id}`)]));
  const areaLabels = householdAreaLabels(presentation);
  // The area-picking map for each measure; the geometry is read on the server.
  const regionMaps = Object.fromEntries(HOUSEHOLD_MEASURES.map(measure => [measure, buildHouseholdRegionMapModel(section, measure, facts)])) as Record<HouseholdMeasure, RegionMapModel>;
  const sources = householdWorkbookSources(manifest, projectPublicSources(manifest, locale, catalogue.documents));
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`), hubTitle = message(presentation.messages, "common.livingStandards");
  const lastReviewedAt = data.facts.filter(f => f.indicatorId.startsWith(`${section}.`)).map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }, { label: title }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}${href}#dataset`, name: title, description, url: `${origin}${pageHref(href, locale)}`,
      temporalCoverage: `${firstYear}/${lastYear}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "ka" ? "საქართველო" : "Georgia" },
      creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` },
      variableMeasured: [t(`latest.${section}`)],
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <HouseholdExplorer key={section} section={section} facts={facts} labels={labels} areaLabels={areaLabels} regionMaps={regionMaps} sources={sources} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
