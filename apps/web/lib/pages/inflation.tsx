import path from "node:path";
import { BudgetHub } from "../../components/hub/budget-hub";
import { InflationCategories } from "../../components/inflation/inflation-categories";
import { InflationOverview } from "../../components/inflation/inflation-overview";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { periodFromKey, periodYear } from "../data/inflation/periods";
import { categoryFactInput } from "../data/inflation/types";
import { packCategoryFacts } from "../explorer/inflationCategories";
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
const repositoryRoot = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");

export async function inflationHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["inflation"]);
  return fiscalMetadata({ locale, path: HUB_PATH, title: message(messages, "inflation.hubMetaTitle"), description: message(messages, "inflation.hubDescription") });
}

export async function renderInflationHub(locale: Locale) {
  const [{ facts, categories, weights }, presentation] = await Promise.all([loadServedInflationData(), getPresentation(locale, ["inflation", "common"], [])]);
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={[{ name: t("common.home"), path: pageHref("/", locale) }, { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) }]} />
      <main className="px-5 pb-16 min-[768px]:px-[34px]">
        <div className="mx-auto max-w-[1180px]">
          <PageHeader crumbs={[{ label: t("common.home"), href: pageHref("/", locale) }, { label: t("common.data") }, { label: t("common.inflation") }]} coverage="" />
          <ExplorerHeading>{t("inflation.hubHeading")}</ExplorerHeading>
          <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{t("inflation.hubDescription")}</p>
          <BudgetHub cards={buildInflationHubCards(facts, presentation, categories, weights)} locale={locale} testId="inflation-hub" />
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
  const projected = projectPublicSources(manifest, locale, catalogue.documents);
  // Archive rows ending in "_ka" are the Georgian twins of the English source files.
  const sources: InflationWorkbookSource[] = manifest.map((row) => {
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
  const projected = projectPublicSources(manifest, locale, catalogue.documents);
  const sources: InflationWorkbookSource[] = manifest.map((row) => {
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
