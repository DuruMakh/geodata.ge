import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { BusinessAreaExplorer } from "../../components/business/business-area-explorer";
import { BusinessIndex } from "../../components/business/business-index";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedBusinessData, toClientBusinessFact } from "../data/business/importBusiness";
import type { BusinessFact } from "../data/business/types";
import { BUSINESS_AREAS, BUSINESS_REGIONS_HREF, businessAreaCoverage, businessAreaHref, businessAreaSeries, businessAreaSlug, businessMapId, type BusinessArea, type BusinessMapMeasure } from "../explorer/businessAreas";
import { BUSINESS_AREA_LABEL_IDS, BUSINESS_AREA_PAGES, businessAreaFacts, businessAreaLabels, businessAreaSeriesLabels } from "../explorer/businessPageData";
import { buildBusinessRegionMapModel } from "../explorer/businessRegionMap";
import { coverageLabel } from "../explorer/coverageLabel";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import { I18nProvider } from "../i18n/provider";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { areaTitleForm, latestYearOf } from "../seo/placeTitleForms";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

export const businessAreaStaticParams = () => BUSINESS_AREAS.map(area => ({ id: businessAreaSlug(area) }));
function areaForSlug(slug: string): BusinessArea {
  const area = BUSINESS_AREAS.find(item => businessAreaSlug(item) === slug);
  if (!area) notFound();
  return area;
}

export async function businessRegionsPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["business"]);
  return fiscalMetadata({ locale, path: BUSINESS_REGIONS_HREF, title: message(messages, "business.page.regions.metaTitle"), description: message(messages, "business.page.regions.summary") });
}

export async function businessAreaPageMetadata(slug: string, locale: Locale) {
  const area = areaForSlug(slug), [presentation, data] = await Promise.all([getPresentation(locale, ["business"], BUSINESS_AREA_LABEL_IDS), loadServedBusinessData()]);
  const name = businessAreaLabels(presentation)[area];
  // The title is worded the way people search it and ends in the area's latest year; the page's own heading and Dataset name keep regionTitle.
  const ids = new Set<string>(businessAreaSeries(area).map(series => series.id));
  const seoTitle = message(presentation.messages, "business.page.area.seoTitle", { place: areaTitleForm(businessMapId(area), name, locale, "in"), year: latestYearOf(data.facts, f => ids.has(f.indicatorId)) });
  return fiscalMetadata({ locale, path: businessAreaHref(area), title: seoTitle, description: message(presentation.messages, "business.page.area.regionSummary", { region: name }) });
}

type BusinessRegionsBody = { facts: BusinessFact[]; presentation: Presentation; areaLabels: Record<BusinessArea, string>; origin: string; lastReviewedAt: string };

/** The Regions index, or with `area` that area's page: the frame both share (crumbs, Dataset, header) around the page's own body. */
async function renderBusinessRegionsFrame(locale: Locale, area: BusinessArea | undefined, years: (facts: BusinessFact[]) => number[], body: (page: BusinessRegionsBody) => ReactNode) {
  const [data, presentation] = await Promise.all([loadServedBusinessData(), getPresentation(locale, ["business", "regionalEconomies", "format", "main", "workbook"], BUSINESS_AREA_LABEL_IDS, BUSINESS_AREA_LABEL_IDS)]);
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `business.${key}`, values);
  const areaLabels = businessAreaLabels(presentation);
  const regionsTitle = t("page.regions.title"), regionName = area ? areaLabels[area] : "";
  const title = area ? t("page.area.regionTitle", { region: regionName }) : regionsTitle;
  const description = area ? t("page.area.regionSummary", { region: regionName }) : t("page.regions.summary");
  const href = area ? businessAreaHref(area) : BUSINESS_REGIONS_HREF;
  const covered = years(data.facts), firstYear = Math.min(...covered), lastYear = Math.max(...covered);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const hubTitle = t("title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: hubTitle, href: pageHref(topicSection("business").href, locale) }, ...(area ? [{ label: regionsTitle, href: pageHref(BUSINESS_REGIONS_HREF, locale) }] : []), { label: area ? regionName : title }];
  // The measures the page shows, by name: an area's list, or the index map's sales and jobs.
  const measures = area ? businessAreaSeries(area).map(series => series.id.split(".")[1]) : ["turnover", "employed"];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "business", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // An area page is a slice of the regions' dataset.
      ...(area ? { spatialCoverageName: regionName, withinGeorgia: area !== "georgia", partOf: { path: BUSINESS_REGIONS_HREF, name: regionsTitle, description: t("page.regions.summary") } } : {}),
      variableMeasured: [...new Set(measures.map(measure => t(`series.${measure}`)))],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: message(presentation.messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: hubTitle, path: pageHref(topicSection("business").path, locale) }, ...(area ? [{ name: regionsTitle, path: pageHref(BUSINESS_REGIONS_HREF, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {body({ facts: data.facts, presentation, areaLabels, origin, lastReviewedAt })}
    </ExplorerPage>
  </I18nProvider>;
}

/** The Regions index: the map and list whose rows open the area pages. The maps are built here; the page receives only Georgia's two totals. */
export function renderBusinessRegionsPage(locale: Locale) {
  let maps: Record<BusinessMapMeasure, RegionMapModel> | undefined;
  const regionMaps = (facts: BusinessFact[]) => maps ??= Object.fromEntries((["turnover", "employed"] as const).map(measure => [measure, buildBusinessRegionMapModel(measure, facts.map(toClientBusinessFact))])) as Record<BusinessMapMeasure, RegionMapModel>;
  return renderBusinessRegionsFrame(locale, undefined, facts => { const { turnover } = regionMaps(facts); return [turnover.firstYear, turnover.year]; }, ({ facts }) =>
    <BusinessIndex facts={facts.map(toClientBusinessFact).filter(f => f.indicatorId === "business.turnover.total" || f.indicatorId === "business.employed.total")} regionMaps={regionMaps(facts)} />);
}

export async function renderBusinessAreaPage(locale: Locale, slug: string) {
  const area = areaForSlug(slug);
  // The Sources sheet lists the archived Geostat workbooks (data/methodology/source-archives/business.csv) behind the exported values.
  const sources = await loadSourcedWorkbookSources("business", locale);
  return renderBusinessRegionsFrame(locale, area, facts => businessAreaCoverage(area, businessAreaFacts(facts, area)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) =>
    // Every row is its measure's name: the area is the page's own.
    <BusinessAreaExplorer key={area} area={area} facts={businessAreaFacts(facts, area)} labels={businessAreaSeriesLabels(presentation.messages, area)} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={BUSINESS_AREA_PAGES} />);
}
