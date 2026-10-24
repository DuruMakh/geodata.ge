import { ENVIRONMENT_CITIES, type ClientEnvironmentFact } from "../data/environment/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { ENVIRONMENT_SECTIONS, environmentDefaultSelection, environmentValueUnit, type EnvironmentSectionId } from "./environment";
import { environmentCityHeadline, environmentCityHref, environmentHighestPm10 } from "./environmentCities";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";

/** The series a card follows: its page's default (on Air pollution carbon monoxide, its first), the most polluted station, or Georgia's row of a map page. */
function headline(section: EnvironmentSectionId, facts: readonly ClientEnvironmentFact[]): string {
  switch (section) {
    case "air-quality": return environmentHighestPm10(facts).indicatorId;
    case "waste": return "environment.waste.collected.georgia";
    case "forests": return "environment.forest.timber_cut.georgia";
    default: return environmentDefaultSelection(section)[0];
  }
}

/** A card's sparkline over every year from the first to the last (a year without a value is a gap, never a zero) and its footer, the latest value as published. */
function card(seriesId: string, facts: readonly ClientEnvironmentFact[]): Pick<HubCardModel, "series" | "seriesColor" | "footer" | "latest" | "years"> {
  const own = facts.filter(f => f.indicatorId === seriesId);
  const valueByYear = new Map(own.map(f => [f.year, f.value]));
  const years = [...valueByYear.keys()].sort((a, b) => a - b);
  const first = years[0], last = years.at(-1)!;
  const decimals = Math.max(...own.map(f => f.decimals));
  const value = formatInUnit(valueByYear.get(last)!, environmentValueUnit(decimals));
  return {
    series: Array.from({ length: last - first + 1 }, (_, offset) => valueByYear.get(first + offset) ?? null), seriesColor: INK,
    footer: `${last} · ${value} · ${first}–${last}`, latest: { value, period: String(last) }, years: coverageRange(first, last),
  };
}

export function buildEnvironmentHubCards(facts: readonly ClientEnvironmentFact[], presentation: Presentation): HubCardModel[] {
  return ENVIRONMENT_SECTIONS.map((section, index) => ({
    index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey),
    description: message(presentation.messages, `environment.page.${section.id}.summary`), href: section.href, comingSoon: false,
    ...card(headline(section.id, facts), facts),
  }));
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
