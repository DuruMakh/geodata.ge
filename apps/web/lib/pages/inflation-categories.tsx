import { InflationCategories } from "../../components/inflation/inflation-categories";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { JsonLd } from "../../components/seo/json-ld";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { periodFromKey, periodYear } from "../data/inflation/periods";
import { categoryFactInput } from "../data/inflation/types";
import { packFacts } from "../data/packedFacts";
import { packCategoryFacts } from "../explorer/inflationCategories";
import { projectBasketWeight } from "../explorer/clientData";
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
import { inflationRepositoryRoot, inflationWorkbookSources } from "./inflation-shared";
import { loadInflationPageData } from "./inflationPageData";
import { ALL_DATA_PATH, topicSection } from "../navigation/navTree";

const CATEGORIES_PATH = "/explorer/inflation/categories";

export async function inflationCategoriesMetadata(locale: Locale) {
  const [{ categories }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const years = categories.map((fact) => periodYear(periodFromKey(fact.period)));
  return fiscalMetadata({
    locale,
    path: CATEGORIES_PATH,
    title: message(messages, "inflation.categoriesMetaTitle", { first: Math.min(...years), last: Math.max(...years) }),
    description: message(messages, "inflation.categoriesDescription"),
  });
}

export async function renderInflationCategories(locale: Locale) {
  const root = inflationRepositoryRoot();
  const [{ facts, categories, weights }, pageData, presentation, manifest, catalogue] = await Promise.all([
    loadServedInflationData(),
    loadInflationPageData(),
    getPresentation(locale, ["inflation", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  // The stack closes on the published national headline, so it travels with the page.
  const headline = facts
    .filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct")
    .map((fact) => ({ period: periodFromKey(fact.period), value: fact.value }));
  const headlineMom = facts
    .filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "mom_pct")
    .map((fact) => ({ period: periodFromKey(fact.period), value: fact.value }));
  const t = (key: string) => message(presentation.messages, key);
  const periods = categories.map((fact) => fact.period).sort(), lastReviewedAt = categories.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      <JsonLd testId="explorer-dataset-json-ld" data={explorerDatasetJsonLd({
        locale, origin: resolveSiteUrl(), path: CATEGORIES_PATH, datasetId: "inflation",
        name: `${t("common.inflation")}: ${t("inflation.categoriesHeading")}`, description: t("inflation.categoriesDescription"),
        firstYear: periods[0], lastYear: periods.at(-1)!, dateModified: lastReviewedAt, downloadPath: "/downloads/data/inflation-categories.csv", sources: ["geostat"],
        variableMeasured: [t("inflation.categoryTab.yoy"), t("inflation.categoryTab.mom"), t("inflation.categoryTab.contrib"), t("inflation.weightColumn")],
      })} />
      <BreadcrumbJsonLd
        items={[
          { name: t("common.home"), path: pageHref("/", locale) },
          { name: t("common.data"), path: pageHref(ALL_DATA_PATH, locale) },
          { name: t("common.inflation"), path: pageHref(topicSection("inflation").path, locale) },
          { name: t("inflation.categoriesHeading"), path: pageHref(CATEGORIES_PATH, locale) },
        ]}
      />
      <InflationCategories
        facts={packCategoryFacts(categories.filter((fact) => fact.measure === "yoy_pct").map(categoryFactInput))}
        monthlyUrl={pageData.categoryMonthly.url}
        weights={packFacts(weights.map(projectBasketWeight))}
        headline={headline}
        headlineMom={headlineMom}
        lastReviewedAt={lastReviewedAt}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
    </I18nProvider>
  );
}
