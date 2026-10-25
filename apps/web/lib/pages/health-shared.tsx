import type { ReactNode } from "react";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import type { HealthArea, HealthFact } from "../data/health/types";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { HEALTH_SECTIONS, type HealthSectionId } from "../explorer/health";
import { HEALTH_DEATH_AREAS } from "../explorer/healthDeaths";
import { coverageLabel } from "../explorer/coverageLabel";
import { getMessages } from "../i18n/messages.server";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources, type SourcedWorkbookPublicSource } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { topicSection, ALL_DATA_PATH } from "../navigation/navTree";

// Shared by the health page modules. The national pages, the causes-of-death index and the area pages are separate
// modules, so each ships only its own explorer: keep explorer components out of this file.

/** A section page's metadata: Doctors and hospitals, Illnesses or the Causes of death index. */
export async function healthPageMetadata(locale: Locale, section: HealthSectionId) {
  const messages = await getMessages(locale, ["health"]);
  return fiscalMetadata({ locale, path: HEALTH_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `health.page.${section}.metaTitle`), description: message(messages, `health.page.${section}.summary`) });
}

/**
 * The workbook cites each archived Geostat file the page's values were read from, for the years that file supplies.
 * Links point to the copies in the fiscal.ge source archive.
 */
export async function healthSources(locale: Locale, facts: readonly { sourceId: string; year: number }[]): Promise<SourcedWorkbookPublicSource[]> {
  const used = [...new Set(facts.map(f => f.sourceId))];
  const archived = await loadSourcedWorkbookSources("health", locale, row => used.includes(row.source_id));
  return used.map(sourceId => {
    const source = archived.find(row => row.sourceId === sourceId);
    if (!source) throw new Error(`Missing reviewed health source ${sourceId}`);
    return { ...source, years: [...new Set(facts.filter(f => f.sourceId === sourceId).map(f => f.year))].sort((a, b) => a - b) };
  });
}

/** Georgia and the eleven regions, in the picker's and previous/next order; Georgia's English name is the catalogue's `georgia` label. */
export const HEALTH_AREA_PAGES: readonly MunicipalRegion[] = HEALTH_DEATH_AREAS.map(id => id === "georgia" ? { id, kaLabel: "საქართველო", sortOrder: 0 } : REGIONAL_ECONOMY_REGIONS.find(region => region.id === id)!);

/** Names of Georgia and the regions in the page's language; region names are the Wages pages' own. */
export function healthAreaLabels(presentation: Presentation): Record<HealthArea, string> {
  return Object.fromEntries(HEALTH_AREA_PAGES.map(area => [area.id, area.id === "georgia" ? message(presentation.messages, "health.area.georgia") : publicLabel(presentation.locale, area.id, area.kaLabel, presentation.englishLabels)])) as Record<HealthArea, string>;
}

/**
 * The frame every health page shares: Dataset and breadcrumb JSON-LD, the breadcrumb header and the page's provider.
 * `section` is the crumb between the hub and an area page; `area` makes the page a slice of that section's dataset.
 */
export function renderHealthFrame({ locale, presentation, path: href, title, description, crumb, section, area, facts, variableMeasured, children }: {
  locale: Locale; presentation: Presentation; path: `/${string}`; title: string; description: string; crumb: string;
  section?: { label: string; path: `/${string}`; description: string }; area?: { name: string; withinGeorgia: boolean };
  /** The served facts the page shows, for its years and review date. */
  facts: readonly HealthFact[]; variableMeasured: string[]; children: ReactNode;
}) {
  const { messages } = presentation;
  const hubTitle = message(messages, "health.title"), home = message(messages, "common.home");
  const years = facts.map(f => f.year), firstYear = Math.min(...years), lastYear = Math.max(...years);
  const lastReviewedAt = facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const parents: { label: string; href: `/${string}`; path: `/${string}` }[] = [{ label: hubTitle, ...topicSection("health") }, ...(section ? [{ ...section, href: section.path }] : [])];
  const crumbs = [{ label: home, href: pageHref("/", locale) }, { label: message(messages, "common.data"), href: pageHref(ALL_DATA_PATH, locale) }, ...parents.map(parent => ({ label: parent.label, href: pageHref(parent.href, locale) })), { label: crumb }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "health", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      ...(area && section ? { spatialCoverageName: area.name, withinGeorgia: area.withinGeorgia, partOf: { path: section.path, name: section.label, description: section.description } } : {}),
      // Every series the page offers, not only the headline one.
      variableMeasured,
    })} />
    <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, { name: message(messages, "common.data"), path: pageHref(ALL_DATA_PATH, locale) }, ...parents.map(parent => ({ name: parent.label, path: pageHref(parent.path, locale) })), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {children}
    </ExplorerPage>
  </I18nProvider>;
}
