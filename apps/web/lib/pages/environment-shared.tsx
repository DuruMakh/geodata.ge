import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedEnvironmentData, toClientEnvironmentFact } from "../data/environment/importEnvironment";
import { ENVIRONMENT_CITIES, ENVIRONMENT_SOURCES, type ClientEnvironmentFact, type EnvironmentCity } from "../data/environment/types";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { ENVIRONMENT_HUB_PATH, environmentLabelKey, environmentValueLabel, type EnvironmentTranslate } from "../explorer/environment";
import { ENVIRONMENT_AREAS, environmentAreaIndexHref, environmentAreaRoutes, type EnvironmentArea, type EnvironmentAreaTopic } from "../explorer/environmentAreas";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, MessageScope, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

// Shared by the environment page modules. The topic pages, the city pages and the area pages are separate modules, so each
// ships only its own explorer: keep explorer components out of this file.

/** The Sources sheet of an Environment workbook: the 13 archived Geostat workbooks the values are read from, in the page's language. */
export async function loadEnvironmentWorkbookSources(locale: Locale): Promise<SourcedWorkbookPublicSource[]> {
  return loadSourcedWorkbookSources("environment", locale, row => ENVIRONMENT_SOURCES.includes(row.source_id));
}

/** Georgia and the eleven regions, in the picker's and previous/next order, with the map's ids; Georgia's English name is the catalogue's `georgia` label. */
export const ENVIRONMENT_AREA_PAGES: readonly MunicipalRegion[] = ENVIRONMENT_AREAS.map(area => area === "georgia" ? { id: area, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === environmentAreaRoutes("waste").mapId(area))!);
export const ENVIRONMENT_AREA_LABEL_IDS = ENVIRONMENT_AREA_PAGES.map(area => area.id);

export const environmentCityStaticParams = () => ENVIRONMENT_CITIES.map(city => ({ city }));
export const environmentAreaStaticParams = () => ENVIRONMENT_AREAS.map(area => ({ id: environmentAreaRoutes("waste").areaSlug(area) }));

export function environmentCityForSlugOrNotFound(slug: string): EnvironmentCity {
  const city = ENVIRONMENT_CITIES.find(item => item === slug);
  if (!city) notFound();
  return city;
}
export function environmentAreaForSlug(slug: string): EnvironmentArea {
  const area = ENVIRONMENT_AREAS.find(item => environmentAreaRoutes("waste").areaSlug(item) === slug);
  if (!area) notFound();
  return area;
}

/** An area's name in the page's language: Georgia's message, a region's shared region label. */
export function environmentAreaName(presentation: Presentation, area: EnvironmentArea): string {
  if (area === "georgia") return message(presentation.messages, "environment.area.georgia");
  const region = ENVIRONMENT_AREA_PAGES[ENVIRONMENT_AREAS.indexOf(area)]!;
  return publicLabel(presentation.locale, region.id, region.kaLabel, presentation.englishLabels);
}

/** The names of a list's series, without prefixes: the heading each row sits under names its measure and unit. */
export const environmentLabels = (presentation: Presentation, ids: readonly string[]): Record<string, string> =>
  Object.fromEntries(ids.map(id => [id, message(presentation.messages, `environment.${environmentLabelKey(id)}`)]));

export const environmentTranslate = (presentation: Presentation): EnvironmentTranslate => (key, values) => message(presentation.messages, `environment.${key}`, values);

/** The latest year of a series and its value as published, with its unit, for the line under a heading. */
export function environmentLatest(facts: readonly ClientEnvironmentFact[], id: string, t: EnvironmentTranslate): { year: number; value: string; fact: ClientEnvironmentFact } {
  const fact = facts.filter(f => f.indicatorId === id).sort((a, b) => a.year - b.year).at(-1)!;
  return { year: fact.year, value: environmentValueLabel(fact.value, fact.unit, fact.decimals, t), fact };
}

/** The served facts as the client gets them, the page's presentation, its last review date and the site's origin. */
export async function loadEnvironmentPage(locale: Locale, scopes: readonly MessageScope[] = [], labelIds: readonly string[] = []) {
  const [served, presentation] = await Promise.all([loadServedEnvironmentData(), getPresentation(locale, ["environment", ...scopes], labelIds, labelIds)]);
  return { locale, facts: served.map(toClientEnvironmentFact), presentation, lastReviewedAt: served.map(f => f.lastReviewedAt).sort().at(-1)!, origin: resolveSiteUrl() };
}

export type EnvironmentFrame = {
  locale: Locale; presentation: Presentation; lastReviewedAt: string; origin: string;
  href: `/${string}`; title: string; description: string; firstYear: number; lastYear: number; measures: string[];
  /** The page's parents between the hub and the page itself: the City air quality, Waste or Forests page. */
  parents?: { label: string; href: `/${string}`; description: string }[];
  /** A region's or Georgia's page names its area. */
  area?: { name: string; withinGeorgia: boolean };
  children: ReactNode;
};

/** The frame every Environment page shares: crumbs, the Dataset and breadcrumb data, and the header around the page's body. */
export function renderEnvironmentFrame({ locale, presentation, lastReviewedAt, origin, href, title, description, firstYear, lastYear, measures, parents = [], area, children }: EnvironmentFrame) {
  const hubTitle = message(presentation.messages, "environment.title");
  const parent = parents.at(-1);
  const crumbs = [
    { label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") },
    { label: hubTitle, href: pageHref(ENVIRONMENT_HUB_PATH, locale) }, ...parents.map(item => ({ label: item.label, href: pageHref(item.href, locale) })), { label: area?.name ?? title },
  ];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "environment", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt, variableMeasured: measures,
      // A city or area page is a slice of its index page's dataset.
      ...(parent ? { partOf: { path: parent.href, name: parent.label, description: parent.description } } : {}),
      ...(area ? { spatialCoverageName: area.name, withinGeorgia: area.withinGeorgia } : {}),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(ENVIRONMENT_HUB_PATH, locale) }, ...parents.map(item => ({ name: item.label, path: pageHref(item.href, locale) })), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {children}
    </ExplorerPage>
  </I18nProvider>;
}

/** The area pages' index: the Waste or Forests page, as a parent crumb. */
export const environmentAreaParent = (presentation: Presentation, topic: EnvironmentAreaTopic) => ({
  label: message(presentation.messages, `environment.page.${topic}.title`), href: environmentAreaIndexHref(topic),
  description: message(presentation.messages, `environment.page.${topic}.summary`),
});
