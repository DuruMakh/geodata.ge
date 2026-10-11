import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { EnergyFoodExplorer } from "../../components/energy-food/energy-food-explorer";
import { BudgetHub } from "../../components/hub/budget-hub";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedEnergyFoodData, toClientEnergyFoodFact } from "../data/energyFood/importEnergyFood";
import { energyFoodSourceDocumentId } from "../data/energyFood/types";
import { ENERGY_FOOD_HUB_PATH, ENERGY_FOOD_SECTIONS, energyFoodCoverage, energyFoodSeries, type EnergyFoodSectionId } from "../explorer/energyFood";
import { buildEnergyFoodHubCards } from "../explorer/energyFoodHubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";

const RESEARCH_PACKAGE = "docs/Raw Data/EnergyFood/geostat-energy-food-annual";

export async function energyFoodHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["energyFood"]);
  return fiscalMetadata({ locale, path: ENERGY_FOOD_HUB_PATH, title: message(messages, "energyFood.metaTitle"), description: message(messages, "energyFood.metaDescription") });
}

export async function renderEnergyFoodHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedEnergyFoodData(), getPresentation(locale, ["energyFood", "common"], [])]);
  const title = message(presentation.messages, "energyFood.title"), years = facts.map(f => f.year);
  return <I18nProvider {...presentation}>
    <BreadcrumbJsonLd items={[{ name: message(presentation.messages, "common.home"), path: pageHref("/", locale) }, { name: title, path: pageHref(ENERGY_FOOD_HUB_PATH, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={[{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: title }]} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} />
      <ExplorerHeading>{title}</ExplorerHeading>
      <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{message(presentation.messages, "energyFood.hubSummary")}</p>
      <BudgetHub cards={buildEnergyFoodHubCards(facts.map(toClientEnergyFoodFact), presentation)} locale={locale} testId="energy-food-hub" />
    </ExplorerPage>
  </I18nProvider>;
}

export async function energyFoodPageMetadata(locale: Locale, section: EnergyFoodSectionId) {
  const messages = await getMessages(locale, ["energyFood"]);
  return fiscalMetadata({ locale, path: ENERGY_FOOD_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `energyFood.page.${section}.metaTitle`), description: message(messages, `energyFood.page.${section}.summary`) });
}

/** Display names for every series a page shows, in the page's language. */
function energyFoodLabels(presentation: Presentation, section: EnergyFoodSectionId): Record<string, string> {
  return Object.fromEntries(energyFoodSeries(section).map(series => [series.id, message(presentation.messages, `energyFood.series.${series.id}`)]));
}

type ResearchManifestRow = { source_id: string; dataset_title: string; publisher: string; resolved_file_url: string; retrieved_at: string };

/**
 * The workbook cites each Geostat file the page's values were read from, at the address the reviewed research
 * manifest recorded, for the years that file supplies. Georgian titles are the reviewed source-document names.
 */
async function energyFoodSources(root: string, locale: Locale, facts: readonly { sourceId: string; year: number }[]): Promise<(WorkbookPublicSource & { sourceId: string })[]> {
  const [manifestText, documentsText] = await Promise.all([
    readFile(path.join(/* turbopackIgnore: true */ root, RESEARCH_PACKAGE, "source-manifest.json"), "utf8"),
    readFile(path.join(/* turbopackIgnore: true */ root, "data/sources/source-documents.csv")),
  ]);
  const manifest = new Map((JSON.parse(manifestText) as ResearchManifestRow[]).map(row => [row.source_id, row]));
  const documents = new Map((parse(documentsText, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[]).map(row => [row.source_id, row.source_name]));
  return [...new Set(facts.map(f => f.sourceId))].map(sourceId => {
    const row = manifest.get(sourceId), kaTitle = documents.get(energyFoodSourceDocumentId(sourceId));
    if (!row || !kaTitle || !row.resolved_file_url.startsWith("https://")) throw new Error(`Missing reviewed energy and food source ${sourceId}`);
    return {
      sourceId, years: [...new Set(facts.filter(f => f.sourceId === sourceId).map(f => f.year))].sort((a, b) => a - b),
      title: locale === "ka" ? kaTitle : row.dataset_title, organization: locale === "ka" ? "საქსტატი" : row.publisher,
      downloadHref: row.resolved_file_url as `https://${string}`, retrievedAt: row.retrieved_at,
    };
  });
}

export async function renderEnergyFoodPage(locale: Locale, section: EnergyFoodSectionId) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation] = await Promise.all([
    loadServedEnergyFoodData(), getPresentation(locale, ["energyFood", "common", "controls", "format", "main", "workbook"], []),
  ]);
  // Each page receives only the observations its series show.
  const ids = new Set<string>(energyFoodSeries(section).map(series => series.id));
  const facts = data.facts.map(toClientEnergyFoodFact).filter(f => ids.has(f.indicatorId));
  const { min: firstYear, max: lastYear } = energyFoodCoverage(section, facts);
  const href = ENERGY_FOOD_SECTIONS.find(item => item.id === section)!.href;
  const labels = energyFoodLabels(presentation, section);
  const sources = await energyFoodSources(root, locale, facts);
  const t = (key: string) => message(presentation.messages, `energyFood.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref(ENERGY_FOOD_HUB_PATH, locale) }, { label: title }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}${href}#dataset`, name: title, description, url: `${origin}${pageHref(href, locale)}`,
      temporalCoverage: `${firstYear}/${lastYear}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "ka" ? "საქართველო" : "Georgia" },
      creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` },
      variableMeasured: [t(`latest.${section}`)],
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref(ENERGY_FOOD_HUB_PATH, locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <EnergyFoodExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
