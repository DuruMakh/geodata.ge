import type { ClientHousingFact } from "../data/housing/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { GEORGIA_PLACE_ID } from "./demographyAreas";
import { formatInUnit } from "./format";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { HOUSING_SECTIONS, housingCount, housingCoverage, housingValueUnit, type HousingSectionId } from "./housing";
import { buildHousingRegionMapModel } from "./housingRegionMap";
import type { PlaceEntry } from "./places/types";
import { annualSeries } from "./sparkline";

/** Each card's sparkline and footer years follow one series: all permits, all completed buildings and the price index. Regions has none, only the map's years. */
const HEADLINE: Record<Exclude<HousingSectionId, "regions">, string> = {
  permits: "housing.permits_count.total", completed: "housing.completed_count.total", prices: "housing.price_index.total",
};

/**
 * Each card states its page's line: the figure in the page's format, and on Home prices the index's name and the quarter it reads
 * (`2025 Q4`), over the years the page covers. The Regions card spreads the measure its page maps, floor area permitted in thousand
 * m², with Georgia's own floor area, rather than the permit counts its region pages lead with.
 */
export function buildHousingHubCards(facts: readonly ClientHousingFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string, values?: Record<string, string | number>) => message(presentation.messages, `housing.${key}`, values);
  return HOUSING_SECTIONS.map((section, index) => {
    const card = {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
    };
    if (section.id === "regions") {
      const map = buildHousingRegionMapModel(facts);
      const area = (value: number) => `${formatInUnit(value, housingValueUnit("area"))} ${t("unitThousandSquareMetres")}`;
      const georgia = facts.find(f => f.indicatorId === "housing.permits_area.total" && f.year === map.year);
      const entry = (placeId: string, value: number): PlaceEntry => ({ placeId, page: section.href, href: section.href, value: area(value), number: value, period: String(map.year) });
      const spreadEntries = [
        ...map.regions.map(region => entry(region.regionId.startsWith("region.") ? region.regionId : `region.${region.regionId}`, region.value)),
        ...(georgia ? [entry(GEORGIA_PLACE_ID, georgia.value)] : []),
      ];
      return { ...card, series: null, seriesColor: null, footer: `${map.firstYear}–${map.year}`, years: coverageRange(map.firstYear, map.year), spreadEntries };
    }
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const { min, max } = housingCoverage(section.id, facts);
    const prices = section.id === "prices";
    const value = prices ? formatInUnit(last.value, housingValueUnit("index")) : housingCount(last.value);
    return {
      ...card, series: annualSeries(headline, min, max), seriesColor: INK, footer: `${last.year} · ${value} · ${min}–${max}`,
      latest: { value, period: prices ? t("latestPeriod.prices", { year: last.year }) : String(last.year), ...(prices ? { caption: t("latest.prices") } : {}) },
      years: coverageRange(min, max),
    };
  });
}
