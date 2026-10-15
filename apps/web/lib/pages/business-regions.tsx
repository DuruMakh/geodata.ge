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
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { BUSINESS_HUB_PATH } from "../explorer/business";
import { BUSINESS_AREAS, BUSINESS_REGIONS_HREF, businessAreaCoverage, businessAreaHref, businessAreaSeries, businessAreaSlug, businessMapId, type BusinessArea, type BusinessMapMeasure } from "../explorer/businessAreas";
import { buildBusinessRegionMapModel } from "../explorer/businessRegionMap";
import { coverageLabel } from "../explorer/coverageLabel";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import { I18nProvider } from "../i18n/provider";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
const AREA_PAGES: readonly MunicipalRegion[] = BUSINESS_AREAS.map(area => area === "georgia" ? { id: area, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === businessMapId(area))!);
const AREA_LABEL_IDS = AREA_PAGES.map(area => area.id);

export const businessAreaStaticParams = () => BUSINESS_AREAS.map(area => ({ id: businessAreaSlug(area) }));
function areaForSlug(slug: string): BusinessArea {
  const area = BUSINESS_AREAS.find(item => businessAreaSlug(item) === slug);
  if (!area) notFound();
  return area;
}

/** Names of Georgia and the regions, in the page's language; region names are the shared region labels. */
function businessAreaLabels(presentation: Presentation): Record<BusinessArea, string> {
  return Object.fromEntries(BUSINESS_AREAS.map((area, index) => [area, area === "georgia" ? message(presentation.messages, "business.area.georgia")
    : publicLabel(presentation.locale, AREA_PAGES[index].id, AREA_PAGES[index].kaLabel, presentation.englishLabels)])) as Record<BusinessArea, string>;
}

export async function businessRegionsPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["business"]);
  return fiscalMetadata({ locale, path: BUSINESS_REGIONS_HREF, title: message(messages, "business.page.regions.metaTitle"), description: message(messages, "business.page.regions.summary") });
}

export async function businessAreaPageMetadata(slug: string, locale: Locale) {
  const area = areaForSlug(slug), presentation = await getPresentation(locale, ["business"], AREA_LABEL_IDS);
  const name = businessAreaLabels(presentation)[area];
  return fiscalMetadata({ locale, path: businessAreaHref(area), title: message(presentation.messages, "business.page.area.regionTitle", { region: name }), description: message(presentation.messages, "business.page.area.regionSummary", { region: name }) });
}

type BusinessRegionsBody = { facts: BusinessFact[]; presentation: Presentation; areaLabels: Record<BusinessArea, string>; origin: string; lastReviewedAt: string };

/** The Regions index, or with `area` that area's page: the frame both share (crumbs, Dataset, header) around the page's own body. */
async function renderBusinessRegionsFrame(locale: Locale, area: BusinessArea | undefined, years: (facts: BusinessFact[]) => number[], body: (page: BusinessRegionsBody) => ReactNode) {
  const [data, presentation] = await Promise.all([loadServedBusinessData(), getPresentation(locale, ["business", "regionalEconomies", "format", "main", "workbook"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `business.${key}`, values);
  const areaLabels = businessAreaLabels(presentation);
  const regionsTitle = t("page.regions.title"), regionName = area ? areaLabels[area] : "";
  const title = area ? t("page.area.regionTitle", { region: regionName }) : regionsTitle;
  const description = area ? t("page.area.regionSummary", { region: regionName }) : t("page.regions.summary");
  const href = area ? businessAreaHref(area) : BUSINESS_REGIONS_HREF;
  const covered = years(data.facts), firstYear = Math.min(...covered), lastYear = Math.max(...covered);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const hubTitle = t("title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(BUSINESS_HUB_PATH, locale) }, ...(area ? [{ label: regionsTitle, href: pageHref(BUSINESS_REGIONS_HREF, locale) }] : []), { label: area ? regionName : title }];
  // The measures the page shows, by name: an area's list, or the index map's sales and jobs.
  const measures = area ? businessAreaSeries(area).map(series => series.id.split(".")[1]) : ["turnover", "employed"];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "business", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // An area page is a slice of the regions' dataset.
      ...(area ? { spatialCoverageName: regionName, withinGeorgia: area !== "georgia", partOf: { path: BUSINESS_REGIONS_HREF, name: regionsTitle, description: t("page.regions.summary") } } : {}),
      variableMeasured: [...new Set(measures.map(measure => t(`series.${measure}`)))],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(BUSINESS_HUB_PATH, locale) }, ...(area ? [{ name: regionsTitle, path: pageHref(BUSINESS_REGIONS_HREF, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
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
  const ids = new Set<string>(businessAreaSeries(area).map(series => series.id));
  const areaFacts = (facts: BusinessFact[]) => facts.map(toClientBusinessFact).filter(f => ids.has(f.indicatorId));
  return renderBusinessRegionsFrame(locale, area, facts => businessAreaCoverage(area, areaFacts(facts)).years, ({ facts, presentation, areaLabels, origin, lastReviewedAt }) => {
    // Every row is its measure's name: the area is the page's own.
    const labels = Object.fromEntries([...ids].map(id => [id, message(presentation.messages, `business.series.${id.split(".")[1]}`)]));
    return <BusinessAreaExplorer key={area} area={area} facts={areaFacts(facts)} labels={labels} areaLabels={areaLabels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} areas={AREA_PAGES} />;
  });
}
