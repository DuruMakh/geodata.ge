import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedInternetData } from "../data/internet/importInternet";
import { INTERNET_SOURCES, type InternetFact } from "../data/internet/types";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { INTERNET_HUB_PATH } from "../explorer/internet";
import { INTERNET_AREAS, INTERNET_HOMES_HREF, internetAreaHref, internetAreaSeries, internetAreaSlug, internetMapId, type InternetArea } from "../explorer/internetAreas";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

// Shared by the internet page modules. The topic pages, the Internet at home index and the area pages are separate modules,
// so each ships only its own explorer: keep explorer components out of this file.

/**
 * The Sources sheet of an Internet workbook: the archived Geostat tables behind the exported values, in the page's language
 * and keyed by the facts' `sourceId`. Only the ten tables the values are read from are listed.
 */
export async function loadInternetWorkbookSources(locale: Locale): Promise<SourcedWorkbookPublicSource[]> {
  return loadSourcedWorkbookSources("internet", locale, row => INTERNET_SOURCES.includes(row.source_id));
}

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
export const AREA_PAGES: readonly MunicipalRegion[] = INTERNET_AREAS.map(area => area === "georgia" ? { id: area, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === internetMapId(area))!);
const AREA_LABEL_IDS = AREA_PAGES.map(area => area.id);

export const internetAreaStaticParams = () => INTERNET_AREAS.map(area => ({ id: internetAreaSlug(area) }));
export function areaForSlug(slug: string): InternetArea {
  const area = INTERNET_AREAS.find(item => internetAreaSlug(item) === slug);
  if (!area) notFound();
  return area;
}

/** Names of Georgia and the regions, in the page's language; region names are the shared region labels. */
function internetAreaLabels(presentation: Presentation): Record<InternetArea, string> {
  return Object.fromEntries(INTERNET_AREAS.map((area, index) => [area, area === "georgia" ? message(presentation.messages, "internet.area.georgia")
    : publicLabel(presentation.locale, AREA_PAGES[index].id, AREA_PAGES[index].kaLabel, presentation.englishLabels)])) as Record<InternetArea, string>;
}

export async function internetHomesPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["internet"]);
  return fiscalMetadata({ locale, path: INTERNET_HOMES_HREF, title: message(messages, "internet.page.homes.metaTitle"), description: message(messages, "internet.page.homes.summary") });
}

export async function internetAreaPageMetadata(slug: string, locale: Locale) {
  const area = areaForSlug(slug), presentation = await getPresentation(locale, ["internet"], AREA_LABEL_IDS);
  const name = internetAreaLabels(presentation)[area];
  return fiscalMetadata({ locale, path: internetAreaHref(area), title: message(presentation.messages, "internet.page.area.regionTitle", { region: name }), description: message(presentation.messages, "internet.page.area.regionSummary", { region: name }) });
}

export type InternetHomesBody = { facts: InternetFact[]; presentation: Presentation; areaLabels: Record<InternetArea, string>; origin: string; lastReviewedAt: string };

/** The Internet at home index, or with `area` that area's page: the frame both share (crumbs, Dataset, header) around the page's own body. */
export async function renderInternetHomesFrame(locale: Locale, area: InternetArea | undefined, years: (facts: InternetFact[]) => number[], body: (page: InternetHomesBody) => ReactNode) {
  const [data, presentation] = await Promise.all([loadServedInternetData(), getPresentation(locale, ["internet", "regionalEconomies", "format", "main", "workbook"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `internet.${key}`, values);
  const areaLabels = internetAreaLabels(presentation);
  const homesTitle = t("page.homes.title"), regionName = area ? areaLabels[area] : "";
  const title = area ? t("page.area.regionTitle", { region: regionName }) : homesTitle;
  const description = area ? t("page.area.regionSummary", { region: regionName }) : t("page.homes.summary");
  const href = area ? internetAreaHref(area) : INTERNET_HOMES_HREF;
  const covered = years(data.facts), firstYear = Math.min(...covered), lastYear = Math.max(...covered);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const hubTitle = t("title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(INTERNET_HUB_PATH, locale) }, ...(area ? [{ label: homesTitle, href: pageHref(INTERNET_HOMES_HREF, locale) }] : []), { label: area ? regionName : title }];
  // The measures the page shows, by name: an area's headings, or the index map's homes with internet.
  const measures = area ? [...new Set(internetAreaSeries(area).map(series => t(`heading.${series.heading}`)))] : [t("mapLabel")];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "internet", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // An area page is a slice of the homes dataset.
      ...(area ? { spatialCoverageName: regionName, withinGeorgia: area !== "georgia", partOf: { path: INTERNET_HOMES_HREF, name: homesTitle, description: t("page.homes.summary") } } : {}),
      variableMeasured: measures,
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(INTERNET_HUB_PATH, locale) }, ...(area ? [{ name: homesTitle, path: pageHref(INTERNET_HOMES_HREF, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {body({ facts: data.facts, presentation, areaLabels, origin, lastReviewedAt })}
    </ExplorerPage>
  </I18nProvider>;
}
