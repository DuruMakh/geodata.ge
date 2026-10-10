import path from "node:path";
import { ForeignInvestment } from "../../components/external/foreign-investment";
import { MoneyFromAbroad } from "../../components/external/money-from-abroad";
import { BudgetHub } from "../../components/hub/budget-hub";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";
import { PageHeader } from "../../components/shell/page-header";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { FOREIGN_INVESTMENT_SOURCES, MONEY_TRANSFER_SOURCES } from "../data/externalFlows/types";
import { buildExternalHubCards } from "../explorer/externalHubCards";
import { moneyTransfersCoverage } from "../explorer/moneyTransfersState";
import { foreignInvestmentCoverage } from "../explorer/foreignInvestmentState";
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

async function loadClientMoneyTransfers() {
  const data = await loadServedMoneyTransfersData();
  return { data, client: toClientMoneyTransfersData(data) };
}
async function loadClientForeignInvestment() {
  const data = await loadServedForeignInvestmentData();
  return { data, client: toClientForeignInvestmentData(data) };
}

export async function externalHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["external"]);
  return fiscalMetadata({ locale, path: "/explorer/external", title: message(messages, "external.metaTitle"), description: message(messages, "external.metaDescription") });
}

export async function renderExternalHub(locale: Locale) {
  const [{ client }, { client: investment }, presentation] = await Promise.all([loadClientMoneyTransfers(), loadClientForeignInvestment(), getPresentation(locale, ["external", "common"], [])]);
  const title = message(presentation.messages, "external.hubTitle");
  return <I18nProvider {...presentation}>
    <BreadcrumbJsonLd items={[{ name: message(presentation.messages, "common.home"), path: pageHref("/", locale) }, { name: title, path: pageHref("/explorer/external", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={[{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: title }]} coverage="" />
      <ExplorerHeading>{title}</ExplorerHeading>
      <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{message(presentation.messages, "external.hubSummary")}</p>
      <BudgetHub cards={buildExternalHubCards(client, investment, presentation)} locale={locale} testId="external-hub" />
    </ExplorerPage>
  </I18nProvider>;
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
    getPresentation(locale, ["external", "common", "controls", "main", "format", "workbook"], data.entities.map(entity => entity.id)),
    loadReviewedSourceManifest(root, "external-flows"), loadEnglishCatalogue(root),
  ]);
  const { min, max } = moneyTransfersCoverage(client);
  const sourceIds = new Set<string>(Object.values(MONEY_TRANSFER_SOURCES).map(id => id.replace(/^source\./, "")));
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = data.facts.map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/external", locale) }, { label: t("money.title") }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/external/money-from-abroad#dataset`, name: t("money.title"), description: t("money.summary"), url: `${origin}${pageHref("/explorer/external/money-from-abroad", locale)}`, temporalCoverage: `${min}/${max}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "en" ? "Georgia" : "საქართველო" }, creator: { "@type": "Organization", name: "National Bank of Georgia", url: "https://nbg.gov.ge" }, publisher: { "@id": `${origin}/#organization` }, variableMeasured: [t("measure.received"), t("measure.sent")],
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/external", locale) }, { name: t("money.title"), path: pageHref("/explorer/external/money-from-abroad", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <MoneyFromAbroad data={client} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
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
    getPresentation(locale, ["external", "common", "controls", "main", "format", "workbook"], data.entities.map(entity => entity.id)),
    loadReviewedSourceManifest(root, "external-flows"), loadEnglishCatalogue(root),
  ]);
  const { min, max } = foreignInvestmentCoverage(client, "country");
  const sourceIds = new Set<string>([...Object.values(FOREIGN_INVESTMENT_SOURCES).map(id => id.replace(/^source\./, "")), "geostat_fdi_metadata"]);
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = data.facts.map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `external.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/external", locale) }, { label: t("investment.title") }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/external/foreign-investment#dataset`, name: t("investment.title"), description: t("investment.summary"), url: `${origin}${pageHref("/explorer/external/foreign-investment", locale)}`, temporalCoverage: `${min}/${max}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "en" ? "Georgia" : "საქართველო" }, creator: { "@type": "Organization", name: "National Statistics Office of Georgia (Geostat)", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` }, variableMeasured: [t("investment.tab.country"), t("investment.tab.sector"), t("investment.tab.region")],
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/external", locale) }, { name: t("investment.title"), path: pageHref("/explorer/external/foreign-investment", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <ForeignInvestment data={client} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
