import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { loadServedScienceCultureData } from "../data/scienceCulture/importScienceCulture";
import { SCIENCE_CULTURE_REGIONS, SCIENCE_CULTURE_SOURCES, type ScienceCultureFact } from "../data/scienceCulture/types";
import { coverageLabel } from "../explorer/coverageLabel";
import { type ScienceCultureSeriesDefinition } from "../explorer/scienceCulture";
import { MUSEUMS_HREF, MUSEUM_AREAS, museumAreaHref, museumAreaSeries, museumAreaSlug, museumMapId, type MuseumArea } from "../explorer/scienceCultureMuseums";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Messages, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection } from "../navigation/navTree";

// Shared by the science and culture page modules. The topic pages, the Museums index and the area pages are separate
// modules, so each ships only its own explorer: keep explorer components out of this file.

/**
 * The Sources sheet of a Science and culture workbook: the archived Geostat workbooks behind the exported values, in the page's
 * language and keyed by the facts' `sourceId`. Only the eleven workbooks the values are read from are listed, not the files kept
 * for reference (the spreadsheet default would drop Geostat's `.xls` files).
 */
export async function loadScienceCultureWorkbookSources(locale: Locale): Promise<SourcedWorkbookPublicSource[]> {
  return loadSourcedWorkbookSources("science-culture", locale, row => SCIENCE_CULTURE_SOURCES.includes(row.source_id));
}

/** Display names of the series a list shows; a region's row is named as Georgia's (the heading says what it counts, the page names the area). */
export function scienceCultureLabels(messages: Messages, definitions: readonly ScienceCultureSeriesDefinition[]): Record<string, string> {
  const regions: readonly string[] = SCIENCE_CULTURE_REGIONS;
  return Object.fromEntries(definitions.map(({ id }) => {
    const [, measure, group] = id.split(".");
    return [id, message(messages, `scienceCulture.series.${measure}.${regions.includes(group) ? "total" : group}`)];
  }));
}

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
export const AREA_PAGES: readonly MunicipalRegion[] = MUSEUM_AREAS.map(area => area === "georgia" ? { id: area, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === museumMapId(area))!);
const AREA_LABEL_IDS = AREA_PAGES.map(area => area.id);

export const museumAreaStaticParams = () => MUSEUM_AREAS.map(area => ({ id: museumAreaSlug(area) }));
export function museumAreaForSlug(slug: string): MuseumArea {
  const area = MUSEUM_AREAS.find(item => museumAreaSlug(item) === slug);
  if (!area) notFound();
  return area;
}

/** Names of Georgia and the regions, in the page's language; region names are the shared region labels. */
function museumAreaLabels(presentation: Presentation): Record<MuseumArea, string> {
  return Object.fromEntries(MUSEUM_AREAS.map((area, index) => [area, area === "georgia" ? message(presentation.messages, "scienceCulture.area.georgia")
    : publicLabel(presentation.locale, AREA_PAGES[index].id, AREA_PAGES[index].kaLabel, presentation.englishLabels)])) as Record<MuseumArea, string>;
}

export async function museumsIndexMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["scienceCulture"]);
  return fiscalMetadata({ locale, path: MUSEUMS_HREF, title: message(messages, "scienceCulture.page.museums.metaTitle"), description: message(messages, "scienceCulture.page.museums.summary") });
}

export async function museumAreaMetadata(slug: string, locale: Locale) {
  const area = museumAreaForSlug(slug), presentation = await getPresentation(locale, ["scienceCulture"], AREA_LABEL_IDS);
  const name = museumAreaLabels(presentation)[area];
  return fiscalMetadata({ locale, path: museumAreaHref(area), title: message(presentation.messages, "scienceCulture.page.area.regionTitle", { region: name }), description: message(presentation.messages, "scienceCulture.page.area.regionSummary", { region: name }) });
}

export type MuseumsBody = { facts: ScienceCultureFact[]; presentation: Presentation; areaLabels: Record<MuseumArea, string>; origin: string; lastReviewedAt: string };

/** The Museums index, or with `area` that area's page: the frame both share (crumbs, Dataset, header) around the page's own body. */
export async function renderMuseumsFrame(locale: Locale, area: MuseumArea | undefined, years: (facts: ScienceCultureFact[]) => number[], body: (page: MuseumsBody) => ReactNode) {
  const [data, presentation] = await Promise.all([loadServedScienceCultureData(), getPresentation(locale, ["scienceCulture", "regionalEconomies", "format", "main", "workbook"], AREA_LABEL_IDS, AREA_LABEL_IDS)]);
  const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `scienceCulture.${key}`, values);
  const areaLabels = museumAreaLabels(presentation);
  const indexTitle = t("page.museums.title"), areaName = area ? areaLabels[area] : "";
  const title = area ? t("page.area.regionTitle", { region: areaName }) : indexTitle;
  const description = area ? t("page.area.regionSummary", { region: areaName }) : t("page.museums.summary");
  const href = area ? museumAreaHref(area) : MUSEUMS_HREF;
  const covered = years(data.facts), firstYear = Math.min(...covered), lastYear = Math.max(...covered);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const hubTitle = t("title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: hubTitle, href: pageHref(topicSection("science-culture").href, locale) }, ...(area ? [{ label: indexTitle, href: pageHref(MUSEUMS_HREF, locale) }] : []), { label: area ? areaName : title }];
  // The measures the page shows, by name: an area's headings, or the index map's visitors.
  const measures = area ? [...new Set(museumAreaSeries(area).map(series => t(`heading.${series.heading}`)))] : [t("mapLabel")];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "science-culture", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // An area page is a slice of the museums dataset.
      ...(area ? { spatialCoverageName: areaName, withinGeorgia: area !== "georgia", partOf: { path: MUSEUMS_HREF, name: indexTitle, description: t("page.museums.summary") } } : {}),
      variableMeasured: measures,
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(topicSection("science-culture").path, locale) }, ...(area ? [{ name: indexTitle, path: pageHref(MUSEUMS_HREF, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {body({ facts: data.facts, presentation, areaLabels, origin, lastReviewedAt })}
    </ExplorerPage>
  </I18nProvider>;
}
