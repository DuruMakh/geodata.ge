import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { parse } from "csv-parse/sync";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { CRIME_RESEARCH_DIRECTORY, crimeSourceDocumentId, type CrimeFact } from "../data/crime/types";
import { SOURCE_ID } from "../data/demography/series";
import { CRIME_HUB_PATH, CRIME_SECTIONS, type CrimeSectionId } from "../explorer/crime";
import { coverageLabel } from "../explorer/coverageLabel";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { getMessages } from "../i18n/messages.server";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation } from "../i18n/presentation.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

// Shared by the crime page module and the routes' metadata: keep explorer components out of this file.

export const crimeSectionHref = (section: CrimeSectionId) => CRIME_SECTIONS.find(item => item.id === section)!.href;

export async function crimePageMetadata(locale: Locale, section: CrimeSectionId) {
  const messages = await getMessages(locale, ["crime"]);
  return fiscalMetadata({ locale, path: crimeSectionHref(section), title: message(messages, `crime.page.${section}.metaTitle`), description: message(messages, `crime.page.${section}.summary`) });
}

export type CrimeWorkbookSource = WorkbookPublicSource & { sourceId: string };

type CsvRow = Record<string, string>;
const repositoryRoot = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
const readCsv = async (file: string) => parse(await readFile(path.join(/* turbopackIgnore: true */ repositoryRoot(), file)), { bom: true, columns: true, skip_empty_lines: true }) as CsvRow[];

/**
 * Every served Geostat workbook, named in the page's language, with the link Geostat published it at.
 * Until the crime source archive is published with the methodology page, the workbook cites Geostat's own file;
 * that step replaces this with `loadSourcedWorkbookSources("crime", ...)`, as Health does.
 */
async function crimeSourceRows(locale: Locale): Promise<Omit<CrimeWorkbookSource, "years">[]> {
  const [manifest, documents, catalogue] = await Promise.all([
    readCsv(`${CRIME_RESEARCH_DIRECTORY}/source-manifest.csv`), readCsv("data/sources/source-documents.csv"), locale === "en" ? loadEnglishCatalogue(repositoryRoot()) : undefined,
  ]);
  return manifest.map(row => {
    const id = crimeSourceDocumentId(row.source_id);
    const title = catalogue ? catalogue.sources[id]?.name.text : documents.find(document => document.source_id === id)?.source_name;
    if (!title) throw new Error(`Missing ${locale} name for crime source ${row.source_id}`);
    return { sourceId: row.source_id, title, organization: locale === "en" ? row.publisher : "საქსტატი", downloadHref: row.retrieved_file_url as `https://${string}`, retrievedAt: row.retrieved_at };
  });
}

/**
 * The workbooks a page's values were read from, each with the years it supplies, and the archived population table
 * the per-100,000 view divides by.
 */
export async function crimeSources(locale: Locale, facts: readonly { sourceId: string; year: number }[]): Promise<CrimeWorkbookSource[]> {
  const used = [...new Set(facts.map(f => f.sourceId))];
  const [rows, population] = await Promise.all([crimeSourceRows(locale), loadSourcedWorkbookSources("demography", locale, row => row.source_id === SOURCE_ID.populationUnits)]);
  return [...used.map(sourceId => {
    const source = rows.find(row => row.sourceId === sourceId);
    if (!source) throw new Error(`Missing reviewed crime source ${sourceId}`);
    return { ...source, years: [...new Set(facts.filter(f => f.sourceId === sourceId).map(f => f.year))].sort((a, b) => a - b) };
  }), ...population];
}

/** The frame every crime page shares: Dataset and breadcrumb JSON-LD, the breadcrumb header and the page's provider. */
export function renderCrimeFrame({ locale, presentation, path: href, title, description, facts, variableMeasured, children }: {
  locale: Locale; presentation: Presentation; path: `/${string}`; title: string; description: string;
  /** The served facts the page shows, for its years and review date. */
  facts: readonly CrimeFact[]; variableMeasured: string[]; children: ReactNode;
}) {
  const { messages } = presentation;
  const hubTitle = message(messages, "crime.title"), home = message(messages, "common.home");
  const years = facts.map(f => f.year), firstYear = Math.min(...years), lastYear = Math.max(...years);
  const lastReviewedAt = facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: home, href: pageHref("/", locale) }, { label: message(messages, "common.data") }, { label: hubTitle, href: pageHref(CRIME_HUB_PATH, locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "crime", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      // Every series the page offers, not only the headline one.
      variableMeasured,
    })} />
    <BreadcrumbJsonLd items={[{ name: home, path: pageHref("/", locale) }, { name: hubTitle, path: pageHref(CRIME_HUB_PATH, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={messages} crumbs={crumbs} coverage={coverageLabel(messages, locale, firstYear, lastYear, lastReviewedAt)} />
      {children}
    </ExplorerPage>
  </I18nProvider>;
}
