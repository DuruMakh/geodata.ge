import { notFound } from "next/navigation";
import { InflationCities } from "../../components/inflation/inflation-cities";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { periodFromKey, periodYear } from "../data/inflation/periods";
import { CITY_FIRST_PERIOD, CPI_CITY_IDS, cityFactInput, type CityFactInput, type CpiCityId, type CpiCityMeasure } from "../data/inflation/types";
import { GEORGIA_LINE_ID, packCityFacts } from "../explorer/inflationCities";
import { CITIES_PATH, GEORGIA_VIEW, cityIdForSlug, cityPageHref, citySlug, type CityView } from "../explorer/inflationCityRoutes";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { clientPresentation, getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";
import { INFLATION_HUB_PATH, inflationRepositoryRoot, inflationWorkbookSources } from "./inflation-shared";

/** Pages carry the annual rate in full; the 12-month average only feeds the table and workbook summary column, which reads December alone. */
const isPageFact = (fact: { measure: string; period: string }) => fact.measure === "yoy_pct" || (fact.measure === "avg12_pct" && fact.period.endsWith("-12"));

/** Georgia's total for the Georgia page: the national annual rate and 12-month average from 2016, never copied into the city CSV. */
function georgiaTotals(data: Awaited<ReturnType<typeof loadServedInflationData>>): CityFactInput[] {
  return data.facts
    .filter((fact) => fact.seriesId === "cpi.headline" && isPageFact(fact) && fact.period >= CITY_FIRST_PERIOD)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: "cpi.headline", measure: fact.measure as CpiCityMeasure, period: fact.period, value: fact.value }));
}

/** Georgia's total and division rates in one month: a city page compares against them in its indicators only. */
function georgiaRatesAt(data: Awaited<ReturnType<typeof loadServedInflationData>>, period: string): CityFactInput[] {
  const total = data.facts
    .filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === period)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: "cpi.headline", measure: "yoy_pct" as const, period, value: fact.value }));
  const divisions = data.categories
    .filter((fact) => fact.level === 2 && fact.measure === "yoy_pct" && fact.period === period)
    .map((fact) => ({ lineId: GEORGIA_LINE_ID, seriesId: fact.categoryId, measure: "yoy_pct" as const, period, value: fact.value }));
  return [...total, ...divisions];
}

function cityForSlug(slug: string): CpiCityId {
  const cityId = cityIdForSlug(slug);
  if (!cityId) notFound();
  return cityId;
}

export function inflationCityStaticParams() {
  return CPI_CITY_IDS.map((cityId) => ({ city: citySlug(cityId) }));
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

async function renderCitiesView(locale: Locale, view: CityView, facts: CityFactInput[], lastReviewedAt: string) {
  const root = inflationRepositoryRoot();
  const [presentation, manifest, catalogue] = await Promise.all([
    getPresentation(locale, ["inflation", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const sources = inflationWorkbookSources(manifest, locale, catalogue.documents);
  const t = (key: string) => message(presentation.messages, key);
  const crumbs = [
    { name: t("common.home"), path: pageHref("/", locale) },
    { name: t("common.inflation"), path: pageHref(INFLATION_HUB_PATH, locale) },
    { name: t("inflation.citiesHeading"), path: pageHref(CITIES_PATH, locale) },
    ...(view.kind === "city" ? [{ name: t(`inflation.city.${view.cityId}`), path: pageHref(cityPageHref(view.cityId), locale) }] : []),
  ];
  return (
    <I18nProvider {...clientPresentation(presentation)}>
      <BreadcrumbJsonLd items={crumbs} />
      <InflationCities view={view} facts={packCityFacts(facts)} lastReviewedAt={lastReviewedAt} sources={sources} siteOrigin={resolveSiteUrl()} />
    </I18nProvider>
  );
}

export async function renderInflationCities(locale: Locale) {
  const data = await loadServedInflationData();
  const facts = [...georgiaTotals(data), ...data.cities.filter((fact) => fact.seriesId === "cpi.headline" && isPageFact(fact)).map(cityFactInput)];
  return renderCitiesView(locale, GEORGIA_VIEW, facts, data.cities.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "");
}

export async function inflationCityPageMetadata(slug: string, locale: Locale) {
  const cityId = cityForSlug(slug);
  const [{ cities }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const years = cities.filter((fact) => fact.cityId === cityId && fact.measure === "yoy_pct").map((fact) => periodYear(periodFromKey(fact.period)));
  const city = message(messages, `inflation.city.${cityId}`);
  return fiscalMetadata({
    locale,
    path: cityPageHref(cityId),
    title: message(messages, "inflation.cityPageMetaTitle", { city, first: Math.min(...years), last: Math.max(...years) }),
    description: message(messages, "inflation.cityPageDescription", { city }),
  });
}

export async function renderInflationCityPage(slug: string, locale: Locale) {
  const cityId = cityForSlug(slug);
  const data = await loadServedInflationData();
  const own = data.cities.filter((fact) => fact.cityId === cityId && isPageFact(fact));
  // The indicators rank divisions in their latest month, so Georgia is shipped for that month.
  const latest = own.filter((fact) => fact.measure === "yoy_pct" && fact.seriesId !== "cpi.headline").map((fact) => fact.period).sort().at(-1)!;
  const facts = [...own.map(cityFactInput), ...georgiaRatesAt(data, latest)];
  return renderCitiesView(locale, { kind: "city", cityId }, facts, own.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "");
}
