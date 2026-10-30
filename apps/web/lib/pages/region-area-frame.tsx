import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
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
import { areaTitleForm } from "../seo/placeTitleForms";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

// The frame of a hub whose index (a map of the eleven regions) opens one static page for Georgia and each region:
// Housing, Transport, Internet and Loans by region, each configured once in its `-shared.tsx`. The index and the area
// pages are separate modules, so each ships only its own explorer: keep explorer components out of this file.

export type RegionAreaFrameConfig<Area extends string, Fact extends { year: number; lastReviewedAt: string }> = {
  /** The message namespace and the Dataset id (Money and banks' messages are `moneyBanks`, its Dataset, sources and topic `money`). */
  hub: "housing" | "transport" | "internet" | "moneyBanks";
  indexHref: `/${string}`;
  /** The index page's messages, `<hub>.page.<indexKey>.title`, `.summary` and `.metaTitle`. */
  indexKey: "regions" | "homes";
  /** Georgia, then the eleven regions, in the picker's and previous/next order. */
  areas: readonly Area[];
  areaSlug(area: Area): string;
  areaHref(area: Area): `/${string}`;
  /** An area's id on the shared region map and picker (`areaRoutes.ts`). */
  mapId(area: Area): string;
  /** The headings an area page lists, named in Dataset metadata as `<hub>.heading.<id>`. */
  areaHeadingIds(area: Area): readonly string[];
  load(): Promise<{ facts: Fact[] }>;
  /** The latest year the area's own series have a value in: the year its page title carries. */
  latestYear(facts: Fact[], area: Area): number;
  /** The workbooks the values are read from: a workbook's Sources sheet lists only these, not the files kept for reference. */
  sourceIds: readonly string[];
};

export type RegionAreaBody<Area extends string, Fact> = {
  facts: Fact[]; presentation: Presentation; areaLabels: Record<Area, string>; origin: string; lastReviewedAt: string;
};

export function regionAreaFrame<Area extends string, Fact extends { year: number; lastReviewedAt: string }>(config: RegionAreaFrameConfig<Area, Fact>) {
  const { hub, indexHref, indexKey, areas, areaSlug, areaHref, mapId } = config;
  const datasetId = hub === "moneyBanks" ? "money" : hub;
  /** Georgia and the eleven regions; Georgia's English name is the catalogue's `georgia` label. */
  const areaPages: readonly MunicipalRegion[] = areas.map(area => area === "georgia" ? { id: area, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === mapId(area))!);
  const labelIds = areaPages.map(area => area.id);

  const areaStaticParams = () => areas.map(area => ({ id: areaSlug(area) }));
  function areaForSlug(slug: string): Area {
    const area = areas.find(item => areaSlug(item) === slug);
    if (!area) notFound();
    return area;
  }

  /** Names of Georgia and the regions, in the page's language; region names are the shared region labels. */
  function areaLabels(presentation: Presentation): Record<Area, string> {
    return Object.fromEntries(areas.map((area, index) => [area, area === "georgia" ? message(presentation.messages, `${hub}.area.georgia`)
      : publicLabel(presentation.locale, areaPages[index].id, areaPages[index].kaLabel, presentation.englishLabels)])) as Record<Area, string>;
  }

  async function indexPageMetadata(locale: Locale) {
    const messages = await getMessages(locale, [hub]);
    return fiscalMetadata({ locale, path: indexHref, title: message(messages, `${hub}.page.${indexKey}.metaTitle`), description: message(messages, `${hub}.page.${indexKey}.summary`) });
  }

  async function areaPageMetadata(slug: string, locale: Locale) {
    const area = areaForSlug(slug), [presentation, data] = await Promise.all([getPresentation(locale, [hub], labelIds), config.load()]);
    const name = areaLabels(presentation)[area];
    // The title is worded the way people search it and ends in the area's latest year; the page's own heading and Dataset name keep `regionTitle`.
    const seoTitle = message(presentation.messages, `${hub}.page.area.seoTitle`, { place: areaTitleForm(mapId(area), name, locale, "in"), year: config.latestYear(data.facts, area) });
    return fiscalMetadata({ locale, path: areaHref(area), title: seoTitle, description: message(presentation.messages, `${hub}.page.area.regionSummary`, { region: name }) });
  }

  /** The Sources sheet of the hub's workbooks: the archived workbooks behind the exported values, in the page's language and keyed by the facts' `sourceId`. */
  function loadWorkbookSources(locale: Locale): Promise<SourcedWorkbookPublicSource[]> {
    return loadSourcedWorkbookSources(datasetId, locale, row => config.sourceIds.includes(row.source_id));
  }

  /** The index, or with `area` that area's page: the frame both share (crumbs, Dataset, header) around the page's own body. */
  async function renderFrame(locale: Locale, area: Area | undefined, years: (facts: Fact[]) => number[], body: (page: RegionAreaBody<Area, Fact>) => ReactNode) {
    const [data, presentation] = await Promise.all([config.load(), getPresentation(locale, [hub, "regionalEconomies", "format", "main", "workbook"], labelIds, labelIds)]);
    const t = (key: string, values?: Record<string, string>) => message(presentation.messages, `${hub}.${key}`, values);
    const labels = areaLabels(presentation);
    const indexTitle = t(`page.${indexKey}.title`), regionName = area ? labels[area] : "";
    const title = area ? t("page.area.regionTitle", { region: regionName }) : indexTitle;
    const description = area ? t("page.area.regionSummary", { region: regionName }) : t(`page.${indexKey}.summary`);
    const href = area ? areaHref(area) : indexHref;
    const covered = years(data.facts), firstYear = Math.min(...covered), lastYear = Math.max(...covered);
    const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
    const hubTitle = t("title");
    const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, { label: hubTitle, href: pageHref(topicSection(datasetId).href, locale) }, ...(area ? [{ label: indexTitle, href: pageHref(indexHref, locale) }] : []), { label: area ? regionName : title }];
    // The measures the page shows, by name: an area's headings, or the index map's measure.
    const measures = area ? [...new Set(config.areaHeadingIds(area).map(id => t(`heading.${id}`)))] : [t("mapLabel")];
    return <I18nProvider {...clientPresentation(presentation)}>
      <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
        locale, origin, path: href, datasetId, name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
        // An area page is a slice of the index's dataset.
        ...(area ? { spatialCoverageName: regionName, withinGeorgia: area !== "georgia", partOf: { path: indexHref, name: indexTitle, description: t(`page.${indexKey}.summary`) } } : {}),
        variableMeasured: measures,
      })} />
      <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: message(presentation.messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, { name: hubTitle, path: pageHref(topicSection(datasetId).path, locale) }, ...(area ? [{ name: indexTitle, path: pageHref(indexHref, locale) }] : []), { name: title, path: pageHref(href, locale) }]} />
      <ExplorerPage containerQueries={false}>
        <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
        {body({ facts: data.facts, presentation, areaLabels: labels, origin, lastReviewedAt })}
      </ExplorerPage>
    </I18nProvider>;
  }

  return { areaPages, areaStaticParams, areaForSlug, indexPageMetadata, areaPageMetadata, loadWorkbookSources, renderFrame };
}
