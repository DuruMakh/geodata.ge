import { TransportIndex } from "../../components/transport/transport-index";
import { toClientTransportFact } from "../data/transport/importTransport";
import type { TransportFact } from "../data/transport/types";
import { buildTransportRegionMapModel } from "../explorer/transportRegionMap";
import type { RegionMapModel } from "../explorer/regionalEconomyMap";
import type { Locale } from "../i18n/types";
import { renderTransportRegionsFrame } from "./transport-shared";

/** The Regions index: the map and list whose rows open the area pages. The map is built here; the page receives only Georgia's registered vehicles. */
export function renderTransportRegionsPage(locale: Locale) {
  let map: RegionMapModel | undefined;
  const regionMap = (facts: TransportFact[]) => map ??= buildTransportRegionMapModel(facts.map(toClientTransportFact));
  return renderTransportRegionsFrame(locale, undefined, facts => { const model = regionMap(facts); return [model.firstYear, model.year]; }, ({ facts }) =>
    <TransportIndex facts={facts.map(toClientTransportFact).filter(f => f.indicatorId === "transport.registered.total")} regionMap={regionMap(facts)} />);
}
