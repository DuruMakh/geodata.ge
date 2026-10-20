import { EnvironmentExplorer } from "../../components/environment/environment-explorer";
import { EnvironmentRegionIndex } from "../../components/environment/environment-region-index";
import { environmentAreaCoverage, environmentAreaIndexHref, environmentAreaRoutes, environmentAreaSeries, type EnvironmentAreaTopic } from "../explorer/environmentAreas";
import { buildEnvironmentRegionMapModel } from "../explorer/environmentRegionMap";
import { formatInUnit } from "../explorer/format";
import { environmentValueUnit } from "../explorer/environment";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { fiscalMetadata } from "../seo/metadata";
import {
  ENVIRONMENT_AREA_LABEL_IDS, ENVIRONMENT_AREA_PAGES, environmentAreaForSlug, environmentAreaName, environmentAreaParent, environmentLabels, environmentLatest,
  environmentTranslate, loadEnvironmentPage, loadEnvironmentWorkbookSources, renderEnvironmentFrame,
} from "./environment-shared";

/** The measure a map page and its area pages lead with: waste collected or timber cut. */
const MEASURE: Record<EnvironmentAreaTopic, string> = { waste: "environment.waste.collected", forests: "environment.forest.timber_cut" };

export async function environmentRegionIndexMetadata(locale: Locale, topic: EnvironmentAreaTopic) {
  const messages = await getMessages(locale, ["environment"]);
  return fiscalMetadata({ locale, path: environmentAreaIndexHref(topic), title: message(messages, `environment.page.${topic}.metaTitle`), description: message(messages, `environment.page.${topic}.summary`) });
}

export async function environmentAreaPageMetadata(slug: string, locale: Locale, topic: EnvironmentAreaTopic) {
  const area = environmentAreaForSlug(slug), presentation = await getPresentation(locale, ["environment"], ENVIRONMENT_AREA_LABEL_IDS, ENVIRONMENT_AREA_LABEL_IDS);
  const name = environmentAreaName(presentation, area), t = environmentTranslate(presentation);
  return fiscalMetadata({ locale, path: environmentAreaRoutes(topic).areaHref(area), title: t(`page.area.${topic}.title`, { region: name }), description: t(`page.area.${topic}.summary`, { region: name }) });
}

/**
 * The Waste or Forests page: the regions' map and ranked list. The line is Georgia's figure: waste in million tonnes to two
 * decimals ("1.18 million tonnes"), timber in cubic metres.
 */
export async function renderEnvironmentRegionIndex(locale: Locale, topic: EnvironmentAreaTopic) {
  const page = await loadEnvironmentPage(locale, ["regionalEconomies", "format"], ENVIRONMENT_AREA_LABEL_IDS);
  const { presentation } = page, t = environmentTranslate(presentation);
  const facts = page.facts.filter(f => f.indicatorId.startsWith(`${MEASURE[topic]}.`));
  const regionMap = buildEnvironmentRegionMapModel(topic, facts);
  const georgia = facts.filter(f => f.indicatorId === `${MEASURE[topic]}.georgia`);
  const latest = environmentLatest(georgia, `${MEASURE[topic]}.georgia`, t);
  const value = topic === "waste" ? `${formatInUnit(latest.fact.value / 1000, environmentValueUnit(2))} ${t("unit.millionTonnes")}` : latest.value;
  const years = facts.map(f => f.year);
  const regional = facts.filter(f => f.indicatorId !== `${MEASURE[topic]}.georgia`);
  return renderEnvironmentFrame({
    ...page, href: environmentAreaIndexHref(topic), title: t(`page.${topic}.title`), description: t(`page.${topic}.summary`), firstYear: Math.min(...years), lastYear: Math.max(...years),
    measures: [t(`mapLabel.${topic}`)],
    children: <EnvironmentRegionIndex topic={topic} regionMap={regionMap} georgiaValue={georgia.find(f => f.year === regionMap.year)?.value} unit={latest.fact.unit}
      decimals={Math.max(...regional.map(f => f.decimals))} latest={{ measure: t(`latest.${topic}`), year: latest.year, value }} />,
  });
}

/** An area's page: Georgia's or a region's waste or forests list, with the area picker in its heading. */
export async function renderEnvironmentAreaPage(locale: Locale, topic: EnvironmentAreaTopic, slug: string) {
  const area = environmentAreaForSlug(slug);
  const [page, sources] = await Promise.all([loadEnvironmentPage(locale, ["regionalEconomies", "format", "main", "workbook"], ENVIRONMENT_AREA_LABEL_IDS), loadEnvironmentWorkbookSources(locale)]);
  const { presentation } = page, t = environmentTranslate(presentation);
  const series = environmentAreaSeries(topic, area, page.facts);
  const ids = new Set(series.map(item => item.id));
  const facts = page.facts.filter(f => ids.has(f.indicatorId));
  const { min: firstYear, max: lastYear } = environmentAreaCoverage(topic, area, facts);
  const name = environmentAreaName(presentation, area);
  const title = t(`page.area.${topic}.title`, { region: name });
  // The line is the list's first row: waste collected or timber cut (Tbilisi, with no timber figure, leads with illegal logging).
  const latest = environmentLatest(facts, series[0].id, t);
  const measure = series[0].id.includes(".illegal_logging.") ? t("latest.illegalLogging") : t(`latest.${topic}`);
  return renderEnvironmentFrame({
    ...page, href: environmentAreaRoutes(topic).areaHref(area), title, description: t(`page.area.${topic}.summary`, { region: name }), firstYear, lastYear,
    measures: [...new Set(series.map(item => t(`heading.${item.heading}`)))],
    parents: [environmentAreaParent(presentation, topic)], area: { name, withinGeorgia: area !== "georgia" },
    children: <EnvironmentExplorer key={`${topic}-${area}`} scope={{ kind: "area", topic, area }} facts={facts} labels={environmentLabels(presentation, [...ids])} sources={sources}
      lastReviewedAt={page.lastReviewedAt} siteOrigin={page.origin} title={title} areas={ENVIRONMENT_AREA_PAGES} latest={{ measure, year: latest.year, value: latest.value }} />,
  });
}
