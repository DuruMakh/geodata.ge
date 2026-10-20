import { EnvironmentExplorer } from "../../components/environment/environment-explorer";
import { ENVIRONMENT_SECTIONS, environmentCoverage, environmentTopicSeries, type EnvironmentTopicId } from "../explorer/environment";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { environmentLabels, environmentLatest, environmentTranslate, loadEnvironmentPage, loadEnvironmentWorkbookSources, renderEnvironmentFrame } from "./environment-shared";

const hrefOf = (section: EnvironmentTopicId) => ENVIRONMENT_SECTIONS.find(item => item.id === section)!.href;

export async function environmentPageMetadata(locale: Locale, section: EnvironmentTopicId) {
  const messages = await getMessages(locale, ["environment"]);
  return fiscalMetadata({ locale, path: hrefOf(section), title: message(messages, `environment.page.${section}.metaTitle`), description: message(messages, `environment.page.${section}.summary`) });
}

/** The series whose latest figure is the line under each page's heading. */
const LATEST_ID: Record<EnvironmentTopicId, string> = {
  "greenhouse-gases": "environment.ghg.total", "air-pollution": "environment.air.co.total",
  climate: "environment.climate.temperature.georgia", water: "environment.water.lost_share",
};

/** A national page: Greenhouse gases, Air pollution, Temperature and rain or Water. */
export async function renderEnvironmentPage(locale: Locale, section: EnvironmentTopicId) {
  const [page, sources] = await Promise.all([loadEnvironmentPage(locale, ["format", "main", "workbook"]), loadEnvironmentWorkbookSources(locale)]);
  const { presentation } = page;
  const series = environmentTopicSeries(section);
  // Each page receives only the observations its list can show.
  const ids = new Set(series.map(item => item.id));
  const facts = page.facts.filter(f => ids.has(f.indicatorId));
  const { min: firstYear, max: lastYear } = environmentCoverage(section, facts);
  const t = environmentTranslate(presentation);
  const title = t(`page.${section}.title`);
  const latest = environmentLatest(facts, LATEST_ID[section], t);
  // Temperature and rain names its place and adds the year's difference from the 1961–1990 average.
  const anomaly = section === "climate" ? facts.find(f => f.indicatorId === "environment.climate.temperature_anomaly.georgia" && f.year === latest.year) : undefined;
  const signed = anomaly && `${anomaly.value > 0 ? "+" : ""}${environmentLatest([anomaly], anomaly.indicatorId, t).value}`;
  const line = {
    measure: section === "climate" ? t("series.climate.georgia") : t(`latest.${section}`), year: latest.year, value: latest.value,
    note: signed ? t("latest.anomaly", { value: signed }) : undefined,
  };
  return renderEnvironmentFrame({
    ...page, href: hrefOf(section), title, description: t(`page.${section}.summary`), firstYear, lastYear,
    measures: [...new Set(series.map(item => t(`heading.${item.heading}`)))],
    children: <EnvironmentExplorer key={section} scope={{ kind: "topic", section }} facts={facts} labels={environmentLabels(presentation, [...ids])} sources={sources}
      lastReviewedAt={page.lastReviewedAt} siteOrigin={page.origin} title={title} latest={line} />,
  });
}
