import { TradeComposition } from "../../components/trade/trade-composition";
import { loadServedTradeCompositionData, toClientTradeCompositionData } from "../data/tradeComposition/importTradeComposition";
import { TRADE_COMPOSITION_SOURCES } from "../data/tradeComposition/types";
import path from "node:path";
import { TradeOverview } from "../../components/trade/trade-overview";
import { TradePartners } from "../../components/trade/trade-partners";
import { TradeProducts } from "../../components/trade/trade-products";
import { TradeServices } from "../../components/trade/trade-services";
import { loadServedTradeServicesData, toClientTradeServicesData } from "../data/tradeServices/importTradeServices";
import { TRADE_SERVICES_DOCUMENT_IDS } from "../data/tradeServices/types";
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
import { loadServedTradeProductsData, loadTradeProductCatalogueFingerprint, projectTradeProductsForPage, toClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_MEASURES, TRADE_PRODUCT_SOURCES } from "../data/tradeProducts/types";
import { tradeProductsCoverage } from "../explorer/tradeProductsState";
import { tradePartnersCoverage } from "../explorer/tradePartnersState";
import { TRADE_OVERVIEW_INDICATORS, TRADE_OVERVIEW_SOURCE } from "../data/tradeOverview/types";
import { tradeOverviewCoverage } from "../explorer/tradeOverviewState";
import { coverageLabel } from "../explorer/coverageLabel";
import { I18nProvider } from "../i18n/provider";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { projectWorkbookSources } from "../methodology/workbookSources";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { PRODUCT_SOURCE_BLOCK } from "./topicHubs.server";
import { topicSection } from "../navigation/navTree";

export async function tradeOverviewMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["trade"]);
  const { facts } = await loadServedTradeOverviewData();
  const { min, max } = tradeOverviewCoverage(facts.map(toClientTradeOverviewFact));
  return fiscalMetadata({ locale, path: "/explorer/trade/overview", title: message(messages, "trade.metaTitle"), description: `${message(messages, "trade.metaDescription")} ${min}–${max}.` });
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
    loadServedTradeDomesticData(), loadServedTradeOverviewData(), getPresentation(locale, ["trade", "main", "format", "workbook"], []), loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const { englishLabels, ...data } = toClientTradeDomesticData(domestic, national.facts), { min, max } = tradeOverviewCoverage(data.national);
  // A Georgian page reads only the countries' English names, for the partner search; the product search reads its own.
  const pageLabels = locale === "en" ? englishLabels : Object.fromEntries(data.countries.entities.map(entity => [entity.id, englishLabels[entity.id]]));
  const t = (key: string) => message(presentation.messages, `trade.${key}`), title = t("domestic.title");
  const sources = projectWorkbookSources(manifest.filter(row => row.source_id in TRADE_DOMESTIC_DOCUMENT_IDS), locale, catalogue.documents);
  const lastReviewedAt = domestic.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref(topicSection("trade").href, locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)} englishLabels={{ ...presentation.englishLabels, ...pageLabels }}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/trade/domestic-exports", datasetId: "trade", name: title, description: t("domestic.summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      // The page compares domestic exports with total exports and re-exports.
      variableMeasured: [t("indicator.trade.domestic_exports"), t("indicator.trade.exports"), t("indicator.trade.reexports")],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref(topicSection("trade").path, locale) }, { name: title, path: pageHref("/explorer/trade/domestic-exports", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, min, max, lastReviewedAt)} />
      <TradeDomesticExports data={{ ...data, products: projectTradeProductsForPage(data.products, locale) }} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}

export async function renderTradeProductsPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [products, national, fingerprint] = await Promise.all([loadServedTradeProductsData(), loadServedTradeOverviewData(), loadTradeProductCatalogueFingerprint(PRODUCT_SOURCE_BLOCK)]);
  const data = projectTradeProductsForPage(toClientTradeProductsData(products, national.facts, fingerprint, PRODUCT_SOURCE_BLOCK), locale), { min, max } = tradeProductsCoverage(data);
  const [presentation, manifest, catalogue] = await Promise.all([
    getPresentation(locale, ["trade", "main", "format", "workbook"], data.entities.map(entity => entity.id)),
    loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const sourceIds = new Set<string>(Object.values(TRADE_PRODUCT_SOURCES[PRODUCT_SOURCE_BLOCK])); sourceIds.add(TRADE_OVERVIEW_SOURCE);
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = [...products.facts.filter(fact => fact.sourceBlock === PRODUCT_SOURCE_BLOCK), ...national.facts.filter(fact => data.years.includes(fact.year))].map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref(topicSection("trade").href, locale) }, { label: t("products.title") }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/trade/products", datasetId: "trade", name: t("products.title"), description: t("products.summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      variableMeasured: TRADE_PRODUCT_MEASURES.map(id => t(`indicator.${id}`)),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref(topicSection("trade").path, locale) }, { name: t("products.title"), path: pageHref("/explorer/trade/products", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, min, max, lastReviewedAt)} />
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
    // The partner search matches English names on the Georgian page too.
    getPresentation(locale, ["trade", "main", "format", "workbook"], partners.entities.map(entity => entity.id), partners.entities.map(entity => entity.id)),
    loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const data = toClientTradePartnersData(partners, national.facts), { min, max } = tradePartnersCoverage(data);
  const sourceIds = new Set<string>(Object.values(TRADE_PARTNER_SOURCES).flatMap(sources => Object.values(sources)));
  sourceIds.add(TRADE_OVERVIEW_SOURCE);
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = [...partners.facts, ...national.facts].map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref(topicSection("trade").href, locale) }, { label: t("partners.title") }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/trade/partners", datasetId: "trade", name: t("partners.title"), description: t("partners.summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      variableMeasured: TRADE_OVERVIEW_INDICATORS.map(id => t(`indicator.${id}`)),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref(topicSection("trade").path, locale) }, { name: t("partners.title"), path: pageHref("/explorer/trade/partners", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, min, max, lastReviewedAt)} />
      <TradePartners data={data} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
