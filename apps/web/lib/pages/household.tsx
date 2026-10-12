import path from "node:path";
import { notFound } from "next/navigation";
import { HouseholdExplorer } from "../../components/household/household-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedHouseholdData, toClientHouseholdFact } from "../data/household/importHousehold";
import { HOUSEHOLD_AREAS, HOUSEHOLD_MEASURES, type HouseholdArea, type HouseholdMeasure } from "../data/household/types";
import { WAGES_REGIONS } from "../data/wages/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { HOUSEHOLD_SECTIONS, householdCoverage, householdRegionHref, householdViewSeries, type HouseholdSectionId } from "../explorer/household";
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

export const householdRegionStaticParams = () => WAGES_REGIONS.map(id => ({ id: id.replace(/^region\./, "") }));
function regionForSlug(slug: string) {
  const id = `region.${slug}`;
  if (!(WAGES_REGIONS as readonly string[]).includes(id)) notFound();
  return REGIONAL_ECONOMY_REGIONS.find(region => region.id === id)!;
}
export async function householdRegionPageMetadata(section: HouseholdSectionId, slug: string, locale: Locale) {
  const region = regionForSlug(slug), presentation = await getPresentation(locale, ["household"], [region.id]);
  const name = publicLabel(locale, region.id, region.kaLabel, presentation.englishLabels);
  return fiscalMetadata({ locale, path: householdRegionHref(section, region.id), title: message(presentation.messages, `household.page.${section}.regionTitle`, { region: name }), description: message(presentation.messages, `household.page.${section}.regionSummary`, { region: name }) });
}
export const renderHouseholdRegionPage = (section: HouseholdSectionId, slug: string, locale: Locale) => renderHouseholdPage(locale, section, regionForSlug(slug).id as HouseholdArea);

/** Names of Georgia, towns, villages and the regions, in the page's language; region names are the Wages pages' own. */
function householdAreaLabels(presentation: Presentation): Record<HouseholdArea, string> {
  return Object.fromEntries(HOUSEHOLD_AREAS.map(area => {
    const region = REGIONAL_ECONOMY_REGIONS.find(item => item.id === area);
    return [area, region ? publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels) : message(presentation.messages, `household.area.${area}`)];
  })) as Record<HouseholdArea, string>;
}

/** A section page (Georgia, with the map whose regions open their own pages), or with regionId that region's page. */
export async function renderHouseholdPage(locale: Locale, section: HouseholdSectionId, regionId?: HouseholdArea) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedHouseholdData(), getPresentation(locale, ["household", "regionalEconomies", "common", "controls", "format", "main", "workbook"], WAGES_REGIONS),
    loadReviewedSourceManifest(root, "household-income"), loadEnglishCatalogue(root),
  ]);
  // Each page receives only its own section's observations, and a region page only its region's.
  const facts = data.facts.map(toClientHouseholdFact).filter(f => f.indicatorId.startsWith(`${section}.`) && (!regionId || f.areaId === regionId));
  const years = householdCoverage(section, regionId ?? "georgia", "per_household", facts).years;
  const firstYear = years[0], lastYear = years.at(-1)!;
  const sectionHref = HOUSEHOLD_SECTIONS.find(item => item.id === section)!.href;
  const href = regionId ? householdRegionHref(section, regionId) : sectionHref;
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `household.${key}`, values);
  // Line names; the towns and villages lines take their names from areaLabels.
  const labels = Object.fromEntries(householdViewSeries(section, "georgia").filter(series => series.indicatorId === series.id).map(series => [series.id, t(`series.${series.id}`)]));
  const areaLabels = householdAreaLabels(presentation);
  // The section page's map for each measure; the geometry is read on the server. Region pages have no map.
  const regionMaps = regionId ? undefined : Object.fromEntries(HOUSEHOLD_MEASURES.map(measure => [measure, buildHouseholdRegionMapModel(section, measure, facts)])) as Record<HouseholdMeasure, RegionMapModel>;
  const sources = householdWorkbookSources(manifest, projectPublicSources(manifest, locale, catalogue.documents));
  const regionName = regionId ? areaLabels[regionId] : "", sectionTitle = t(`page.${section}.title`);
  const title = regionId ? t(`page.${section}.regionTitle`, { region: regionName }) : sectionTitle;
  const description = regionId ? t(`page.${section}.regionSummary`, { region: regionName }) : t(`page.${section}.summary`), hubTitle = message(presentation.messages, "common.livingStandards");
  const lastReviewedAt = data.facts.filter(f => f.indicatorId.startsWith(`${section}.`) && (!regionId || f.areaId === regionId)).map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }, ...(regionId ? [{ label: sectionTitle, href: pageHref(sectionHref, locale) }] : []), { label: regionId ? regionName : title }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}${href}#dataset`, name: title, description, url: `${origin}${pageHref(href, locale)}`,
      temporalCoverage: `${firstYear}/${lastYear}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: regionId ? regionName : locale === "ka" ? "საქართველო" : "Georgia" },
      creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` },
      variableMeasured: [t(`latest.${section}`)],
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(LIVING_STANDARDS_HUB_PATH, locale) }, ...(regionId ? [{ name: sectionTitle, path: pageHref(sectionHref, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <HouseholdExplorer key={regionId ?? section} section={section} facts={facts} labels={labels} areaLabels={areaLabels} regionMaps={regionMaps} sources={sources} siteOrigin={origin} regionId={regionId} regions={regionId ? REGIONAL_ECONOMY_REGIONS : undefined} />
    </ExplorerPage>
  </I18nProvider>;
}
