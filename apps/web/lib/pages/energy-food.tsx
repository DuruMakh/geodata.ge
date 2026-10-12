import path from "node:path";
import { EnergyFoodExplorer } from "../../components/energy-food/energy-food-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedEnergyFoodData, toClientEnergyFoodFact } from "../data/energyFood/importEnergyFood";
import { ENERGY_FOOD_HUB_PATH, ENERGY_FOOD_SECTIONS, energyFoodCoverage, energyFoodSeries, type EnergyFoodSectionId } from "../explorer/energyFood";
import { buildEnergyFoodHubCards } from "../explorer/energyFoodHubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectPublicSources } from "../methodology/publicSources";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { TopicHub } from "./hub";

export async function energyFoodHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["energyFood"]);
  return fiscalMetadata({ locale, path: ENERGY_FOOD_HUB_PATH, title: message(messages, "energyFood.metaTitle"), description: message(messages, "energyFood.metaDescription") });
}

export async function renderEnergyFoodHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedEnergyFoodData(), getPresentation(locale, ["energyFood", "common"], [])]);
  const title = message(presentation.messages, "energyFood.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "energyFood.hubSummary")} path={ENERGY_FOOD_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildEnergyFoodHubCards(facts.map(toClientEnergyFoodFact), presentation)} testId="energy-food-hub" />;
}

export async function energyFoodPageMetadata(locale: Locale, section: EnergyFoodSectionId) {
  const messages = await getMessages(locale, ["energyFood"]);
  return fiscalMetadata({ locale, path: ENERGY_FOOD_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `energyFood.page.${section}.metaTitle`), description: message(messages, `energyFood.page.${section}.summary`) });
}

/** Display names for every series a page shows, in the page's language. */
function energyFoodLabels(presentation: Presentation, section: EnergyFoodSectionId): Record<string, string> {
  return Object.fromEntries(energyFoodSeries(section).map(series => [series.id, message(presentation.messages, `energyFood.series.${series.id}`)]));
}

/**
 * The workbook cites each archived Geostat file the page's values were read from, for the years that file supplies.
 * Links point to the copies in the fiscal.ge source archive.
 */
async function energyFoodSources(root: string, locale: Locale, facts: readonly { sourceId: string; year: number }[]): Promise<(WorkbookPublicSource & { sourceId: string })[]> {
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(root, "energy-food"), loadEnglishCatalogue(root)]);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  return [...new Set(facts.map(f => f.sourceId))].map(sourceId => {
    const source = manifest.find(row => row.source_id === sourceId), translated = publicSources.find(row => row.source_id === sourceId);
    if (!source || !translated) throw new Error(`Missing reviewed energy and food source ${sourceId}`);
    return {
      sourceId, years: [...new Set(facts.filter(f => f.sourceId === sourceId).map(f => f.year))].sort((a, b) => a - b),
      title: translated.title, organization: translated.publisher, downloadHref: source.downloadHref, retrievedAt: source.retrieved_at,
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
