import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedHousingData } from "../data/housing/importHousing";
import type { HousingFact } from "../data/housing/types";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { HOUSING_HUB_PATH } from "../explorer/housing";
import { HOUSING_AREAS, HOUSING_REGIONS_HREF, housingAreaHref, housingAreaSlug, housingMapId, type HousingArea } from "../explorer/housingAreas";
import { coverageLabel } from "../explorer/coverageLabel";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

// Shared by the housing page modules. The topic pages, the Regions index and the area pages are separate modules, so each
// ships only its own explorer: keep explorer components out of this file.

/**
 * The Sources sheet of a Housing workbook: the archived Geostat workbooks behind the exported values, keyed by the facts'
 * `sourceId`. Housing's source archive is not published yet, so the sheet lists none until it is.
 */
export async function loadHousingWorkbookSources(): Promise<(WorkbookPublicSource & { sourceId: string })[]> {
  return [];
}

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
export const AREA_PAGES: readonly MunicipalRegion[] = HOUSING_AREAS.map(area => area === "georgia" ? { id: area, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === housingMapId(area))!);
const AREA_LABEL_IDS = AREA_PAGES.map(area => area.id);
/** An area list's row names, in `housingAreaSeries` order: permits and completed, all buildings then homes, under each heading. */
export const AREA_SERIES_KEYS = ["permits", "permitsHomes", "completed", "completedHomes"] as const;

export const housingAreaStaticParams = () => HOUSING_AREAS.map(area => ({ id: housingAreaSlug(area) }));
export function areaForSlug(slug: string): HousingArea {
  const area = HOUSING_AREAS.find(item => housingAreaSlug(item) === slug);
  if (!area) notFound();
  return area;
}

/** Names of Georgia and the regions, in the page's language; region names are the shared region labels. */
function housingAreaLabels(presentation: Presentation): Record<HousingArea, string> {
  return Object.fromEntries(HOUSING_AREAS.map((area, index) => [area, area === "georgia" ? message(presentation.messages, "housing.area.georgia")
    : publicLabel(presentation.locale, AREA_PAGES[index].id, AREA_PAGES[index].kaLabel, presentation.englishLabels)])) as Record<HousingArea, string>;
}

export async function housingRegionsPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["housing"]);
  return fiscalMetadata({ locale, path: HOUSING_REGIONS_HREF, title: message(messages, "housing.page.regions.metaTitle"), description: message(messages, "housing.page.regions.summary") });
}

export async function housingAreaPageMetadata(slug: string, locale: Locale) {
  const area = areaForSlug(slug), presentation = await getPresentation(locale, ["housing"], AREA_LABEL_IDS);
  const name = housingAreaLabels(presentation)[area];
  return fiscalMetadata({ locale, path: housingAreaHref(area), title: message(presentation.messages, "housing.page.area.regionTitle", { region: name }), description: message(presentation.messages, "housing.page.area.regionSummary", { region: name }) });
}

export type HousingRegionsBody = { facts: HousingFact[]; presentation: Presentation; areaLabels: Record<HousingArea, string>; origin: string; lastReviewedAt: string };

/** The Regions index, or with `area` that area's page: the frame both share (crumbs, Dataset, header) around the page's own body. */
export async function renderHousingRegionsFrame(locale: Locale, area: HousingArea | undefined, years: (facts: HousingFact[]) => number[], body: (page: HousingRegionsBody) => ReactNode) {
  const [data, presentation] = await Promise.all([loadServedHousingData(), getPresentation(locale, ["housing", "regionalEconomies", "format", "main", "workbook"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `housing.${key}`, values);
  const areaLabels = housingAreaLabels(presentation);
  const regionsTitle = t("page.regions.title"), regionName = area ? areaLabels[area] : "";
  const title = area ? t("page.area.regionTitle", { region: regionName }) : regionsTitle;
  const description = area ? t("page.area.regionSummary", { region: regionName }) : t("page.regions.summary");
  const href = area ? housingAreaHref(area) : HOUSING_REGIONS_HREF;
  const covered = years(data.facts), firstYear = Math.min(...covered), lastYear = Math.max(...covered);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const hubTitle = t("title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(HOUSING_HUB_PATH, locale) }, ...(area ? [{ label: regionsTitle, href: pageHref(HOUSING_REGIONS_HREF, locale) }] : []), { label: area ? regionName : title }];
  // The measures the page shows, by name: an area's four rows, or the index map's permitted floor area.
  const measures = area ? AREA_SERIES_KEYS.map(key => t(`series.area.${key}`)) : [t("mapLabel")];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "housing", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // An area page is a slice of the regions' dataset.
      ...(area ? { spatialCoverageName: regionName, withinGeorgia: area !== "georgia", partOf: { path: HOUSING_REGIONS_HREF, name: regionsTitle, description: t("page.regions.summary") } } : {}),
      variableMeasured: measures,
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(HOUSING_HUB_PATH, locale) }, ...(area ? [{ name: regionsTitle, path: pageHref(HOUSING_REGIONS_HREF, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {body({ facts: data.facts, presentation, areaLabels, origin, lastReviewedAt })}
    </ExplorerPage>
  </I18nProvider>;
}
