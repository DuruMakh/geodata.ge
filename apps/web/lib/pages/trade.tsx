import path from "node:path";
import { TradeOverview } from "../../components/trade/trade-overview";
import { BudgetHub } from "../../components/hub/budget-hub";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { PageHeader } from "../../components/shell/page-header";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedTradeOverviewData, toClientTradeOverviewFact } from "../data/tradeOverview/importTradeOverview";
import { TRADE_OVERVIEW_INDICATORS, TRADE_OVERVIEW_SOURCE } from "../data/tradeOverview/types";
import { buildTradeHubCards } from "../explorer/tradeHubCards";
import { tradeOverviewCoverage } from "../explorer/tradeOverviewState";
import { formatDisplayDate } from "../explorer/format";
import { I18nProvider } from "../i18n/provider";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";

export async function tradeHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["trade"]);
  return fiscalMetadata({ locale, path: "/explorer/trade", title: message(messages, "trade.metaTitle"), description: message(messages, "trade.metaDescription") });
}
export async function tradeOverviewMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["trade"]);
  const { facts } = await loadServedTradeOverviewData();
  const { min, max } = tradeOverviewCoverage(facts.map(toClientTradeOverviewFact));
  return fiscalMetadata({ locale, path: "/explorer/trade/overview", title: message(messages, "trade.title"), description: `${message(messages, "trade.metaDescription")} ${min}–${max}.` });
}
export async function renderTradeHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedTradeOverviewData(), getPresentation(locale, ["trade", "common"], [])]);
  const title = message(presentation.messages, "trade.hubTitle");
  return <I18nProvider {...presentation}>
    <BreadcrumbJsonLd items={[{ name: message(presentation.messages, "common.home"), path: pageHref("/", locale) }, { name: title, path: pageHref("/explorer/trade", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={[{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: title }]} coverage="" />
      <ExplorerHeading>{title}</ExplorerHeading>
      <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{message(presentation.messages, "trade.hubSummary")}</p>
      <BudgetHub cards={buildTradeHubCards(facts.map(toClientTradeOverviewFact), presentation)} locale={locale} testId="trade-hub" />
    </ExplorerPage>
  </I18nProvider>;
}
export async function renderTradeOverviewPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedTradeOverviewData(), getPresentation(locale, ["trade", "common", "controls", "main", "format", "workbook"], []),
    loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const facts = data.facts.map(toClientTradeOverviewFact), { min, max } = tradeOverviewCoverage(facts);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const sources = projectWorkbookSources(manifest.filter(row => row.source_id === TRADE_OVERVIEW_SOURCE), locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/trade", locale) }, { label: t("title") }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/trade/overview#dataset`, name: t("title"), description: t("summary"),
      url: `${origin}${pageHref("/explorer/trade/overview", locale)}`, temporalCoverage: `${min}/${max}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "en" ? "Georgia" : "საქართველო" }, creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" },
      publisher: { "@id": `${origin}/#organization` }, variableMeasured: TRADE_OVERVIEW_INDICATORS.map(id => t(`indicator.${id}`)),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/trade", locale) }, { name: t("title"), path: pageHref("/explorer/trade/overview", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <TradeOverview facts={facts} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
