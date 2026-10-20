import type { ClientTransportFact } from "../data/transport/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { formatInUnit } from "./format";
import type { HubCardModel } from "./hubCards";
import { TRANSPORT_SECTIONS, type TransportSectionId } from "./transport";
import { buildTransportRegionMapModel } from "./transportRegionMap";

/** Each card's sparkline and footer years follow one series: passenger cars, cars over 10 years old, passenger-km and tonne-km. Regions has none, only the map's years. */
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
      return { ...card, series: null, seriesColor: null, footer: `${map.firstYear}–${map.year}` };
    }
    const headline = facts.filter(f => f.indicatorId === HEADLINE[section.id]).sort((a, b) => a.year - b.year);
    const last = headline.at(-1)!;
    const value = formatInUnit(last.value, { divisor: 1, label: "", decimals: last.decimals });
    return { ...card, series: headline.map(f => f.value), seriesColor: INK, footer: `${last.year} · ${value} · ${headline[0].year}–${last.year}` };
  });
}
