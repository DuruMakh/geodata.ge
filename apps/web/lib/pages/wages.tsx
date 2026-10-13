import { notFound } from "next/navigation";
import { WagesExplorer } from "../../components/wages/wages-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { packFacts } from "../data/packedFacts";
import { loadServedWagesData, toClientWagesFact } from "../data/wages/importWages";
import { WAGES_GROUPS, WAGES_REGIONS, WAGES_SECTORS } from "../data/wages/types";
import { ECONOMIC_SECTORS } from "../data/economicSectors/importEconomicSectors";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { WAGES_SECTIONS, wagesCoverage, wagesRegionHref, wagesSummaryValues, wagesViews, type WagesSectionId } from "../explorer/wages";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { loadWagesPage } from "./wages-shared";

/** Display names for every series id a wages page can show, in the page's language. */
function wagesLabels(presentation: Presentation): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `wages.${key}`);
  const labels: Record<string, string> = { average: t("series.average"), median: t("series.median"), total: t("series.total") };
  for (const dimension of ["sex", "ownership", "business_sector"] as const) for (const id of WAGES_GROUPS[dimension]) labels[id] = t(`group.${id}`);
  for (const sector of ECONOMIC_SECTORS.filter(item => (WAGES_SECTORS as readonly string[]).includes(item.id))) labels[sector.id] = publicLabel(presentation.locale, sector.id, sector.labelKa, presentation.englishLabels);
  for (const region of REGIONAL_ECONOMY_REGIONS.filter(item => (WAGES_REGIONS as readonly string[]).includes(item.id))) labels[region.id] = publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels);
  return labels;
}

export const wagesRegionStaticParams = () => WAGES_REGIONS.map(id => ({ id: id.replace(/^region\./, "") }));
function regionForSlug(slug: string) {
  const id = `region.${slug}`;
  if (!(WAGES_REGIONS as readonly string[]).includes(id)) notFound();
  return REGIONAL_ECONOMY_REGIONS.find(region => region.id === id)!;
}
export async function wagesRegionPageMetadata(slug: string, locale: Locale) {
  const region = regionForSlug(slug), [presentation, data] = await Promise.all([getPresentation(locale, ["wages"], [region.id]), loadServedWagesData()]);
  const name = publicLabel(locale, region.id, region.kaLabel, presentation.englishLabels);
  return fiscalMetadata({ locale, path: wagesRegionHref(region.id), title: message(presentation.messages, "wages.regionTitle", { region: name }), description: message(presentation.messages, "wages.regionSummary", { region: name, ...wagesSummaryValues(data.facts.map(toClientWagesFact)) }) });
}
export const renderWagesRegionPage = (slug: string, locale: Locale) => renderWagesPage(locale, "regions", regionForSlug(slug).id);

export async function renderWagesPage(locale: Locale, section: WagesSectionId, regionId?: string) {
  const [{ data, presentation, facts }, sources] = await Promise.all([loadWagesPage(locale, section), loadSourcedWorkbookSources("wages", locale)]);
  // The Regions index (wages-regions-index.tsx) is the map and list; a region page serves its own region beside Georgia.
  if (regionId) facts.splice(0, facts.length, ...facts.filter(f => f.dimension !== "region" || f.groupId === regionId));
  const years = [...new Set(wagesViews(section).flatMap(view => wagesCoverage(section, view, facts).years))];
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const href = regionId ? wagesRegionHref(regionId) : WAGES_SECTIONS.find(item => item.id === section)!.href;
  const labels = wagesLabels(presentation), regionName = regionId ? labels[regionId] : "";
  // Beside a region, the national line is named as Georgia's.
  if (regionId) labels.average = message(presentation.messages, "wages.series.georgiaAverage");
  const t = (key: string) => message(presentation.messages, `wages.${key}`);
  const title = regionId ? message(presentation.messages, "wages.regionTitle", { region: regionName }) : t(`page.${section}.title`);
  const summaryValues = wagesSummaryValues(data.facts.map(toClientWagesFact));
  const description = message(presentation.messages, regionId ? "wages.regionSummary" : `wages.page.${section}.summary`, regionId ? { region: regionName, ...summaryValues } : summaryValues);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref("/explorer/wages", locale) }, ...(regionId ? [{ label: t("page.regions.title"), href: pageHref("/explorer/wages/regions", locale) }] : []), { label: regionId ? regionName : title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}${href}#dataset`, name: title, description, url: `${origin}${pageHref(href, locale)}`,
      temporalCoverage: `${firstYear}/${lastYear}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: regionId ? regionName : locale === "ka" ? "საქართველო" : "Georgia" },
      creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` },
      variableMeasured: [...new Set(facts.map(f => f.indicatorId))].map(id => t(id === "median_monthly_earnings" ? "series.median" : "series.average")),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref("/explorer/wages", locale) }, ...(regionId ? [{ name: t("page.regions.title"), path: pageHref("/explorer/wages/regions", locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <WagesExplorer key={regionId ?? section} section={section} facts={packFacts(facts)} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} regionId={regionId} regions={regionId ? REGIONAL_ECONOMY_REGIONS : undefined} />
    </ExplorerPage>
  </I18nProvider>;
}
