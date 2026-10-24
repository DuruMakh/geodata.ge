import { HOUSING_REGIONS, housingIndicator, type ClientHousingFact, type HousingGroup, type HousingMeasure } from "../data/housing/types";
import { HOUSING_SECTIONS, buildHousingSeriesModel, changeHousingSelection, housingListCoverage, parseHousingListHash, type HousingHeading, type HousingModel, type HousingSeriesDefinition } from "./housing";
import { areaRoutes } from "./areaRoutes";
import { INK } from "./colors";
import { topicSeriesColor, type TopicState } from "./topicSeries";

/** The areas with a page: Georgia, then the eleven regions. */
export const HOUSING_AREAS = ["georgia", ...HOUSING_REGIONS] as const;
export type HousingArea = typeof HOUSING_AREAS[number];
/** The Regions index, whose map and list open the area pages. */
export const HOUSING_REGIONS_HREF = HOUSING_SECTIONS.find(section => section.id === "regions")!.href;
/** An area's slug and URL, its id on the shared region map and picker, the area of such an id and that area's page (`areaRoutes.ts`). */
export const { areaSlug: housingAreaSlug, areaHref: housingAreaHref, mapId: housingMapId, areaOfMapId: housingAreaOfMapId, regionHref: housingRegionHref } = areaRoutes<HousingArea>(HOUSING_REGIONS_HREF);

/** Georgia's page shows the national rows (all buildings `total`, homes `type_residential`), a region's page its own two. */
const allBuildings = (area: HousingArea): HousingGroup => area === "georgia" ? "total" : area;
const homes = (area: HousingArea): HousingGroup => area === "georgia" ? "type_residential" : `${area}_residential`;

/** An area's four headings, in list order: permits and completed objects as numbers, then the same two as floor area. */
const AREA_HEADINGS = [
  { heading: "permitsCount", measure: "permits_count" },
  { heading: "completedCount", measure: "completed_count" },
  { heading: "permitsArea", measure: "permits_area" },
  { heading: "completedArea", measure: "completed_area" },
] as const satisfies readonly { heading: HousingHeading; measure: HousingMeasure }[];

/** An area's list: all buildings, then homes, under each of its four headings. All permitted buildings are the ink reference of each unit. */
export function housingAreaSeries(area: HousingArea): HousingSeriesDefinition[] {
  return AREA_HEADINGS.flatMap(({ heading, measure }) => [
    { id: housingIndicator(measure, allBuildings(area)), reference: measure.startsWith("permits_"), heading },
    { id: housingIndicator(measure, homes(area)), reference: false, heading },
  ]);
}

/** A row wears the colour of its place among its unit's four rows, so the number and the floor area of the same objects share one. */
const housingAreaColor = (series: HousingSeriesDefinition, index: number) => series.reference ? INK : topicSeriesColor(series, index % 4, `housing.area.${index % 4}`);

export const housingAreaDefaultSelection = (area: HousingArea): string[] => [housingAreaSeries(area)[0].id];

/** An area page's view; the area is the page's own and is not part of it. */
export type HousingAreaState = TopicState;

/** An area's years for a selection (any of the area's series when nothing is selected). */
export const housingAreaCoverage = (area: HousingArea, facts: readonly ClientHousingFact[], selectedIds: readonly string[] = []) =>
  housingListCoverage(housingAreaSeries(area), selectedIds, facts);

/** Reads the view of the page for `area`: its selection, kept to one unit, and the years. */
export const parseHousingAreaHash = (hash: string, area: HousingArea, facts: readonly ClientHousingFact[]): HousingAreaState =>
  parseHousingListHash(hash, housingAreaSeries(area), housingAreaDefaultSelection(area), facts);

export const changeHousingAreaSelection = (area: HousingArea, state: HousingAreaState, next: readonly string[], facts: readonly ClientHousingFact[]): HousingAreaState =>
  changeHousingSelection(state, housingAreaSeries(area), next, facts);

/**
 * The hash a link to another area's page carries: this page's selection, moved to that area (a homes row stays a homes
 * row, an all-buildings row an all-buildings row, between Georgia and a region alike). The default selection carries none.
 */
export function housingAreaSelectionHash(selectedIds: readonly string[], area: HousingArea): string {
  const moved = selectedIds.map(id => {
    const [prefix, measure, group] = id.split(".");
    return `${prefix}.${measure}.${group === "type_residential" || group.endsWith("_residential") ? homes(area) : allBuildings(area)}`;
  });
  return moved.join(",") === housingAreaDefaultSelection(area).join(",") ? "" : `#${new URLSearchParams({ sel: moved.join(",") })}`;
}

/** The latest-value line's figure: the area's own permits in their latest year, whatever is chosen below. */
export function housingAreaLatest(area: HousingArea, facts: readonly ClientHousingFact[]): ClientHousingFact {
  const permitsId = housingAreaSeries(area).find(series => series.reference && series.heading === "permitsCount")!.id;
  return facts.filter(f => f.indicatorId === permitsId).sort((a, b) => a.year - b.year).at(-1)!;
}

export const buildHousingAreaModel = (area: HousingArea, facts: readonly ClientHousingFact[], state: HousingAreaState): HousingModel =>
  buildHousingSeriesModel(housingAreaSeries(area), facts, state, housingAreaColor);
