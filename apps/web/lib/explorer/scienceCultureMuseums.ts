import { SCIENCE_CULTURE_GROUPS, SCIENCE_CULTURE_REGIONS, scienceCultureIndicator, type ClientScienceCultureFact } from "../data/scienceCulture/types";
import { areaRoutes } from "./areaRoutes";
import {
  SCIENCE_CULTURE_SECTIONS, buildScienceCultureSeriesModel, changeScienceCultureSelection, parseScienceCultureListHash, scienceCultureListCoverage, scienceCultureRows, scienceCultureStaffRows,
  type ScienceCultureListModel, type ScienceCultureSeriesDefinition,
} from "./scienceCulture";
import type { TopicState } from "./topicSeries";

/** The areas with a page: Georgia, then the eleven regions. */
export const MUSEUM_AREAS = ["georgia", ...SCIENCE_CULTURE_REGIONS] as const;
export type MuseumArea = typeof MUSEUM_AREAS[number];
/** The Museums index, whose map and list open the area pages. */
export const MUSEUMS_HREF = SCIENCE_CULTURE_SECTIONS.find(section => section.id === "museums")!.href;
/** An area's slug and URL, its id on the shared region map and picker, the area of such an id and that area's page (`areaRoutes.ts`). */
export const { areaSlug: museumAreaSlug, areaHref: museumAreaHref, mapId: museumMapId, areaOfMapId: museumAreaOfMapId, regionHref: museumRegionHref } = areaRoutes<MuseumArea>(MUSEUMS_HREF);

/** The group a region-or-Georgia measure is served under: Georgia's `total`, or the region itself. */
const groupOf = (area: MuseumArea) => area === "georgia" ? "total" : area;

/**
 * An area's list: visitors, group tours, exhibitions and museums, one row each. Georgia adds Geostat's six museum types under
 * Museums and the eight museum staff rows under Staff, which Geostat publishes only nationally. Visitors are the ink reference.
 */
export function museumAreaSeries(area: MuseumArea): ScienceCultureSeriesDefinition[] {
  const group = groupOf(area);
  const rows = [
    ...scienceCultureRows("museum_visitors", [group], "visitors"),
    ...scienceCultureRows("museum_tours", [group], "tours"),
    ...scienceCultureRows("museum_exhibitions", [group], "exhibitions"),
    ...scienceCultureRows("museums", [group], "museums"),
    ...(area === "georgia" ? [
      ...scienceCultureRows("museums", SCIENCE_CULTURE_GROUPS.museums.filter(g => g.startsWith("type_")), "museums"),
      ...scienceCultureStaffRows("museum_staff"),
    ] : []),
  ];
  return rows.map((row, index) => ({ ...row, reference: index === 0 }));
}

export const museumAreaDefaultSelection = (area: MuseumArea): string[] => [museumAreaSeries(area)[0].id];

/** An area's years for a selection (any of the area's series when nothing is selected). */
export const museumAreaCoverage = (area: MuseumArea, facts: readonly ClientScienceCultureFact[], selectedIds: readonly string[] = []) =>
  scienceCultureListCoverage(museumAreaSeries(area), selectedIds, facts);

/** Reads the view of the page for `area`: its selection, kept to one unit, and the years. */
export const parseMuseumAreaHash = (hash: string, area: MuseumArea, facts: readonly ClientScienceCultureFact[]): TopicState =>
  parseScienceCultureListHash(hash, museumAreaSeries(area), museumAreaDefaultSelection(area), facts);

export const changeMuseumAreaSelection = (area: MuseumArea, state: TopicState, next: readonly string[], facts: readonly ClientScienceCultureFact[]): TopicState =>
  changeScienceCultureSelection(state, museumAreaSeries(area), next, facts);

/** The measures whose rows move between areas: Georgia's `total` is a region's own group. */
const AREA_MEASURES: ReadonlySet<string> = new Set(["museum_visitors", "museum_tours", "museum_exhibitions", "museums"]);
const isAreaGroup = (group: string) => group === "total" || (SCIENCE_CULTURE_REGIONS as readonly string[]).includes(group);

/**
 * The hash a link to another area's page carries: this page's selection, moved to that area (Visitors stays Visitors, between
 * Georgia and a region alike). A row the target page lacks (a museum type or staff row on a region's page) drops. An empty
 * result, or the target's default selection, carries none.
 */
export function museumAreaSelectionHash(selectedIds: readonly string[], area: MuseumArea): string {
  const listed = new Set<string>(museumAreaSeries(area).map(row => row.id));
  const moved = selectedIds
    .map(id => {
      const [, measure, group] = id.split(".");
      return AREA_MEASURES.has(measure) && isAreaGroup(group) ? scienceCultureIndicator(measure as "museums", groupOf(area) as "total") : id;
    })
    .filter(id => listed.has(id));
  return !moved.length || moved.join(",") === museumAreaDefaultSelection(area).join(",") ? "" : `#${new URLSearchParams({ sel: moved.join(",") })}`;
}

/** The latest-value line's figure: the area's own visitors (the reference row) in their latest year, whatever is chosen below. */
export function museumAreaLatest(area: MuseumArea, facts: readonly ClientScienceCultureFact[]): ClientScienceCultureFact {
  const visitorsId = museumAreaSeries(area).find(series => series.reference)!.id;
  return facts.filter(f => f.indicatorId === visitorsId).sort((a, b) => a.year - b.year).at(-1)!;
}

export const buildMuseumAreaModel = (area: MuseumArea, facts: readonly ClientScienceCultureFact[], state: TopicState): ScienceCultureListModel =>
  buildScienceCultureSeriesModel(museumAreaSeries(area), facts, state);
