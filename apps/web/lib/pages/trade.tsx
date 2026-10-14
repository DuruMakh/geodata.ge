import { TradeComposition } from "../../components/trade/trade-composition";
import { loadServedTradeCompositionData, toClientTradeCompositionData } from "../data/tradeComposition/importTradeComposition";
import { TRADE_COMPOSITION_SOURCES } from "../data/tradeComposition/types";
import path from "node:path";
import { TradeOverview } from "../../components/trade/trade-overview";
import { TradePartners } from "../../components/trade/trade-partners";
import { TradeProducts } from "../../components/trade/trade-products";
import { TradeServices } from "../../components/trade/trade-services";
import { loadServedTradeServicesData, toClientTradeServicesData } from "../data/tradeServices/importTradeServices";
import { TRADE_SERVICES_SOURCES } from "../data/tradeServices/types";
import { TradeDomesticExports } from "../../components/trade/trade-domestic-exports";
import { loadServedTradeDomesticData, toClientTradeDomesticData } from "../data/tradeDomestic/importTradeDomestic";
import { TRADE_DOMESTIC_DOCUMENT_IDS } from "../data/tradeDomestic/types";
import { ExplorerPage } from "../../components/explorer-shell/explorer-page";
import { PageHeader } from "../../components/shell/page-header";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedTradeOverviewData, toClientTradeOverviewFact } from "../data/tradeOverview/importTradeOverview";
import { loadServedTradePartnersData, toClientTradePartnersData } from "../data/tradePartners/importTradePartners";
import { TRADE_PARTNER_SOURCES } from "../data/tradePartners/types";
import { loadServedTradeProductsData, loadTradeProductCatalogueFingerprint, toClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_MEASURES, TRADE_PRODUCT_SOURCES } from "../data/tradeProducts/types";
import { tradeProductsCoverage } from "../explorer/tradeProductsState";
import { tradePartnersCoverage } from "../explorer/tradePartnersState";
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
import { TopicHub } from "./hub";

const PRODUCT_SOURCE_BLOCK = "2020-2025";

export async function tradeHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["trade"]);
  return fiscalMetadata({ locale, path: "/explorer/trade", title: message(messages, "trade.hubMetaTitle"), description: message(messages, "trade.hubMetaDescription") });
}
export async function tradeOverviewMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["trade"]);
  const { facts } = await loadServedTradeOverviewData();
  const { min, max } = tradeOverviewCoverage(facts.map(toClientTradeOverviewFact));
  return fiscalMetadata({ locale, path: "/explorer/trade/overview", title: message(messages, "trade.title"), description: `${message(messages, "trade.metaDescription")} ${min}–${max}.` });
}
export async function renderTradeHub(locale: Locale) {
  const [{ facts }, partners, products, domestic, services, composition, presentation] = await Promise.all([loadServedTradeOverviewData(), loadServedTradePartnersData(), loadServedTradeProductsData(), loadServedTradeDomesticData(), loadServedTradeServicesData(), loadServedTradeCompositionData(), getPresentation(locale, ["trade", "common"], [])]);
  const title = message(presentation.messages, "trade.hubTitle");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "trade.hubSummary")} path={"/explorer/trade"} coverage="" cards={buildTradeHubCards(facts.map(toClientTradeOverviewFact), presentation, tradePartnersCoverage(toClientTradePartnersData(partners, [])), tradeProductsCoverage(toClientTradeProductsData(products, [], "", PRODUCT_SOURCE_BLOCK)), toClientTradeDomesticData(domestic, []).national, toClientTradeServicesData(services).national, toClientTradeCompositionData(composition, facts).sitc.nationalFacts.filter(fact => fact.indicatorId === "trade.exports"))} testId="trade-hub" />;
}
export async function tradeProductsMetadata(locale: Locale) {
  const [products, messages] = await Promise.all([loadServedTradeProductsData(), getMessages(locale, ["trade"])]);
  const { min, max } = tradeProductsCoverage(toClientTradeProductsData(products, [], "", PRODUCT_SOURCE_BLOCK));
  return fiscalMetadata({ locale, path: "/explorer/trade/products", title: message(messages, "trade.products.metaTitle"), description: `${message(messages, "trade.products.summary")} ${min}–${max}.` });
}

export async function tradeDomesticMetadata(locale: Locale) {
  const [domestic, messages] = await Promise.all([loadServedTradeDomesticData(), getMessages(locale, ["trade"])]);
  const { min, max } = tradeOverviewCoverage(toClientTradeDomesticData(domestic, []).national);
  return fiscalMetadata({ locale, path: "/explorer/trade/domestic-exports", title: message(messages, "trade.domestic.title"), description: `${message(messages, "trade.domestic.summary")} ${min}–${max}.` });
}

