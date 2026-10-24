import { MoneyBanksExplorer, type MoneyBanksExplorerProps } from "../../components/money-banks/money-banks-explorer";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { JsonLd } from "../../components/seo/json-ld";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedMoneyBanksData, toClientMoneyBanksFact } from "../data/moneyBanks/importMoneyBanks";
import { loadServedExplorerData } from "../data/servedData";
import { projectGdpFact } from "../explorer/clientData";
import { MONEY_BANKS_SECTIONS, moneyBanksCoverage, moneyBanksViewSeries, moneyBanksViews, type MoneyBanksTopicId } from "../explorer/moneyBanks";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Presentation } from "../i18n/types";
import { loadGdpWorkbookSources, loadSourcedWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";

export async function moneyBanksPageMetadata(locale: Locale, section: MoneyBanksTopicId) {
  const messages = await getMessages(locale, ["moneyBanks"]);
  return fiscalMetadata({ locale, path: MONEY_BANKS_SECTIONS.find(item => item.id === section)!.href, title: message(messages, `moneyBanks.page.${section}.metaTitle`), description: message(messages, `moneyBanks.page.${section}.summary`) });
}

/** The ids of every series a money and banks page can show (Money supply's two views share theirs). */
function sectionSeriesIds(section: MoneyBanksTopicId): string[] {
  return [...new Set(moneyBanksViews(section).flatMap(view => moneyBanksViewSeries(section, view).map(series => series.id)))];
}

/** Display names for every series a money and banks page can show, in the page's language. */
function moneyBanksLabels(presentation: Presentation, section: MoneyBanksTopicId): Record<string, string> {
  return Object.fromEntries(sectionSeriesIds(section).map(id => [id, message(presentation.messages, `moneyBanks.series.${id}`)]));
}

/** The archived NBG workbooks (data/methodology/source-archives/money.csv) with their public download links, for the Excel Sources sheet. */
export function loadMoneyBanksWorkbookSources(locale: Locale): Promise<MoneyBanksExplorerProps["sources"]> {
  return loadSourcedWorkbookSources("money", locale);
}

export async function renderMoneyBanksPage(locale: Locale, section: MoneyBanksTopicId) {
  // The % of GDP view divides by the national GDP the debt page uses, and its Excel cites the same Geostat files.
  const gdp = moneyBanksViews(section).includes("gdp");
  const [data, presentation, sources, gdpFacts, gdpSources] = await Promise.all([
    loadServedMoneyBanksData(), getPresentation(locale, ["moneyBanks", "format", "main", "workbook"], []), loadMoneyBanksWorkbookSources(locale),
    gdp ? loadServedExplorerData().then(explorer => explorer.gdpFacts.map(projectGdpFact)) : [], gdp ? loadGdpWorkbookSources(locale) : [],
  ]);
  // Each page receives only the observations its views can show.
  const ids = new Set(sectionSeriesIds(section));
  const facts = data.facts.map(toClientMoneyBanksFact).filter(f => ids.has(f.indicatorId));
  // The workbook cites only the files these observations come from.
  const sourceIds = new Set(facts.map(f => f.sourceId));
  const years = [...new Set(moneyBanksViews(section).flatMap(view => moneyBanksCoverage(section, view, facts, gdpFacts).years))];
  const firstYear = Math.min(...years), lastYear = Math.max(...years);
  const href = MONEY_BANKS_SECTIONS.find(item => item.id === section)!.href;
  const labels = moneyBanksLabels(presentation, section);
  const t = (key: string) => message(presentation.messages, `moneyBanks.${key}`);
  const title = t(`page.${section}.title`), description = t(`page.${section}.summary`);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("title"), href: pageHref("/explorer/money", locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: href, datasetId: "money", name: title, description, firstYear, lastYear, dateModified: lastReviewedAt,
      variableMeasured: sectionSeriesIds(section).map(id => labels[id]),
      // The NBG's statistics; a % of GDP view divides by Geostat's GDP.
      ...(gdp ? { sources: ["nbg", "geostat"] as const } : {}),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("title"), path: pageHref("/explorer/money", locale) }, { name: title, path: pageHref(href, locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, firstYear, lastYear, lastReviewedAt)} />
      <MoneyBanksExplorer key={section} section={section} facts={facts} labels={labels} sources={sources.filter(source => sourceIds.has(source.sourceId))} gdpFacts={gdpFacts} gdpSources={gdpSources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
