import type { ClientTransportFact } from "../data/transport/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { coverageRange } from "./coverageLabel";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";
import { TRANSPORT_SECTIONS, transportCoverage, transportLatestValue, type TransportSectionId } from "./transport";
import { buildTransportRegionMapModel } from "./transportRegionMap";

/**
 * Each card's sparkline and figure follow its page's line: passenger cars, cars over 10 years old, passenger-km and tonne-km, in the
 * page's scale and with its measure as the caption, over the years the page covers. Regions has none, only the map's years.
 */
const HEADLINE: Record<Exclude<TransportSectionId, "regions">, string> = {
  vehicles: "transport.fleet.cars", "vehicle-age": "transport.fleet.cars_age_over_10", passengers: "transport.passenger_km.total", freight: "transport.tonne_km.total",
};

export function buildTransportHubCards(facts: readonly ClientTransportFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `transport.${key}`);
  return TRANSPORT_SECTIONS.map((section, index) => {
    const card = {
      index: String(index + 1).padStart(2, "0"), title: message(presentation.messages, section.labelKey), description: t(`page.${section.id}.summary`),
      href: section.href, comingSoon: false,
    };
    if (section.id === "regions") {
      const map = buildTransportRegionMapModel(facts);
      return { ...card, series: null, seriesColor: null, footer: `${map.firstYear}–${map.year}`, years: coverageRange(map.firstYear, map.year) };
    }
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const { min, max } = transportCoverage(section.id, facts);
    const value = transportLatestValue(last.value, section.id === "vehicles" || section.id === "vehicle-age" ? "million" : "billion", t);
    return {
      ...card, series: annualSeries(headline, min, max), seriesColor: INK, footer: `${last.year} · ${value} · ${min}–${max}`,
      latest: { value, period: String(last.year), caption: t(`latest.${section.id}`) }, years: coverageRange(min, max),
    };
  });
}
