import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { parse } from "csv-parse/sync";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { HEALTH_RESEARCH_DIRECTORY, type HealthArea, type HealthFact } from "../data/health/types";
import type { MunicipalRegion } from "../data/municipal/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { HEALTH_HUB_PATH, HEALTH_SECTIONS, type HealthSectionId } from "../explorer/health";
import { HEALTH_DEATH_AREAS } from "../explorer/healthDeaths";
import { coverageLabel } from "../explorer/coverageLabel";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { getMessages } from "../i18n/messages.server";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { publicLabel } from "../i18n/labels";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

// Shared by the health page modules. The national pages, the causes-of-death index and the area pages are separate
// modules, so each ships only its own explorer: keep explorer components out of this file.

/** A section page's metadata: Doctors and hospitals, Illnesses or the Causes of death index. */
export async function healthPageMetadata(locale: Locale, section: HealthSectionId) {
  const messages = await getMessages(locale, ["health"]);
  return fiscalMetadata({ locale, path: HEALTH_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `health.page.${section}.metaTitle`), description: message(messages, `health.page.${section}.summary`) });
}

export type HealthWorkbookSource = WorkbookPublicSource & { sourceId: string };

type CsvRow = Record<string, string>;
const repositoryRoot = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
const readCsv = async (file: string) => parse(await readFile(path.join(/* turbopackIgnore: true */ repositoryRoot(), file)), { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[];

/**
 * Every served Geostat workbook, named in the page's language, with the link Geostat published it at.
 * Until the health source archive is published with the methodology page, the workbook cites Geostat's own file;
 * that step replaces this with `loadSourcedWorkbookSources("health", ...)`, as Energy and food does.
 */
async function healthSourceRows(locale: Locale): Promise<Omit<HealthWorkbookSource, "years">[]> {
  const [manifest, documents, catalogue] = await Promise.all([
    readCsv(`${HEALTH_RESEARCH_DIRECTORY}/source-manifest.csv`), readCsv("data/sources/source-documents.csv"), locale === "en" ? loadEnglishCatalogue(repositoryRoot()) : undefined,
  ]);
  return manifest.map(row => {
    const id = `source.${row.source_id}`;
    const title = catalogue ? catalogue.sources[id]?.name.text : documents.find(document => document.source_id === id)?.source_name;
    if (!title) throw new Error(`Missing ${locale} name for health source ${row.source_id}`);
    return { sourceId: row.source_id, title, organization: locale === "en" ? row.publisher : "საქსტატი", downloadHref: row.retrieved_file_url as `https://${string}`, retrievedAt: row.retrieved_at };
  });
}

/** The workbooks a page's values were read from, each with the years it supplies. */
export async function healthSources(locale: Locale, facts: readonly { sourceId: string; year: number }[]): Promise<HealthWorkbookSource[]> {
  const used = [...new Set(facts.map(f => f.sourceId))];
  const rows = await healthSourceRows(locale);
  return used.map(sourceId => {
    const source = rows.find(row => row.sourceId === sourceId);
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
  const parents: { label: string; path: `/${string}` }[] = [{ label: hubTitle, path: HEALTH_HUB_PATH }, ...(section ? [section] : [])];
  const crumbs = [{ label: home, href: pageHref("/", locale) }, { label: message(messages, "common.data") }, ...parents.map(parent => ({ label: parent.label, href: pageHref(parent.path, locale) })), { label: crumb }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "health", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      ...(area && section ? { spatialCoverageName: area.name, withinGeorgia: area.withinGeorgia, partOf: { path: section.path, name: section.label, description: section.description } } : {}),
      // Every series the page offers, not only the headline one.
      variableMeasured,
    })} />
    <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, ...parents.map(parent => ({ name: parent.label, path: pageHref(parent.path, locale) })), { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {children}
    </ExplorerPage>
  </I18nProvider>;
}
