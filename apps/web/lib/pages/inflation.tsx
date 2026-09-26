import path from "node:path";
import { BudgetHub } from "../../components/hub/budget-hub";
import { InflationCategories } from "../../components/inflation/inflation-categories";
import { InflationCities } from "../../components/inflation/inflation-cities";
import { InflationOverview } from "../../components/inflation/inflation-overview";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { periodFromKey, periodYear } from "../data/inflation/periods";
import { CITY_FIRST_PERIOD, categoryFactInput, cityFactInput, type CityFactInput, type CpiCityMeasure } from "../data/inflation/types";
import { packCategoryFacts } from "../explorer/inflationCategories";
import { GEORGIA_LINE_ID, packCityFacts } from "../explorer/inflationCities";
import {
  projectBasketWeight,
  projectCpiFact,
  projectInflationTarget,
  sourceIdBySeriesMeasure,
} from "../explorer/clientData";
import { buildInflationHubCards } from "../explorer/inflationHubCards";
import type { InflationWorkbookSource } from "../explorer/inflationWorkbook";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { projectPublicSources } from "../methodology/publicSources";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { ExplorerHeading } from "../../components/explorer-shell/explorer-heading";

const HUB_PATH = "/explorer/inflation";
const OVERVIEW_PATH = "/explorer/inflation/overview";
const CATEGORIES_PATH = "/explorer/inflation/categories";
const CITIES_PATH = "/explorer/inflation/cities";
const repositoryRoot = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");

/** Georgia's line for the cities page: the national total and divisions from 2016, never copied into the city CSV. */
function georgiaCityLine(data: Awaited<ReturnType<typeof loadServedInflationData>>): CityFactInput[] {
  const total = data.facts
    .filter((fact) => fact.seriesId === "cpi.headline" && (fact.measure === "yoy_pct" || fact.measure === "mom_pct" || fact.measure === "avg12_pct") && fact.period >= CITY_FIRST_PERIOD)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: "cpi.headline", measure: fact.measure as CpiCityMeasure, period: fact.period, value: fact.value }));
  const divisions = data.categories
    .filter((fact) => fact.level === 2 && fact.period >= CITY_FIRST_PERIOD)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: fact.categoryId, measure: fact.measure, period: fact.period, value: fact.value }));
  return [...total, ...divisions];
}

// Archive rows ending in "_ka" are the Georgian twins of the English source files.
function inflationWorkbookSources(
  manifest: Awaited<ReturnType<typeof loadReviewedSourceManifest>>,
  locale: Locale,
  documents: Awaited<ReturnType<typeof loadEnglishCatalogue>>["documents"],
): InflationWorkbookSource[] {
  const projected = projectPublicSources(manifest, locale, documents);
  return manifest.map((row) => {
    const shown = projected.find((entry) => entry.source_id === row.source_id)!;
    return {
      sourceId: row.source_id.replace(/_ka$/, ""),
      language: row.source_id.endsWith("_ka") ? "ka" : "en",
      years: row.years,
      title: shown.title,
      organization: shown.publisher,
      downloadHref: row.downloadHref,
      retrievedAt: row.retrieved_at,
    };
  });
}

export async function inflationHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["inflation"]);
  return fiscalMetadata({ locale, path: HUB_PATH, title: message(messages, "inflation.hubMetaTitle"), description: message(messages, "inflation.hubDescription") });
}

export async function renderInflationHub(locale: Locale) {
  const [{ facts, categories, weights, cities }, presentation] = await Promise.all([loadServedInflationData(), getPresentation(locale, ["inflation", "common"], [])]);
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={[{ name: t("common.home"), path: pageHref("/", locale) }, { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) }]} />
      <main className="px-5 pb-16 min-[768px]:px-[34px]">
        <div className="mx-auto max-w-[1180px]">
          <PageHeader crumbs={[{ label: t("common.home"), href: pageHref("/", locale) }, { label: t("common.data") }, { label: t("common.inflation") }]} coverage="" />
          <ExplorerHeading>{t("inflation.hubHeading")}</ExplorerHeading>
          <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{t("inflation.hubDescription")}</p>
          <BudgetHub cards={buildInflationHubCards(facts, presentation, categories, weights, cities.map(cityFactInput))} locale={locale} testId="inflation-hub" />
        </div>
      </main>
    </I18nProvider>
  );
}

export async function inflationOverviewMetadata(locale: Locale) {
  const [{ facts }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const years = facts.map((fact) => periodYear(periodFromKey(fact.period)));
  return fiscalMetadata({
    locale,
    path: OVERVIEW_PATH,
    title: message(messages, "inflation.metaTitle", { first: Math.min(...years), last: Math.max(...years) }),
    description: message(messages, "inflation.description"),
  });
}

export async function renderInflationOverview(locale: Locale) {
  const root = repositoryRoot();
  const [{ facts, targets }, presentation, manifest, catalogue] = await Promise.all([
    loadServedInflationData(),
    getPresentation(locale, ["inflation", "common", "controls", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.home"), path: pageHref("/", locale) },
          { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) },
          { name: t("inflation.heading"), path: pageHref(OVERVIEW_PATH, locale) },
        ]}
      />
      <InflationOverview
        facts={facts.map(projectCpiFact)}
        sourceIdBySeriesMeasure={sourceIdBySeriesMeasure(facts)}
        lastReviewedAt={facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? ""}
        targets={targets.map(projectInflationTarget)}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
    </I18nProvider>
  );
}

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
  const root = repositoryRoot();
  const [{ facts, categories, weights }, presentation, manifest, catalogue] = await Promise.all([
    loadServedInflationData(),
    getPresentation(locale, ["inflation", "common", "controls", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  // The stack closes on the published national headline, so it travels with the page.
  const headline = facts
    .filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct")
    .map((fact) => ({ period: periodFromKey(fact.period), value: fact.value }));
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.home"), path: pageHref("/", locale) },
          { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) },
          { name: t("inflation.categoriesHeading"), path: pageHref(CATEGORIES_PATH, locale) },
        ]}
      />
      <InflationCategories
        facts={packCategoryFacts(categories.map(categoryFactInput))}
        weights={weights.map(projectBasketWeight)}
        headline={headline}
        lastReviewedAt={categories.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? ""}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
    </I18nProvider>
  );
}

export async function inflationCitiesMetadata(locale: Locale) {
  const [{ cities }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const years = cities.map((fact) => periodYear(periodFromKey(fact.period)));
  return fiscalMetadata({
    locale,
    path: CITIES_PATH,
    title: message(messages, "inflation.citiesMetaTitle", { first: Math.min(...years), last: Math.max(...years) }),
    description: message(messages, "inflation.citiesDescription"),
  });
}

export async function renderInflationCities(locale: Locale) {
  const root = repositoryRoot();
  const [data, presentation, manifest, catalogue] = await Promise.all([
    loadServedInflationData(),
    getPresentation(locale, ["inflation", "common", "controls", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.home"), path: pageHref("/", locale) },
          { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) },
          { name: t("inflation.citiesHeading"), path: pageHref(CITIES_PATH, locale) },
        ]}
      />
      <InflationCities
        facts={packCityFacts([...georgiaCityLine(data), ...data.cities.map(cityFactInput)])}
        lastReviewedAt={data.cities.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? ""}
        sources={sources}
        siteOrigin={resolveSiteUrl()}
      />
    </I18nProvider>
  );
}