export async function renderTradeDomesticPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [domestic, national, presentation, manifest, catalogue] = await Promise.all([
    loadServedTradeDomesticData(), loadServedTradeOverviewData(), getPresentation(locale, ["trade", "common", "controls", "main", "format", "workbook"], []), loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const data = toClientTradeDomesticData(domestic, national.facts), { min, max } = tradeOverviewCoverage(data.national);
  const t = (key: string) => message(presentation.messages, `trade.${key}`), title = t("domestic.title");
  const sources = projectWorkbookSources(manifest.filter(row => row.source_id in TRADE_DOMESTIC_DOCUMENT_IDS), locale, catalogue.documents);
  const lastReviewedAt = domestic.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/trade", locale) }, { label: title }];
  return <I18nProvider {...presentation} englishLabels={{ ...presentation.englishLabels, ...data.englishLabels }}>
    <JsonLd testId="explorer-dataset-json-ld" data={{ "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/trade/domestic-exports#dataset`, name: title, description: t("domestic.summary"), url: `${origin}${pageHref("/explorer/trade/domestic-exports", locale)}`, temporalCoverage: `${min}/${max}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"], spatialCoverage: { "@type": "Place", name: locale === "en" ? "Georgia" : "საქართველო" }, creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` }, variableMeasured: [t("indicator.trade.domestic_exports"), t("indicator.trade.reexports")] }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/trade", locale) }, { name: title, path: pageHref("/explorer/trade/domestic-exports", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <TradeDomesticExports data={data} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}

export async function renderTradeProductsPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [products, national, fingerprint] = await Promise.all([loadServedTradeProductsData(), loadServedTradeOverviewData(), loadTradeProductCatalogueFingerprint(PRODUCT_SOURCE_BLOCK)]);
  const data = toClientTradeProductsData(products, national.facts, fingerprint, PRODUCT_SOURCE_BLOCK), { min, max } = tradeProductsCoverage(data);
  const [presentation, manifest, catalogue] = await Promise.all([
    getPresentation(locale, ["trade", "common", "controls", "main", "format", "workbook"], data.entities.map(entity => entity.id)),
    loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const sourceIds = new Set<string>(Object.values(TRADE_PRODUCT_SOURCES[PRODUCT_SOURCE_BLOCK])); sourceIds.add(TRADE_OVERVIEW_SOURCE);
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = [...products.facts.filter(fact => fact.sourceBlock === PRODUCT_SOURCE_BLOCK), ...national.facts.filter(fact => data.years.includes(fact.year))].map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/trade", locale) }, { label: t("products.title") }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/trade/products#dataset`, name: t("products.title"), description: t("products.summary"), url: `${origin}${pageHref("/explorer/trade/products", locale)}`, temporalCoverage: `${min}/${max}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "en" ? "Georgia" : "საქართველო" }, creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` }, variableMeasured: TRADE_PRODUCT_MEASURES.map(id => t(`indicator.${id}`)),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/trade", locale) }, { name: t("products.title"), path: pageHref("/explorer/trade/products", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <TradeProducts data={data} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}

export async function tradePartnersMetadata(locale: Locale) {
  const [data, messages] = await Promise.all([loadServedTradePartnersData(), getMessages(locale, ["trade"])]);
  const { min, max } = tradePartnersCoverage(toClientTradePartnersData(data, []));
  return fiscalMetadata({ locale, path: "/explorer/trade/partners", title: message(messages, "trade.partners.title"), description: `${message(messages, "trade.partners.summary")} ${min}–${max}.` });
}

export async function renderTradePartnersPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [partners, national] = await Promise.all([loadServedTradePartnersData(), loadServedTradeOverviewData()]);
  const [presentation, manifest, catalogue] = await Promise.all([
    getPresentation(locale, ["trade", "common", "controls", "main", "format", "workbook"], partners.entities.map(entity => entity.id)),
    loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const data = toClientTradePartnersData(partners, national.facts), { min, max } = tradePartnersCoverage(data);
  const sourceIds = new Set<string>(Object.values(TRADE_PARTNER_SOURCES).flatMap(sources => Object.values(sources)));
  sourceIds.add(TRADE_OVERVIEW_SOURCE);
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = [...partners.facts, ...national.facts].map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/trade", locale) }, { label: t("partners.title") }];
  return <I18nProvider {...presentation}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/trade/partners#dataset`, name: t("partners.title"), description: t("partners.summary"), url: `${origin}${pageHref("/explorer/trade/partners", locale)}`, temporalCoverage: `${min}/${max}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "en" ? "Georgia" : "საქართველო" }, creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` }, variableMeasured: TRADE_OVERVIEW_INDICATORS.map(id => t(`indicator.${id}`)),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/trade", locale) }, { name: t("partners.title"), path: pageHref("/explorer/trade/partners", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <TradePartners data={data} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
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


export async function tradeServicesMetadata(locale: Locale) {
  const [services, messages] = await Promise.all([loadServedTradeServicesData(), getMessages(locale, ["trade"])]);
  const { min, max } = tradeOverviewCoverage(toClientTradeServicesData(services).national);
  return fiscalMetadata({ locale, path: "/explorer/trade/services", title: message(messages, "trade.services.title"), description: `${message(messages, "trade.services.summary")} ${min}–${max}.` });
}

export async function renderTradeServicesPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [services, presentation, manifest, catalogue] = await Promise.all([
    loadServedTradeServicesData(), getPresentation(locale, ["trade", "common", "controls", "main", "format", "workbook"], []),
    loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const data = toClientTradeServicesData(services), { min, max } = tradeOverviewCoverage(data.national);
  const sourceIds = new Set<string>(Object.values(TRADE_SERVICES_SOURCES));
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = services.facts.map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `trade.${key}`), title = t("services.title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/trade", locale) }, { label: title }];
  return <I18nProvider {...presentation} englishLabels={{ ...presentation.englishLabels, ...data.englishLabels }}>
    <JsonLd testId="explorer-dataset-json-ld" data={{
      "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/trade/services#dataset`, name: title, description: t("services.summary"), url: `${origin}${pageHref("/explorer/trade/services", locale)}`, temporalCoverage: `${min}/${max}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"],
      spatialCoverage: { "@type": "Place", name: locale === "en" ? "Georgia" : "საქართველო" }, creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` }, variableMeasured: TRADE_OVERVIEW_INDICATORS.map(id => t(`services.indicator.${id}`)),
    }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/trade", locale) }, { name: title, path: pageHref("/explorer/trade/services", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <TradeServices data={data} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}


export async function tradeCompositionMetadata(locale: Locale) {
  const [composition, national, messages] = await Promise.all([loadServedTradeCompositionData(), loadServedTradeOverviewData(), getMessages(locale, ["trade"])]);
  const { min, max } = tradePartnersCoverage(toClientTradeCompositionData(composition, national.facts).sitc);
  return fiscalMetadata({ locale, path: "/explorer/trade/composition", title: message(messages, "trade.composition.title"), description: `${message(messages, "trade.composition.summary")} ${min}–${max}.` });
}

export async function renderTradeCompositionPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [composition, national, presentation, manifest, catalogue] = await Promise.all([
    loadServedTradeCompositionData(), loadServedTradeOverviewData(), getPresentation(locale, ["trade", "common", "controls", "main", "format", "workbook"], []), loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const data = toClientTradeCompositionData(composition, national.facts), { min, max } = tradePartnersCoverage(data.sitc);
  const sourceIds = new Set<string>(Object.values(TRADE_COMPOSITION_SOURCES).flatMap(sources => Object.values(sources)));
  sourceIds.add(TRADE_OVERVIEW_SOURCE);
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = [...composition.facts, ...national.facts.filter(fact => fact.year >= min && fact.year <= max && (fact.indicatorId === "trade.exports" || fact.indicatorId === "trade.imports"))].map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `trade.${key}`), title = t("composition.title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref("/explorer/trade", locale) }, { label: title }];
  return <I18nProvider {...presentation} englishLabels={{ ...presentation.englishLabels, ...data.englishLabels }}>
    <JsonLd testId="explorer-dataset-json-ld" data={{ "@context": "https://schema.org", "@type": "Dataset", "@id": `${origin}/explorer/trade/composition#dataset`, name: title, description: t("composition.summary"), url: `${origin}${pageHref("/explorer/trade/composition", locale)}`, temporalCoverage: `${min}/${max}`, dateModified: lastReviewedAt, inLanguage: ["ka", "en"], spatialCoverage: { "@type": "Place", name: locale === "en" ? "Georgia" : "საქართველო" }, creator: { "@type": "Organization", name: "Geostat", url: "https://www.geostat.ge" }, publisher: { "@id": `${origin}/#organization` }, variableMeasured: [t("composition.indicator.trade.exports"), t("composition.indicator.trade.imports")] }} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref("/explorer/trade", locale) }, { name: title, path: pageHref("/explorer/trade/composition", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader crumbs={crumbs} coverage={`${min}–${max} · ${message(presentation.messages, "main.updated", { date: formatDisplayDate(lastReviewedAt, locale) })}`} />
      <TradeComposition data={data} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
