import { HEALTH_AREAS, HEALTH_INDICATORS, type ClientHealthFact, type HealthArea } from "../data/health/types";
import { HEALTH_SECTIONS, buildHealthSeriesModel, healthSeriesCoverage, type HealthSeriesModel } from "./health";
import type { ResolvedPeriodRange } from "./periodRange";
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

/** The latest-value line's figure: the area's deaths from all causes in their latest year, whatever is chosen below. */
export function healthDeathsAreaLatest(area: HealthArea, facts: readonly ClientHealthFact[]): ClientHealthFact {
  return facts.filter(f => f.indicatorId === TOTAL && f.areaId === area).sort((a, b) => a.year - b.year).at(-1)!;
}

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
