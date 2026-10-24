import type { ClientHousingFact } from "../data/housing/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { HOUSING_SECTIONS, type HousingSectionId } from "./housing";
import { buildHousingRegionMapModel } from "./housingRegionMap";

/** Each card's sparkline and footer years follow one series: all permits, all completed buildings and the price index. Regions has none, only the map's years. */
const HEADLINE: Record<Exclude<HousingSectionId, "regions">, string> = {
  permits: "housing.permits_count.total", completed: "housing.completed_count.total", prices: "housing.price_index.total",
};

export function buildHousingHubCards(facts: readonly ClientHousingFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `housing.${key}`);
  return HOUSING_SECTIONS.map((section, index) => {
    const card = {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
    };
    if (section.id === "regions") {
      const map = buildHousingRegionMapModel(facts);
      return { ...card, series: null, seriesColor: null, footer: `${map.firstYear}–${map.year}`, years: coverageRange(map.firstYear, map.year) };
    }
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const value = formatInUnit(last.value, { divisor: 1, label: "", decimals: last.decimals });
    return {
      ...card, series: headline.map(f => f.value), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}`,
      latest: { value, period: String(last.year) }, years: coverageRange(headline[0].year, last.year),
    };
  });
}