export async function renderTradeOverviewPage(locale: Locale) {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedTradeOverviewData(), getPresentation(locale, ["trade", "main", "format", "workbook"], []),
    loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const facts = data.facts.map(toClientTradeOverviewFact), { min, max } = tradeOverviewCoverage(facts);
  const lastReviewedAt = data.facts.map(f => f.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const sources = projectWorkbookSources(manifest.filter(row => row.source_id === TRADE_OVERVIEW_SOURCE), locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, `trade.${key}`);
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref(topicSection("trade").href, locale) }, { label: t("title") }];
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/trade/overview", datasetId: "trade", name: t("title"), description: t("summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      variableMeasured: TRADE_OVERVIEW_INDICATORS.map(id => t(`indicator.${id}`)),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref(topicSection("trade").path, locale) }, { name: t("title"), path: pageHref("/explorer/trade/overview", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, min, max, lastReviewedAt)} />
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
    loadServedTradeServicesData(), getPresentation(locale, ["trade", "main", "format", "workbook"], []),
    loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const { englishLabels, ...data } = toClientTradeServicesData(services), { min, max } = tradeOverviewCoverage(data.national);
  const sourceIds = new Set(Object.keys(TRADE_SERVICES_DOCUMENT_IDS));
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = services.facts.map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `trade.${key}`), title = t("services.title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref(topicSection("trade").href, locale) }, { label: title }];
  // The service-type search matches English names on the Georgian page too.
  return <I18nProvider {...clientPresentation(presentation)} englishLabels={{ ...presentation.englishLabels, ...englishLabels }}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/trade/services", datasetId: "trade", name: title, description: t("services.summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      variableMeasured: TRADE_OVERVIEW_INDICATORS.map(id => t(`services.indicator.${id}`)),
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref(topicSection("trade").path, locale) }, { name: title, path: pageHref("/explorer/trade/services", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, min, max, lastReviewedAt)} />
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
    loadServedTradeCompositionData(), loadServedTradeOverviewData(), getPresentation(locale, ["trade", "main", "format", "workbook"], []), loadReviewedSourceManifest(root, "trade"), loadEnglishCatalogue(root),
  ]);
  const { englishLabels, ...data } = toClientTradeCompositionData(composition, national.facts), { min, max } = tradePartnersCoverage(data.sitc);
  const sourceIds = new Set<string>(Object.values(TRADE_COMPOSITION_SOURCES).flatMap(sources => Object.values(sources)));
  sourceIds.add(TRADE_OVERVIEW_SOURCE);
  const sources = projectWorkbookSources(manifest.filter(row => sourceIds.has(row.source_id)), locale, catalogue.documents);
  const lastReviewedAt = [...composition.facts, ...national.facts.filter(fact => fact.year >= min && fact.year <= max && (fact.indicatorId === "trade.exports" || fact.indicatorId === "trade.imports"))].map(fact => fact.lastReviewedAt).sort().at(-1)!, origin = resolveSiteUrl();
  const t = (key: string) => message(presentation.messages, `trade.${key}`), title = t("composition.title");
  const crumbs = [{ label: message(presentation.messages, "common.home"), href: pageHref("/", locale) }, { label: message(presentation.messages, "common.data") }, { label: t("hubTitle"), href: pageHref(topicSection("trade").href, locale) }, { label: title }];
  return <I18nProvider {...clientPresentation(presentation)} englishLabels={{ ...presentation.englishLabels, ...englishLabels }}>
    <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: "/explorer/trade/composition", datasetId: "trade", name: title, description: t("composition.summary"), firstYear: min, lastYear: max, dateModified: lastReviewedAt,
      variableMeasured: [t("composition.indicator.trade.exports"), t("composition.indicator.trade.imports")],
    })} />
    <BreadcrumbJsonLd items={[{ name: crumbs[0].label, path: pageHref("/", locale) }, { name: t("hubTitle"), path: pageHref(topicSection("trade").path, locale) }, { name: title, path: pageHref("/explorer/trade/composition", locale) }]} />
    <ExplorerPage containerQueries={false}>
      <PageHeader locale={locale} messages={presentation.messages} crumbs={crumbs} coverage={coverageLabel(presentation.messages, locale, min, max, lastReviewedAt)} />
      <TradeComposition data={data} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={origin} />
    </ExplorerPage>
  </I18nProvider>;
}
