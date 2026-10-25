import { ENVIRONMENT_CITIES, type ClientEnvironmentFact } from "../data/environment/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { ENVIRONMENT_LATEST_ID, ENVIRONMENT_SECTIONS, environmentCoverage, environmentValueLabel, environmentValueUnit, type EnvironmentSectionId, type EnvironmentTopicId } from "./environment";
import { environmentCityHeadline, environmentCityHref, environmentHighestPm10 } from "./environmentCities";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";
import type { CardLatest } from "./topicHub";

/** What a group page card states, as its page's line does: the figure in the page's unit and the line's measure. */
type Line = Pick<CardLatest, "value" | "caption">;

/**
 * A card's sparkline over every year from the first to the last (a year without a value is a gap, never a zero), by default its
 * series' own years, and its footer. Given its page's line (`line`) and years (`years`), the card states that line's figure and
 * measure and the page's years; without them it states the latest value as published (the City air quality page's city cards).
 */
function card(seriesId: string, facts: readonly ClientEnvironmentFact[], line?: Line, years?: { first: number; last: number }): Pick<HubCardModel, "series" | "seriesColor" | "footer" | "latest" | "years"> {
  const own = facts.filter(f => f.indicatorId === seriesId);
  const ownYears = own.map(f => f.year);
  const first = years?.first ?? Math.min(...ownYears), last = years?.last ?? Math.max(...ownYears), latestYear = Math.max(...ownYears);
  const decimals = Math.max(...own.map(f => f.decimals));
  const value = line?.value ?? formatInUnit(own.find(f => f.year === latestYear)!.value, environmentValueUnit(decimals));
  return {
    series: annualSeries(own, first, last), seriesColor: INK,
    footer: `${latestYear} · ${value} · ${first}–${last}`, latest: { value, period: String(latestYear), ...(line?.caption ? { caption: line.caption } : {}) }, years: coverageRange(first, last),
  };
}

/** The first and last year of the facts whose series starts with `prefix`: an area page family's years, every area's rows. */
function yearsOf(facts: readonly ClientEnvironmentFact[], prefix: string): { first: number; last: number } {
  const years = facts.filter(f => f.indicatorId.startsWith(prefix)).map(f => f.year);
  return { first: Math.min(...years), last: Math.max(...years) };
}

/**
 * Each card follows its page's line under the heading: the national pages' line series (on Water the share lost in pipes), the
 * station with the highest PM10 average, and Georgia's waste collected and timber cut, with the page's measure as the caption
 * (unless the card's title already says it) and the years the page covers.
 */
export function buildEnvironmentHubCards(facts: readonly ClientEnvironmentFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string, values?: Record<string, string | number>) => message(presentation.messages, `environment.${key}`, values);
  const valueOf = (seriesId: string, rows: readonly ClientEnvironmentFact[] = facts) => {
    const fact = rows.filter(f => f.indicatorId === seriesId).sort((a, b) => a.year - b.year).at(-1)!;
    return { fact, value: environmentValueLabel(fact.value, fact.unit, fact.decimals, t) };
  };
  const source = (section: EnvironmentSectionId): { seriesId: string; line: Line; years: { first: number; last: number } } => {
    switch (section) {
      case "air-quality": {
        const aq = facts.filter(f => f.indicatorId.startsWith("environment.aq."));
        const highest = environmentHighestPm10(aq);
        return { seriesId: highest.indicatorId, line: { value: valueOf(highest.indicatorId, aq.filter(f => f.year <= highest.year)).value, caption: `${t(`city.${highest.city}`)}, ${t("latest.pm10")}` }, years: yearsOf(facts, "environment.aq.") };
      }
      case "waste": {
        const { fact } = valueOf("environment.waste.collected.georgia");
        return { seriesId: fact.indicatorId, line: { value: `${formatInUnit(fact.value / 1000, environmentValueUnit(2))} ${t("unit.millionTonnes")}`, caption: t("latest.waste") }, years: yearsOf(facts, "environment.waste.collected.") };
      }
      case "forests":
        return { seriesId: "environment.forest.timber_cut.georgia", line: { value: valueOf("environment.forest.timber_cut.georgia").value, caption: t("latest.forests") }, years: yearsOf(facts, "environment.forest.timber_cut.") };
      default: {
        const topic: EnvironmentTopicId = section;
        const { min, max } = environmentCoverage(topic, facts);
        return { seriesId: ENVIRONMENT_LATEST_ID[topic], line: { value: valueOf(ENVIRONMENT_LATEST_ID[topic]).value, caption: topic === "climate" ? t("series.climate.georgia") : t(`latest.${topic}`) }, years: { first: min, last: max } };
      }
    }
  };
  return ENVIRONMENT_SECTIONS.map((section, index) => {
    const title = message(presentation.messages, section.labelKey);
    const { seriesId, line, years } = source(section.id);
    return {
      index: String(index + 1).padStart(2, "0"), title, description: message(presentation.messages, `environment.page.${section.id}.summary`), href: section.href, comingSoon: false,
      ...card(seriesId, facts, { value: line.value, ...(line.caption && line.caption !== title ? { caption: line.caption } : {}) }, years),
    };
  });
}

/** The City air quality index: one card per city, following its first station's PM10 (Zestaponi's dust), opening the city's page. */
export function buildEnvironmentCityCards(facts: readonly ClientEnvironmentFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `environment.${key}`);
  return ENVIRONMENT_CITIES.map((city, index) => ({
    index: String(index + 1).padStart(2, "0"), title: t(`city.${city}`),
    description: `${t(`station.${environmentCityHeadline(city).split(".")[3]}`)} · ${city === "zestaponi" ? t("latest.tsp") : t("latest.pm10")}`,
    href: environmentCityHref(city), comingSoon: false, ...card(environmentCityHeadline(city), facts),
  }));
}
