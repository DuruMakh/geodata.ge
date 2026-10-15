import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { HEALTH_AREAS, HEALTH_INDICATORS, type ClientHealthFact, type HealthArea } from "../data/health/types";
import { HEALTH_SECTIONS, buildHealthSeriesModel, healthSeriesCoverage, type HealthSeriesModel } from "./health";
import type { ResolvedPeriodRange } from "./periodRange";
import { buildLatestValueRegionMapModel, type RegionMapModel } from "./regionalEconomyMap";
import { parseTopicHash, serializeTopicHash, type TopicState } from "./topicSeries";

/** Georgia and the eleven regions each have a causes-of-death page; Abkhazia is never served. */
export const HEALTH_DEATH_AREAS = HEALTH_AREAS;

const SECTION_HREF = HEALTH_SECTIONS.find(section => section.id === "causes-of-death")!.href;
/** An area's own page (Georgia's slug is `georgia`); a region's slug drops the `region.` prefix, as on the Wages region pages. */
export const healthDeathsAreaHref = (area: HealthArea): `/${string}` => `${SECTION_HREF}/regions/${area.replace(/^region\./, "")}`;
export const healthDeathsAreaForSlug = (slug: string): HealthArea | null => HEALTH_DEATH_AREAS.find(area => area.replace(/^region\./, "") === slug) ?? null;

export type HealthDeathsSeriesDefinition = { id: (typeof HEALTH_INDICATORS)[number]; reference: boolean };

/** All deaths (the reference), then the 20 causes in the publication's order, all top level. */
export function healthDeathsSeries(): HealthDeathsSeriesDefinition[] {
  return HEALTH_INDICATORS.filter(id => id.startsWith("health.deaths.")).map((id, index) => ({ id, reference: index === 0 }));
}
const TOTAL = "health.deaths.total";

export type HealthDeathsState = TopicState;

export function defaultHealthDeathsState(): HealthDeathsState {
  return { mode: "line", range: { kind: "all" }, selectedIds: [TOTAL] };
}

const coverage = (area: HealthArea, facts: readonly ClientHealthFact[]) => healthSeriesCoverage(facts, area, healthDeathsSeries(), `No causes-of-death years for ${area}`);

/** Reads an area page's hash. An id the page does not have (a link from another page) is dropped; none left falls back to All deaths, but an empty `sel=` stays empty. */
export function parseHealthDeathsHash(hash: string, area: HealthArea, facts: readonly ClientHealthFact[]): HealthDeathsState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const { selectedIds, ...view } = parseTopicHash(p, healthDeathsSeries(), [TOTAL], coverage(area, facts));
  return { ...view, selectedIds: selectedIds.length || p.get("sel") === "" ? selectedIds : [TOTAL] };
}

export const serializeHealthDeathsHash = (state: HealthDeathsState): string => serializeTopicHash(state);

export type HealthDeathsModel = { range: ResolvedPeriodRange; years: number[]; series: HealthSeriesModel<HealthDeathsSeriesDefinition>[]; selected: HealthSeriesModel<HealthDeathsSeriesDefinition>[]; decimals: number };

/** The causes of one area over its years, as published: a count of deaths, so no unit conversion. A cause without a value for a year (COVID-19 before 2020) is a gap. */
export function buildHealthDeathsModel(area: HealthArea, facts: readonly ClientHealthFact[], state: HealthDeathsState): HealthDeathsModel {
  return buildHealthSeriesModel({ facts, area, range: state.range, coverage: coverage(area, facts), definitions: healthDeathsSeries(), selectedIds: state.selectedIds, scale: () => ({ multiplier: 1 }) });
}

const RATE = "health.death_rate.total";

/** The map that picks the page's area: the crude death rate for each region in the latest year all eleven regions have, as published. */
export function buildHealthDeathRateMapModel(facts: readonly ClientHealthFact[]): RegionMapModel {
  const regionIds = new Set<string>(REGIONAL_ECONOMY_REGIONS.map(region => region.id));
  const regional = facts.filter(f => f.indicatorId === RATE && regionIds.has(f.areaId));
  const complete = [...new Set(regional.map(f => f.year))].filter(year => regional.filter(f => f.year === year).length === regionIds.size);
  if (!complete.length) throw new Error("No year has a death rate for every region");
  const year = Math.max(...complete);
  const latest = new Map(regional.filter(f => f.year === year).map(f => [f.areaId, f.value]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year, firstYear: Math.min(...regional.map(f => f.year)), measure: "death rate" });
}
