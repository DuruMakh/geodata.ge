import { TRANSPORT_REGIONS, TRANSPORT_ROAD_PARTS, TRANSPORT_ZERO_ROWS, transportIndicator, type ClientTransportFact } from "../data/transport/types";
import { TRANSPORT_SECTIONS, buildTransportSeriesModel, changeTransportSelection, parseTransportListHash, transportListCoverage, type TransportModel, type TransportSeriesDefinition } from "./transport";
import { areaRoutes } from "./areaRoutes";
import type { TopicState } from "./topicSeries";

/** The areas with a page: Georgia, then the eleven regions. Abkhazia and "region unknown" are served but have no page. */
export const TRANSPORT_AREAS = ["georgia", ...TRANSPORT_REGIONS] as const;
export type TransportArea = typeof TRANSPORT_AREAS[number];
/** The Regions index, whose map and list open the area pages. */
export const TRANSPORT_REGIONS_HREF = TRANSPORT_SECTIONS.find(section => section.id === "regions")!.href;
/** An area's slug and URL, its id on the shared region map and picker, the area of such an id and that area's page (`areaRoutes.ts`). */
export const { areaSlug: transportAreaSlug, areaHref: transportAreaHref, mapId: transportMapId, areaOfMapId: transportAreaOfMapId, regionHref: transportRegionHref } = areaRoutes<TransportArea>(TRANSPORT_REGIONS_HREF);

/** Georgia's page shows the Georgia rows (`total`) of the regional tables, a region's page its own. */
const groupOf = (area: TransportArea) => area === "georgia" ? "total" : area;

/** The registered-vehicles columns an area page lists under each heading; the three tiny columns stay unlisted (spec §8). */
const AREA_ROWS = [
  { heading: "registered", parts: ["", "cars", "buses", "trucks", "special"] },
  { heading: "fuel", parts: ["petrol", "petrol_gas", "diesel", "gas", "electric", "hybrid", "hybrid_gas", "unknown"].map(fuel => `fuel_${fuel}`) },
  { heading: "age", parts: ["0_2", "2_5", "5_10", "over_10", "unknown"].map(age => `age_${age}`) },
  { heading: "owner", parts: ["owner_companies", "owner_individuals"] },
] as const;

/**
 * An area's list: registered vehicles by type, fuel, age and owner (all motor vehicles the ink reference), then its roads (all
 * roads the reference), without a road row that is 0 in every year (`TRANSPORT_ZERO_ROWS`).
 */
export function transportAreaSeries(area: TransportArea): TransportSeriesDefinition[] {
  const group = groupOf(area);
  return [
    ...AREA_ROWS.flatMap(({ heading, parts }) => parts.map(part => ({ id: transportIndicator("registered", part ? `${group}_${part}` : group), reference: part === "", heading }))),
    ...["", ...TRANSPORT_ROAD_PARTS].map(part => ({ id: transportIndicator("road_km", part ? `${group}_${part}` : group), reference: part === "", heading: "roads" as const })),
  ].filter(row => !TRANSPORT_ZERO_ROWS.includes(row.id));
}

export const transportAreaDefaultSelection = (area: TransportArea): string[] => [transportAreaSeries(area)[0].id];

/** An area page's view; the area is the page's own and is not part of it. */
export type TransportAreaState = TopicState;

/** An area's years for a selection (any of the area's series when nothing is selected). */
export const transportAreaCoverage = (area: TransportArea, facts: readonly ClientTransportFact[], selectedIds: readonly string[] = []) =>
  transportListCoverage(transportAreaSeries(area), selectedIds, facts);

/** Reads the view of the page for `area`: its selection, kept to one unit, and the years. */
export const parseTransportAreaHash = (hash: string, area: TransportArea, facts: readonly ClientTransportFact[]): TransportAreaState =>
  parseTransportListHash(hash, transportAreaSeries(area), transportAreaDefaultSelection(area), facts);

export const changeTransportAreaSelection = (area: TransportArea, state: TransportAreaState, next: readonly string[], facts: readonly ClientTransportFact[]): TransportAreaState =>
  changeTransportSelection(state, transportAreaSeries(area), next, facts);

/** The area part of a listed id's group (`total` or `region_<id>`), longest first so `region_kvemo_kartli` is never read as a shorter id. */
const AREA_GROUPS = ["total", ...TRANSPORT_REGIONS].sort((a, b) => b.length - a.length);

/**
 * The hash a link to another area's page carries: this page's selection, moved to that area (a fuel row stays that fuel,
 * a road row that road type, between Georgia and a region alike). The default selection carries none.
 */
export function transportAreaSelectionHash(selectedIds: readonly string[], area: TransportArea): string {
  const moved = selectedIds.map(id => {
    const [prefix, measure, group] = id.split(".");
    const from = AREA_GROUPS.find(candidate => group === candidate || group.startsWith(`${candidate}_`))!;
    return `${prefix}.${measure}.${groupOf(area)}${group.slice(from.length)}`;
  });
  return moved.join(",") === transportAreaDefaultSelection(area).join(",") ? "" : `#${new URLSearchParams({ sel: moved.join(",") })}`;
}

/** The latest-value line's figure: the area's own registered vehicles in their latest year, whatever is chosen below. */
export function transportAreaLatest(area: TransportArea, facts: readonly ClientTransportFact[]): ClientTransportFact {
  const registeredId = transportAreaSeries(area)[0].id;
  return facts.filter(f => f.indicatorId === registeredId).sort((a, b) => a.year - b.year).at(-1)!;
}

export const buildTransportAreaModel = (area: TransportArea, facts: readonly ClientTransportFact[], state: TransportAreaState): TransportModel =>
  buildTransportSeriesModel(transportAreaSeries(area), facts, state);
