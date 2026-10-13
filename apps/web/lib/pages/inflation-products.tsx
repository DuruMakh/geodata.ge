import { InflationProducts } from "../../components/inflation/inflation-products";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedProductData } from "../data/inflation/importProducts";
import { productRunBounds } from "../explorer/inflationProducts";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { explorerDatasetJsonLd } from "../seo/structuredData";
import { resolveSiteUrl } from "../siteUrl";
import { INFLATION_HUB_PATH, inflationRepositoryRoot, inflationWorkbookSources } from "./inflation-shared";
import { loadInflationPageData } from "./inflationPageData";

const PRODUCTS_PATH = "/explorer/inflation/products";

export async function inflationProductsMetadata(locale: Locale) {
  const [{ catalogue, facts }, messages] = await Promise.all([loadServedProductData(), getMessages(locale, ["inflation"])]);
  const first = Math.min(...catalogue.map((row) => Number(row.firstPeriod.slice(0, 4))));
  const last = Math.max(...facts.map((fact) => Number(fact.period.slice(0, 4))));
  return fiscalMetadata({
    locale,
    path: PRODUCTS_PATH,
    title: message(messages, "inflation.productsMetaTitle", { first, last }),
    description: message(messages, "inflation.productsDescription"),
  });
}

export async function renderInflationProducts(locale: Locale) {
  const root = inflationRepositoryRoot();
  const [{ catalogue: products, facts }, pageData, presentation, manifest, languageCatalogue] = await Promise.all([
    loadServedProductData(),
    loadInflationPageData(),
    getPresentation(locale, ["inflation", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, languageCatalogue.documents).filter((row) =>
    row.sourceId === "source.geostat_product_yoy" || row.sourceId === "source.geostat_product_mom");
  const t = (key: string) => message(presentation.messages, key);
  const origin = resolveSiteUrl();
  const firstPeriod = products.map((row) => row.firstPeriod).sort()[0]!;
  const lastPeriod = facts.map((fact) => fact.period).sort().at(-1)!;
  const reviewedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1)!;
  return <I18nProvider {...clientPresentation(presentation)}>
    <JsonLd testId="product-dataset-json-ld" data={explorerDatasetJsonLd({
      locale, origin, path: PRODUCTS_PATH, datasetId: "inflation-products", name: t("inflation.productsWorkbookTitle"), description: t("inflation.productsDescription"),
      firstYear: firstPeriod, lastYear: lastPeriod, dateModified: reviewedAt, downloadPath: "/downloads/data/inflation-products.csv",
      variableMeasured: [t("inflation.productsAnnualIndexColumn"), t("inflation.productsCumulativeDataColumn")],
      isBasedOn: sources.map((row) => new URL(row.downloadHref, origin).href),
    })} />
    <BreadcrumbJsonLd items={[
      { name: t("common.home"), path: pageHref("/", locale) },
      { name: t("common.inflation"), path: pageHref(INFLATION_HUB_PATH, locale) },
      { name: t("inflation.productsHeading"), path: pageHref(PRODUCTS_PATH, locale) },
    ]} />
    <InflationProducts
      products={products.map(({ productId, labelEn, labelKa, firstPeriod }) => ({ productId, labelEn, labelKa, firstPeriod }))}
      dataUrl={pageData.products.url}
      coverage={productRunBounds(pageData.productRuns)}
      lastReviewedAt={reviewedAt}
      sources={sources}
      siteOrigin={origin}
    />
  </I18nProvider>;
}
