import { BUSINESS_REGIONS, businessIndicator, type BusinessMeasure, type ClientBusinessFact } from "../data/business/types";
import { areaRoutes } from "./areaRoutes";
import { BUSINESS_SECTIONS, buildBusinessSeriesModel, businessListCoverage, parseBusinessListHash, type BusinessModel, type BusinessSeriesDefinition } from "./business";
import type { TopicState } from "./topicSeries";

/** The areas with a page: Georgia, then the eleven regions. Abkhazeti AR and the unknown region are part of the firms total but have no page. */
export const BUSINESS_AREAS = ["georgia", ...BUSINESS_REGIONS] as const;
export type BusinessArea = typeof BUSINESS_AREAS[number];
/** The Regions index, whose map and list open the area pages. */
export const BUSINESS_REGIONS_HREF = BUSINESS_SECTIONS.find(section => section.id === "regions")!.href;
/** An area's slug and URL, its id on the shared region map and picker, the area of such an id and that area's page (`areaRoutes.ts`). */
export const { areaSlug: businessAreaSlug, areaHref: businessAreaHref, mapId: businessMapId, areaOfMapId: businessAreaOfMapId, regionHref: businessRegionHref } = areaRoutes<BusinessArea>(BUSINESS_REGIONS_HREF);

/** An area's list: the money measures (million GEL), jobs (thousand people) and the firm counts, each group under its heading. */
const AREA_SERIES: readonly { heading: "money" | "jobs" | "firms"; measures: readonly BusinessMeasure[] }[] = [
  { heading: "money", measures: ["turnover", "investment", "profit", "loss"] },
  { heading: "jobs", measures: ["employed"] },
  { heading: "firms", measures: ["active", "births", "deaths"] },
];
/** Georgia's page shows the national totals, a region's page its own row. */
const areaGroup = (area: BusinessArea) => area === "georgia" ? "total" : area;

/** An area's series. Sales, the default, is the ink reference; jobs and the firm counts have none, as on the Firms page. */
export function businessAreaSeries(area: BusinessArea): BusinessSeriesDefinition[] {
  return AREA_SERIES.flatMap(({ heading, measures }) => measures.map(item => ({ id: businessIndicator(item, areaGroup(area)), reference: item === "turnover", heading })));
}

export function businessAreaDefaultSelection(area: BusinessArea): string[] {
  return [businessIndicator("turnover", areaGroup(area))];
}

/** An area page's view; the area is the page's own and is not part of it. */
export type BusinessAreaState = TopicState;

/** An area's years for a selection: every year any series of its unit has a value (any of the area's series when nothing is selected). */
export function businessAreaCoverage(area: BusinessArea, facts: readonly ClientBusinessFact[], selectedIds: readonly string[] = []) {
  return businessListCoverage(businessAreaSeries(area), selectedIds, facts);
}

/** Reads the view of the page for `area`: its selection, kept to one unit, and the years. */
export function parseBusinessAreaHash(hash: string, area: BusinessArea, facts: readonly ClientBusinessFact[]): BusinessAreaState {
  return parseBusinessListHash(hash, businessAreaSeries(area), businessAreaDefaultSelection(area), facts);
}

/**
 * The hash a link to another area's page carries: this page's selection, moved to that area, as `serializeTopicHash`
 * writes it. The default selection (sales) carries none.
 */
export function businessAreaSelectionHash(selectedIds: readonly string[], area: BusinessArea): string {
  const moved = selectedIds.map(id => `${id.split(".").slice(0, 2).join(".")}.${areaGroup(area)}`);
  return moved.join(",") === businessAreaDefaultSelection(area).join(",") ? "" : `#${new URLSearchParams({ sel: moved.join(",") })}`;
}

export function buildBusinessAreaModel(area: BusinessArea, facts: readonly ClientBusinessFact[], state: BusinessAreaState): BusinessModel {
  return buildBusinessSeriesModel(businessAreaSeries(area), facts, state);
}

/** The Regions index map's value: sales (initial) or jobs. The map itself is built server-side (businessRegionMap.ts). */
export type BusinessMapMeasure = "turnover" | "employed";
/** The hash a map or list link to an area page carries: jobs opens with jobs selected; sales is every page's default. */
export const businessMapHash = (measure: BusinessMapMeasure, area: BusinessArea) => businessAreaSelectionHash([businessIndicator(measure, areaGroup(area))], area);
/** The Regions index's view is only the map's measure, kept in the hash under `m`. */
export const parseBusinessMapMeasure = (hash: string): BusinessMapMeasure => new URLSearchParams(hash.replace(/^#/, "")).get("m") === "jobs" ? "employed" : "turnover";
export const serializeBusinessMapMeasure = (measure: BusinessMapMeasure) => `m=${measure === "turnover" ? "money" : "jobs"}`;
