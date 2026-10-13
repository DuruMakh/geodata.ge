import path from "node:path";
import { CurrentAccount } from "../../components/external/current-account";
import { ForeignInvestment } from "../../components/external/foreign-investment";
import { MoneyFromAbroad } from "../../components/external/money-from-abroad";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedCurrentAccountFacts, toClientCurrentAccountFacts } from "../data/externalFlows/importCurrentAccount";
import { loadServedGdpOverviewData } from "../data/gdpOverview/importGdpOverview";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { packFacts } from "../data/packedFacts";
import { CURRENT_ACCOUNT_SERIES, CURRENT_ACCOUNT_SOURCE, FOREIGN_INVESTMENT_SOURCES, MONEY_TRANSFER_SOURCES } from "../data/externalFlows/types";
import { moneyTransfersCoverage } from "../explorer/moneyTransfersState";
import { foreignInvestmentCoverage } from "../explorer/foreignInvestmentState";
import { currentAccountCoverage } from "../explorer/currentAccountState";
import { formatDisplayDate } from "../explorer/format";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { loadGdpWorkbookSources, projectWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { publicLabel } from "../i18n/labels";
import { resolveSiteUrl } from "../siteUrl";

async function loadClientMoneyTransfers() {
  const data = await loadServedMoneyTransfersData();
  return { data, client: toClientMoneyTransfersData(data) };
}
async function loadClientCurrentAccount() {
  const facts = await loadServedCurrentAccountFacts();
  return { facts, client: toClientCurrentAccountFacts(facts) };
}
async function loadClientForeignInvestment() {
  const data = await loadServedForeignInvestmentData();
  return { data, client: toClientForeignInvestmentData(data) };
}

export async function moneyFromAbroadMetadata(locale: Locale) {
  const [{ client }, messages] = await Promise.all([loadClientMoneyTransfers(), getMessages(locale, ["external"])]);
  const { min, max } = moneyTransfersCoverage(client);
  return fiscalMetadata({ locale, path: "/explorer/external/money-from-abroad", title: message(messages, "external.money.title"), description: `${message(messages, "external.money.summary")} ${min}–${max}.` });
}

export async function renderMoneyFromAbroadPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const { data, client } = await loadClientMoneyTransfers();
  const [presentation, manifest, catalogue] = await Promise.all([
    // Only the entities the page serves; the Georgian page's country search reads Georgian names only.
    getPresentation(locale, ["external", "main", "format", "workbook"], client.entities.map(entity => entity.id)),
    loadReviewedSourceManifest(root, "external-flows"), loadEnglishCatalogue(root),
  ]);
  const { min, max } = moneyTransfersCoverage(client);
  const sourceIds = new Set<string>(Object.values(MONEY_TRANSFER_SOURCES).map(id => id.replace(/^source\./, "")));
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = data.facts.map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/external", locale) }, { label: t("money.title") }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/external/money-from-abroad", datasetId: "external-flows", name: t("money.title"), description: t("money.summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      variableMeasured: [t("measure.received"), t("measure.sent")], sources: ["nbg"],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/external", locale) }, { name: t("money.title"), path: pageHref("/explorer/external/money-from-abroad", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <MoneyFromAbroad data={{ ...client, facts: packFacts(client.facts) }} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}

export async function foreignInvestmentMetadata(locale: Locale) {
  const [{ client }, messages] = await Promise.all([loadClientForeignInvestment(), getMessages(locale, ["external"])]);
  const { min, max } = foreignInvestmentCoverage(client, "country");
  return fiscalMetadata({ locale, path: "/explorer/external/foreign-investment", title: message(messages, "external.investment.title"), description: `${message(messages, "external.investment.summary")} ${min}–${max}.` });
}

export async function renderForeignInvestmentPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const { data, client } = await loadClientForeignInvestment();
  const [presentation, manifest, catalogue] = await Promise.all([
    getPresentation(locale, ["external", "main", "format", "workbook"], client.entities.map(entity => entity.id)),
    loadReviewedSourceManifest(root, "external-flows"), loadEnglishCatalogue(root),
  ]);
  const { min, max } = foreignInvestmentCoverage(client, "country"), total = client.entities.find(entity => entity.kind === "total")!;
  const sourceIds = new Set<string>([...Object.values(FOREIGN_INVESTMENT_SOURCES).map(id => id.replace(/^source\./, "")), "geostat_fdi_metadata"]);
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = data.facts.map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/external", locale) }, { label: t("investment.title") }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/external/foreign-investment", datasetId: "external-flows", name: t("investment.title"), description: t("investment.summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      // The page's measures are the investment itself and each item's share of the year's total; country, sector and region are its breakdowns.
      variableMeasured: [publicLabel(locale, total.id, total.labelKa, presentation.englishLabels), t("investment.share")], sources: ["geostat"],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/external", locale) }, { name: t("investment.title"), path: pageHref("/explorer/external/foreign-investment", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <ForeignInvestment data={client} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}

export async function currentAccountMetadata(locale: Locale) {
  const [{ client }, messages] = await Promise.all([loadClientCurrentAccount(), getMessages(locale, ["external"])]);
  const { min, max } = currentAccountCoverage(client);
  return fiscalMetadata({ locale, path: "/explorer/external/current-account", title: message(messages, "external.account.title"), description: `${message(messages, "external.account.summary")} ${min}–${max}.` });
}

export async function renderCurrentAccountPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [{ facts, client }, { facts: gdpFacts }, gdpSources] = await Promise.all([loadClientCurrentAccount(), loadServedGdpOverviewData(), loadGdpWorkbookSources(locale)]);
  const [presentation, manifest, catalogue] = await Promise.all([
    getPresentation(locale, ["external", "main", "format", "workbook"], []),
    loadReviewedSourceManifest(root, "external-flows"), loadEnglishCatalogue(root),
  ]);
  const { min, max } = currentAccountCoverage(client);
  const sourceId = CURRENT_ACCOUNT_SOURCE.replace(/^source\./, "");
  const sources = projectWorkbookSources(manifest.filter(row => row.source_id === sourceId), locale, catalogue.documents);
  const gdp = gdpFacts.filter(fact => fact.seriesId === "nominal_usd").map(fact => ({ year: fact.year, valueUsd: fact.value, preliminary: fact.status === "preliminary" }));
  const lastReviewedAt = facts.map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/external", locale) }, { label: t("account.title") }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/external/current-account", datasetId: "external-flows", name: t("account.title"), description: t("account.summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      variableMeasured: CURRENT_ACCOUNT_SERIES.map(id => t(`account.series.${id}`)),
      // The NBG's balance of payments; the % of GDP view divides by Geostat's GDP.
      sources: ["nbg", "geostat"],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/external", locale) }, { name: t("account.title"), path: pageHref("/explorer/external/current-account", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <CurrentAccount facts={client} gdp={gdp} sources={sources} gdpSources={gdpSources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
