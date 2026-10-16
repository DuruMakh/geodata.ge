import { HOUSING_REGIONS, housingIndicator, type ClientHousingFact, type HousingGroup } from "../data/housing/types";
import { REGIONAL_ECONOMY_REGIONS } from "../data/regionalEconomies/importRegionalEconomies";
import { HOUSING_SECTIONS, buildHousingSeriesModel, changeHousingSelection, housingListCoverage, parseHousingListHash, type HousingModel, type HousingSeriesDefinition } from "./housing";
import { INK } from "./colors";
import { buildLatestValueRegionMapModel, type RegionMapModel } from "./regionalEconomyMap";
import { topicSeriesColor, type TopicState } from "./topicSeries";

/** The areas with a page: Georgia, then the eleven regions. */
export const HOUSING_AREAS = ["georgia", ...HOUSING_REGIONS] as const;
export type HousingArea = typeof HOUSING_AREAS[number];
/** The Regions index, whose map and list open the area pages. */
export const HOUSING_REGIONS_HREF = HOUSING_SECTIONS.find(section => section.id === "regions")!.href;
/** An area's URL slug: a region's drops the `region_` prefix. */
export const housingAreaSlug = (area: HousingArea) => area.replace(/^region_/, "");
export const housingAreaHref = (area: HousingArea): `/${string}` => `${HOUSING_REGIONS_HREF}/${housingAreaSlug(area)}`;
/** An area's id on the shared region map and picker: `georgia`, or a region's `region.<id>`, whose names the shared region labels carry. */
export const housingMapId = (area: HousingArea) => area === "georgia" ? area : area.replace(/^region_/, "region.");
/** The area of a map, picker or list row id (`housingMapId`'s inverse). */
export const housingAreaOfMapId = (id: string) => (id === "georgia" ? id : id.replace(/^region\./, "region_")) as HousingArea;
/** The area page of a map or list row. */
export const housingRegionHref = (id: string): `/${string}` => housingAreaHref(housingAreaOfMapId(id));

/** Georgia's page shows the national rows (all buildings `total`, homes `type_residential`), a region's page its own two. */
const allBuildings = (area: HousingArea): HousingGroup => area === "georgia" ? "total" : area;
const homes = (area: HousingArea): HousingGroup => area === "georgia" ? "type_residential" : `${area}_residential`;

/** An area's list: permits and completed objects (all buildings, then homes) as numbers, then the same four as floor area. Permits are the ink reference of each group. */
export function housingAreaSeries(area: HousingArea): HousingSeriesDefinition[] {
  return (["count", "area"] as const).flatMap(heading => [
    { id: housingIndicator(`permits_${heading}`, allBuildings(area)), reference: true, heading },
    { id: housingIndicator(`permits_${heading}`, homes(area)), reference: false, heading },
    { id: housingIndicator(`completed_${heading}`, allBuildings(area)), reference: false, heading },
    { id: housingIndicator(`completed_${heading}`, homes(area)), reference: false, heading },
  ]);
}

/** A row wears the colour of its place in its group, so the number and the floor area of the same objects share one. */
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

export const buildHousingAreaModel = (area: HousingArea, facts: readonly ClientHousingFact[], state: HousingAreaState): HousingModel =>
  buildHousingSeriesModel(housingAreaSeries(area), facts, state, housingAreaColor);

/**
 * The map of the Regions index: each region's permitted floor area in the latest year all eleven regions have, as
 * published, ranked from the highest. Regions are keyed by the map's `region.<id>` ids.
 */
export function buildHousingRegionMapModel(facts: readonly ClientHousingFact[]): RegionMapModel {
  const regionOf = new Map<string, string>(HOUSING_REGIONS.map(region => [housingIndicator("permits_area", region), housingMapId(region)]));
  const regional = facts.filter(f => regionOf.has(f.indicatorId));
  const complete = [...new Set(regional.map(f => f.year))].filter(year => regional.filter(f => f.year === year).length === regionOf.size);
  if (!complete.length) throw new Error("No year has housing permitted floor area for every region");
  const year = Math.max(...complete);
  const latest = new Map(regional.filter(f => f.year === year).map(f => [regionOf.get(f.indicatorId)!, f.value]));
  return buildLatestValueRegionMapModel({ regions: REGIONAL_ECONOMY_REGIONS, latest, year, firstYear: Math.min(...regional.map(f => f.year)), measure: "housing permitted floor area" });
}
