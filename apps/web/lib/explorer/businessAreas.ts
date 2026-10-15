import { BUSINESS_REGIONS, businessIndicator, type BusinessMeasure, type ClientBusinessFact } from "../data/business/types";
import { BUSINESS_SECTIONS, buildBusinessSeriesModel, type BusinessModel, type BusinessSeriesDefinition } from "./business";
import { refitRange } from "./periodRange";
import { parseTopicHash, serializeTopicHash, topicCoverage, type TopicState } from "./topicSeries";

/** The areas with a page: Georgia, then the eleven regions. Abkhazeti AR and the unknown region are part of the firms total but have no page. */
export const BUSINESS_AREAS = ["georgia", ...BUSINESS_REGIONS] as const;
export type BusinessArea = typeof BUSINESS_AREAS[number];
const REGIONS_HREF = BUSINESS_SECTIONS.find(section => section.id === "regions")!.href;
/** An area's URL slug: a region's drops the `region_` prefix. */
export const businessAreaSlug = (area: BusinessArea) => area.replace(/^region_/, "");
export const businessAreaHref = (area: BusinessArea): `/${string}` => `${REGIONS_HREF}/${businessAreaSlug(area)}`;
/** The area page of a map or list row: `georgia`, or a region in the map's `region.<id>` form (as `householdRegionHref` reads it). */
export const businessRegionHref = (id: string): `/${string}` => businessAreaHref((id === "georgia" ? id : id.replace(/^region\./, "region_")) as BusinessArea);

/** The area page's icon measure switch. */
export type BusinessAreaMeasure = "money" | "jobs" | "firms";
const AREA_MEASURES: readonly BusinessAreaMeasure[] = ["money", "jobs", "firms"];
/** Each switch option's series, in list order, and the bold ones it selects when chosen. */
const AREA_SERIES: Record<BusinessAreaMeasure, { measures: readonly BusinessMeasure[]; selected: readonly BusinessMeasure[] }> = {
  money: { measures: ["turnover", "investment", "profit", "loss"], selected: ["turnover"] },
  jobs: { measures: ["employed"], selected: ["employed"] },
  firms: { measures: ["active", "births", "deaths"], selected: ["births", "deaths"] },
};
/** Georgia's page shows the national totals, a region's page its own row. */
const areaGroup = (area: BusinessArea) => area === "georgia" ? "total" : area;

/** An area's series for a measure. Sales and jobs, each a measure's lone bold default, are the ink reference; firms has none, as on the Firms page. */
export function businessAreaSeries(area: BusinessArea, measure: BusinessAreaMeasure): BusinessSeriesDefinition[] {
  const { measures, selected } = AREA_SERIES[measure];
  return measures.map(item => ({ id: businessIndicator(item, areaGroup(area)), reference: selected.length === 1 && selected[0] === item }));
}

export function businessAreaDefaultSelection(area: BusinessArea, measure: BusinessAreaMeasure): string[] {
  return AREA_SERIES[measure].selected.map(item => businessIndicator(item, areaGroup(area)));
}

/** An area page's view; the area is the page's own and is not part of it. */
export type BusinessAreaState = TopicState & { measure: BusinessAreaMeasure };

/** An area's years for a measure: every year any of its series has a value. */
export function businessAreaCoverage(area: BusinessArea, measure: BusinessAreaMeasure, facts: readonly ClientBusinessFact[]) {
  const ids = new Set<string>(businessAreaSeries(area, measure).map(s => s.id));
  return topicCoverage(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year), `No business years for ${area}:${measure}`);
}

/** Reads the view of the page for `area`; the measure is `m` (money when missing or unknown), and a selection keeps only that measure's series. */
export function parseBusinessAreaHash(hash: string, area: BusinessArea, facts: readonly ClientBusinessFact[]): BusinessAreaState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const measure = AREA_MEASURES.find(item => item === p.get("m")) ?? "money";
  return { ...parseTopicHash(p, businessAreaSeries(area, measure), businessAreaDefaultSelection(area, measure), businessAreaCoverage(area, measure, facts)), measure };
}

export function serializeBusinessAreaHash(state: BusinessAreaState): string {
  const p = new URLSearchParams();
  p.set("m", state.measure);
  return serializeTopicHash(state, p);
}

/** Choosing a measure selects its bold series and keeps the years, clamped to the measure's coverage (never collapsed to "all"). */
export function changeBusinessAreaMeasure(state: BusinessAreaState, area: BusinessArea, measure: BusinessAreaMeasure, facts: readonly ClientBusinessFact[]): BusinessAreaState {
  return { ...state, measure, selectedIds: businessAreaDefaultSelection(area, measure), range: refitRange(state.range, businessAreaCoverage(area, measure, facts), { collapseToAll: false }) };
}

export function buildBusinessAreaModel(area: BusinessArea, facts: readonly ClientBusinessFact[], state: BusinessAreaState): BusinessModel {
  return buildBusinessSeriesModel(businessAreaSeries(area, state.measure), businessAreaCoverage(area, state.measure, facts), facts, state);
}

/** The Regions index map's value: sales (initial) or jobs. The map itself is built server-side (businessRegionMap.ts). */
export type BusinessMapMeasure = "turnover" | "employed";
/** The hash a map or list link to an area page carries: jobs opens on the jobs measure; sales is every page's default. */
export const businessMapHash = (measure: BusinessMapMeasure) => measure === "turnover" ? "" : "#m=jobs";
/** The Regions index's view is only the map's measure, kept in the hash under the area pages' key `m`. */
export const parseBusinessMapMeasure = (hash: string): BusinessMapMeasure => new URLSearchParams(hash.replace(/^#/, "")).get("m") === "jobs" ? "employed" : "turnover";
export const serializeBusinessMapMeasure = (measure: BusinessMapMeasure) => `m=${measure === "turnover" ? "money" : "jobs"}`;
