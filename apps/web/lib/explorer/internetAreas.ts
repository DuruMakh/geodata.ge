import { INTERNET_REGIONS, internetIndicator, type ClientInternetFact, type InternetGroup } from "../data/internet/types";
import { INTERNET_SECTIONS, buildInternetSeriesModel, type InternetModel, type InternetSeriesDefinition } from "./internet";
import { areaRoutes } from "./areaRoutes";
import type { TopicState } from "./topicSeries";
import { changeUnitListSelection, parseUnitListHash, unitListCoverage } from "./unitList";

/** The areas with a page: Georgia, then the eleven regions. */
export const INTERNET_AREAS = ["georgia", ...INTERNET_REGIONS] as const;
export type InternetArea = typeof INTERNET_AREAS[number];
/** The Internet at home index, whose map and list open the area pages. */
export const INTERNET_HOMES_HREF = INTERNET_SECTIONS.find(section => section.id === "homes")!.href;
/** An area's slug and URL, its id on the shared region map and picker, the area of such an id and that area's page (`areaRoutes.ts`). */
export const { areaSlug: internetAreaSlug, areaHref: internetAreaHref, mapId: internetMapId, areaOfMapId: internetAreaOfMapId, regionHref: internetRegionHref } = areaRoutes<InternetArea>(INTERNET_HOMES_HREF);

const MEASURES = ["homes_internet", "homes_computer"] as const;

/**
 * An area's list. Georgia: homes with internet, then with a computer, each for Georgia (the ink reference), towns and
 * villages. A region: its homes with internet and with a computer under one heading, both ink (the computer row dashed).
 */
export function internetAreaSeries(area: InternetArea): InternetSeriesDefinition[] {
  if (area !== "georgia") return MEASURES.map(measure => ({ id: internetIndicator(measure, area), reference: true, heading: "homes" }));
  return MEASURES.flatMap(measure => (["total", "urban", "rural"] as const).map(group => ({ id: internetIndicator(measure, group), reference: group === "total", heading: measure })));
}

export const internetAreaDefaultSelection = (area: InternetArea): string[] => [internetAreaSeries(area)[0].id];

/** An area page's view; the area is the page's own and is not part of it. */
export type InternetAreaState = TopicState;

const noYears = (area: InternetArea) => `No internet years for ${area}`;

/** An area's years for a selection (any of the area's series when nothing is selected). */
export const internetAreaCoverage = (area: InternetArea, facts: readonly ClientInternetFact[], selectedIds: readonly string[] = []) =>
  unitListCoverage(internetAreaSeries(area), selectedIds, facts, noYears(area));

/** Reads the view of the page for `area`. Every row is a share of homes, so rows of both kinds are shown together. */
export const parseInternetAreaHash = (hash: string, area: InternetArea, facts: readonly ClientInternetFact[]): InternetAreaState =>
  parseUnitListHash(hash, internetAreaSeries(area), internetAreaDefaultSelection(area), facts, noYears(area));

export const changeInternetAreaSelection = (area: InternetArea, state: InternetAreaState, next: readonly string[], facts: readonly ClientInternetFact[]): InternetAreaState =>
  changeUnitListSelection(state, internetAreaSeries(area), next, facts, noYears(area));

/**
 * The hash a link to another area's page carries: this page's selection, moved to that area (an internet row stays an
 * internet row, a computer row a computer row). Towns and villages, which a region lacks, become the region's own row,
 * and a region's row becomes Georgia's. The default selection carries none.
 */
export function internetAreaSelectionHash(selectedIds: readonly string[], area: InternetArea): string {
  const moved = [...new Set(selectedIds.map(id => {
    const [prefix, measure, group] = id.split(".");
    const target: InternetGroup = area !== "georgia" ? area : group === "urban" || group === "rural" ? group : "total";
    return `${prefix}.${measure}.${target}`;
  }))];
  return moved.join(",") === internetAreaDefaultSelection(area).join(",") ? "" : `#${new URLSearchParams({ sel: moved.join(",") })}`;
}

/** The latest-value line's figure: the area's own homes with internet in their latest year, whatever is chosen below. */
export function internetAreaLatest(area: InternetArea, facts: readonly ClientInternetFact[]): ClientInternetFact {
  const homesId = internetAreaSeries(area)[0].id;
  return facts.filter(f => f.indicatorId === homesId).sort((a, b) => a.year - b.year).at(-1)!;
}

export const buildInternetAreaModel = (area: InternetArea, facts: readonly ClientInternetFact[], state: InternetAreaState): InternetModel =>
  buildInternetSeriesModel(internetAreaSeries(area), facts, state);
