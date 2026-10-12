import path from "node:path";
import { MoneyBanksExplorer, type MoneyBanksExplorerProps } from "../../components/money-banks/money-banks-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedMoneyBanksData, toClientMoneyBanksFact } from "../data/moneyBanks/importMoneyBanks";
import { loadServedExplorerData } from "../data/servedData";
import { projectGdpFact } from "../explorer/clientData";
import { MONEY_BANKS_SECTIONS, moneyBanksCoverage, moneyBanksViewSeries, moneyBanksViews, type MoneyBanksSectionId } from "../explorer/moneyBanks";
import { buildMoneyBanksHubCards } from "../explorer/moneyBanksHubCards";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { loadGdpWorkbookSources } from "../methodology/workbookSources";
import { projectPublicSources } from "../methodology/publicSources";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { TopicHub } from "./hub";

export async function moneyBanksHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["moneyBanks"]);
  return fiscalMetadata({ locale, path: "/explorer/money", title: message(messages, "moneyBanks.metaTitle"), description: message(messages, "moneyBanks.metaDescription") });
}

export async function renderMoneyBanksHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedMoneyBanksData(), getPresentation(locale, ["moneyBanks", "common"], [])]);
  const title = message(presentation.messages, "moneyBanks.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "moneyBanks.hubSummary")} path={"/explorer/money"} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildMoneyBanksHubCards(facts.map(toClientMoneyBanksFact), presentation)} testId="money-hub" />;
}

export async function moneyBanksPageMetadata(locale: Locale, section: MoneyBanksSectionId) {
  const messages = await getMessages(locale, ["moneyBanks"]);
  return fiscalMetadata({ locale, path: MONEY_BANKS_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `moneyBanks.page.${section}.metaTitle`), description: message(messages, `moneyBanks.page.${section}.summary`) });
}

/** The ids of every series a money and banks page can show (Money supply's two views share theirs). */
function sectionSeriesIds(section: MoneyBanksSectionId): string[] {
  return [...new Set(moneyBanksViews(section).flatMap(view => moneyBanksViewSeries(section, view).map(series => series.id)))];
}

/** Display names for every series a money and banks page can show, in the page's language. */
function moneyBanksLabels(presentation: Presentation, section: MoneyBanksSectionId): Record<string, string> {
  return Object.fromEntries(sectionSeriesIds(section).map(id => [id, message(presentation.messages, `moneyBanks.series.${id}`)]));
}

/** The archived NBG workbooks (data/methodology/source-archives/money.csv) with their public download links, for the Excel Sources sheet. */
export async function loadMoneyBanksWorkbookSources(locale: Locale): Promise<MoneyBanksExplorerProps["sources"]> {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [manifest, catalogue] = await Promise.all([loadReviewedSourceManifest(root, "money"), loadEnglishCatalogue(root)]);
  const publicSources = projectPublicSources(manifest, locale, catalogue.documents);
  return manifest.filter(source => source.media_type.includes("spreadsheet")).map(source => {
    const translated = publicSources.find(row => row.source_id === source.source_id)!;
    return { sourceId: source.source_id, years: source.years, title: translated.title, organization: translated.publisher, downloadHref: source.downloadHref, retrievedAt: source.retrieved_at };
  });
}

export async function renderMoneyBanksPage(locale: Locale, section: MoneyBanksSectionId) {
  // The % of GDP view divides by the national GDP the debt page uses, and its Excel cites the same Geostat files.
  const gdp = moneyBanksViews(section).includes("gdp");
  const [data, presentation, sources, gdpFacts, gdpSources] = await Promise.all([
    loadServedMoneyBanksData(), getPresentation(locale, ["moneyBanks", "common", "controls", "format", "main", "workbook"], []), loadMoneyBanksWorkbookSources(locale),
    gdp ? loadServedExplorerData().then(explorer => explorer.gdpFacts.map(projectGdpFact)) : [], gdp ? loadGdpWorkbookSources(locale) : [],
  ]);
  // Each page receives only the observations its views can show.
  const ids = new Set(sectionSeriesIds(section));
  const facts = data.facts.map(toClientMoneyBanksFact).filter(f => ids.has(f.indicatorId));
  const years = [...new Set(moneyBanksViews(section).flatMap(view => moneyBanksCoverage(section, view, facts, gdpFacts).years))];
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const href = MONEY_BANKS_SECTIONS.find(item => item.id === section)!.href;
  const labels = moneyBanksLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `moneyBanks.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref("/explorer/money", locale) }, { label: title }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}${href}#dataset`, name: title, description, url: `${origin}${pageHref(href, locale)}`,
      temporalCoverage: `${firstYear}/${lastYear}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "ka" ? "საქართველო" : "Georgia" },
      creator: { "@type": "Organization", name: "National Bank of Georgia", url: "https://nbg.gov.ge" }, publisher: { "@id": `${origin}/#organization` },
      variableMeasured: sectionSeriesIds(section).map(id => t(`series.${id}`)),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref("/explorer/money", locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <MoneyBanksExplorer key={section} section={section} facts={facts} labels={labels} sources={sources} gdpFacts={gdpFacts} gdpSources={gdpSources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
