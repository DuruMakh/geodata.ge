import { toClientTransportFact } from "../data/transport/importTransport";
import type { ClientTransportFact, TransportFact } from "../data/transport/types";
import { message } from "../i18n/messages";
import type { Messages, Presentation } from "../i18n/types";
import { transportTopicSeries, type TransportTopicId } from "./transport";
import { transportAreaSeries, type TransportArea } from "./transportAreas";

/*
 * What the Transport pages hand their explorers: the observations a page shows and its series' names. Shared by the pages
 * (lib/pages/transport.tsx, transport-area.tsx) and the MCP snapshot build (lib/factQuery/topics/transport.ts), which
 * cannot import the pages (they pull in `server-only` and React).
 */

/**
 * Display names for every series a topic page can show: vehicle types, fuels and age bands, transport modes, or what
 * carried passengers and goods. Names carry no prefix: the heading they sit under names their measure and unit.
 */
export function transportLabels(presentation: Presentation, section: TransportTopicId): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `transport.${key}`);
  return Object.fromEntries(transportTopicSeries(section).map(({ id }) => {
    const [, measure, group] = id.split(".");
    if (measure === "fleet") {
      const [, kind, part] = /^[a-z]+_(fuel|age)_(.+)$/.exec(group) ?? [];
      return [id, kind ? t(`series.${kind}.${part}`) : t(`series.type.${group}`)];
    }
    if (measure === "passengers" || measure === "freight_tonnes") return [id, t(`series.carried.${measure === "freight_tonnes" && group === "airports" ? "airports_freight" : group}`)];
    return [id, t(`series.mode.${group}`)];
  }));
}

/** The observations a topic page's list can show. */
export function transportPageFacts(facts: readonly TransportFact[], section: TransportTopicId): ClientTransportFact[] {
  const ids = new Set<string>(transportTopicSeries(section).map(series => series.id));
  return facts.map(toClientTransportFact).filter(f => ids.has(f.indicatorId));
}

/** The observations an area page's list shows. */
export function transportAreaFacts(facts: readonly TransportFact[], area: TransportArea): ClientTransportFact[] {
  const ids = new Set<string>(transportAreaSeries(area).map(item => item.id));
  return facts.map(toClientTransportFact).filter(f => ids.has(f.indicatorId));
}

/** An area page's row names: a row is named by its column alone (a vehicle type, fuel, age band, owner or road type); its heading names the measure and unit, and the area is the page's own. */
export function transportAreaSeriesLabels(messages: Messages, area: TransportArea): Record<string, string> {
  const prefix = area === "georgia" ? "total" : area;
  return Object.fromEntries(transportAreaSeries(area).map(({ id, heading }) => {
    const part = id.split(".")[2].slice(prefix.length + 1);
    const key = heading === "roads" ? `road.${part || "total"}` : !part ? "registered.total" : heading === "registered" ? `type.${part}`
      : heading === "fuel" ? `fuel.${part.slice("fuel_".length)}` : heading === "age" ? `areaAge.${part.slice("age_".length)}` : `owner.${part.slice("owner_".length)}`;
    return [id, message(messages, `transport.series.${key}`)];
  }));
}
