import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedTransportData } from "../data/transport/importTransport";
import { TRANSPORT_SOURCES, type TransportFact } from "../data/transport/types";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { TRANSPORT_HUB_PATH } from "../explorer/transport";
import { TRANSPORT_AREAS, TRANSPORT_REGIONS_HREF, transportAreaHref, transportAreaSeries, transportAreaSlug, transportMapId, type TransportArea } from "../explorer/transportAreas";
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

// Shared by the transport page modules. The topic pages, the Regions index and the area pages are separate modules, so each
// ships only its own explorer: keep explorer components out of this file.

/**
 * The Sources sheet of a Transport workbook: the archived Geostat workbooks behind the exported values, in the page's language
 * and keyed by the facts' `sourceId`. Only the thirteen workbooks the values are read from are listed, not the files kept for
 * reference (the spreadsheet default would drop Geostat's `.xls` files).
 */
export async function loadTransportWorkbookSources(locale: Locale): Promise<SourcedWorkbookPublicSource[]> {
  return loadSourcedWorkbookSources("transport", locale, row => TRANSPORT_SOURCES.includes(row.source_id));
}

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
export const AREA_PAGES: readonly MunicipalRegion[] = TRANSPORT_AREAS.map(area => area === "georgia" ? { id: area, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === transportMapId(area))!);
const AREA_LABEL_IDS = AREA_PAGES.map(area => area.id);

export const transportAreaStaticParams = () => TRANSPORT_AREAS.map(area => ({ id: transportAreaSlug(area) }));
export function areaForSlug(slug: string): TransportArea {
  const area = TRANSPORT_AREAS.find(item => transportAreaSlug(item) === slug);
  if (!area) notFound();
  return area;
}

/** Names of Georgia and the regions, in the page's language; region names are the shared region labels. */
function transportAreaLabels(presentation: Presentation): Record<TransportArea, string> {
  return Object.fromEntries(TRANSPORT_AREAS.map((area, index) => [area, area === "georgia" ? message(presentation.messages, "transport.area.georgia")
    : publicLabel(presentation.locale, AREA_PAGES[index].id, AREA_PAGES[index].kaLabel, presentation.englishLabels)])) as Record<TransportArea, string>;
}

export async function transportRegionsPageMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["transport"]);
  return fiscalMetadata({ locale, path: TRANSPORT_REGIONS_HREF, title: message(messages, "transport.page.regions.metaTitle"), description: message(messages, "transport.page.regions.summary") });
}

export async function transportAreaPageMetadata(slug: string, locale: Locale) {
  const area = areaForSlug(slug), presentation = await getPresentation(locale, ["transport"], AREA_LABEL_IDS);
  const name = transportAreaLabels(presentation)[area];
  return fiscalMetadata({ locale, path: transportAreaHref(area), title: message(presentation.messages, "transport.page.area.regionTitle", { region: name }), description: message(presentation.messages, "transport.page.area.regionSummary", { region: name }) });
}

export type TransportRegionsBody = { facts: TransportFact[]; presentation: Presentation; areaLabels: Record<TransportArea, string>; origin: string; lastReviewedAt: string };

/** The Regions index, or with `area` that area's page: the frame both share (crumbs, Dataset, header) around the page's own body. */
export async function renderTransportRegionsFrame(locale: Locale, area: TransportArea | undefined, years: (facts: TransportFact[]) => number[], body: (page: TransportRegionsBody) => ReactNode) {
  const [data, presentation] = await Promise.all([loadServedTransportData(), getPresentation(locale, ["transport", "regionalEconomies", "format", "main", "workbook"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `transport.${key}`, values);
  const areaLabels = transportAreaLabels(presentation);
  const regionsTitle = t("page.regions.title"), regionName = area ? areaLabels[area] : "";
  const title = area ? t("page.area.regionTitle", { region: regionName }) : regionsTitle;
  const description = area ? t("page.area.regionSummary", { region: regionName }) : t("page.regions.summary");
  const href = area ? transportAreaHref(area) : TRANSPORT_REGIONS_HREF;
  const covered = years(data.facts), firstYear = Math.min(...covered), lastYear = Math.max(...covered);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const hubTitle = t("title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(TRANSPORT_HUB_PATH, locale) }, ...(area ? [{ label: regionsTitle, href: pageHref(TRANSPORT_REGIONS_HREF, locale) }] : []), { label: area ? regionName : title }];
  // The measures the page shows, by name: an area's five headings, or the index map's registered vehicles.
  const measures = area ? [...new Set(transportAreaSeries(area).map(series => t(`heading.${series.heading}`)))] : [t("mapLabel")];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "transport", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // An area page is a slice of the regions' dataset.
      ...(area ? { spatialCoverageName: regionName, withinGeorgia: area !== "georgia", partOf: { path: TRANSPORT_REGIONS_HREF, name: regionsTitle, description: t("page.regions.summary") } } : {}),
      variableMeasured: measures,
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(TRANSPORT_HUB_PATH, locale) }, ...(area ? [{ name: regionsTitle, path: pageHref(TRANSPORT_REGIONS_HREF, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {body({ facts: data.facts, presentation, areaLabels, origin, lastReviewedAt })}
    </ExplorerPage>
  </I18nProvider>;
}
