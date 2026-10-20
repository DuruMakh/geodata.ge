import { EnvironmentCityIndex } from "../../components/environment/environment-city-index";
import { EnvironmentExplorer } from "../../components/environment/environment-explorer";
import { BudgetHub } from "../../components/hub/budget-hub";
import { ENVIRONMENT_STATIONS } from "../data/environment/types";
import { buildEnvironmentCityCards } from "../explorer/environmentHubCards";
import { AIR_QUALITY_PATH, environmentCityCoverage, environmentCityHeadline, environmentCityHref, environmentCitySeries, environmentHighestPm10 } from "../explorer/environmentCities";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import {
  environmentCityForSlugOrNotFound, environmentLabels, environmentLatest, environmentTranslate, loadEnvironmentPage, loadEnvironmentWorkbookSources, renderEnvironmentFrame,
} from "./environment-shared";

export async function environmentAirQualityMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["environment"]);
  return fiscalMetadata({ locale, path: AIR_QUALITY_PATH, title: message(messages, "environment.page.air-quality.metaTitle"), description: message(messages, "environment.page.air-quality.summary") });
}

export async function environmentCityMetadata(slug: string, locale: Locale) {
  const city = environmentCityForSlugOrNotFound(slug), messages = await getMessages(locale, ["environment"]);
  const name = message(messages, `environment.city.${city}`);
  return fiscalMetadata({ locale, path: environmentCityHref(city), title: message(messages, "environment.page.city.title", { city: name }), description: message(messages, city === "zestaponi" ? "environment.page.city.summaryZestaponi" : "environment.page.city.summary", { city: name }) });
}

/** City air quality: nine city cards; the line names the station with the highest PM10 average in the latest year. */
export async function renderEnvironmentAirQualityIndex(locale: Locale) {
  const page = await loadEnvironmentPage(locale);
  const { presentation } = page, t = environmentTranslate(presentation);
  const aq = page.facts.filter(f => f.indicatorId.startsWith("environment.aq."));
  const years = aq.map(f => f.year);
  const highest = environmentHighestPm10(aq);
  const latest = environmentLatest(aq.filter(f => f.year <= highest.year), highest.indicatorId, t);
  return renderEnvironmentFrame({
    ...page, href: AIR_QUALITY_PATH, title: t("page.air-quality.title"), description: t("page.air-quality.summary"), firstYear: Math.min(...years), lastYear: Math.max(...years),
    measures: [t("heading.pm10Avg")],
    children: <EnvironmentCityIndex latest={{ measure: `${t(`city.${highest.city}`)}, ${t("latest.pm10")}`, year: latest.year, value: latest.value }}>
      <BudgetHub cards={buildEnvironmentCityCards(aq, presentation)} locale={locale} testId="environment-city-cards" />
    </EnvironmentCityIndex>,
  });
}

/** A city's page: its stations' yearly averages against the yearly limits, and the days over the daily PM10 limit. */
export async function renderEnvironmentCityPage(locale: Locale, slug: string) {
  const city = environmentCityForSlugOrNotFound(slug);
  const [page, sources] = await Promise.all([loadEnvironmentPage(locale, ["format", "main", "workbook"]), loadEnvironmentWorkbookSources(locale)]);
  const { presentation } = page, t = environmentTranslate(presentation);
  const series = environmentCitySeries(city, page.facts);
  const ids = new Set(series.map(item => item.id));
  const facts = page.facts.filter(f => ids.has(f.indicatorId));
  const { min: firstYear, max: lastYear } = environmentCityCoverage(city, facts);
  const name = t(`city.${city}`);
  const title = t("page.city.title", { city: name });
  // The line follows the city's first station: its PM10 average, Zestaponi's dust.
  const headline = environmentCityHeadline(city);
  const station = ENVIRONMENT_STATIONS.find(item => item.id === headline.split(".")[3])!;
  const latest = environmentLatest(facts, headline, t);
  return renderEnvironmentFrame({
    ...page, href: environmentCityHref(city), title, description: t(city === "zestaponi" ? "page.city.summaryZestaponi" : "page.city.summary", { city: name }), firstYear, lastYear,
    measures: [...new Set(series.map(item => t(`heading.${item.heading}`)))],
    parents: [{ label: t("page.air-quality.title"), href: AIR_QUALITY_PATH, description: t("page.air-quality.summary") }], area: { name, withinGeorgia: true },
    children: <EnvironmentExplorer key={city} scope={{ kind: "city", city }} facts={facts} labels={environmentLabels(presentation, [...ids])} sources={sources}
      lastReviewedAt={page.lastReviewedAt} siteOrigin={page.origin} title={title}
      latest={{ measure: `${t(`station.${station.id}`)}, ${t(city === "zestaponi" ? "latest.tsp" : "latest.pm10")}`, year: latest.year, value: latest.value }} />,
  });
}
