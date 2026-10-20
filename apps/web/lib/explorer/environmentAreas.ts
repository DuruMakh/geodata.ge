import { ENVIRONMENT_REGIONS, type ClientEnvironmentFact } from "../data/environment/types";
import { areaRoutes } from "./areaRoutes";
import {
  ENVIRONMENT_SECTIONS, buildEnvironmentSeriesModel, changeEnvironmentListSelection, environmentListCoverage, parseEnvironmentListHash, withFacts,
  type EnvironmentModel, type EnvironmentSeriesDefinition, type EnvironmentState,
} from "./environment";

/** The two pages with a regional map, whose map and list open the area pages. */
export type EnvironmentAreaTopic = "waste" | "forests";
/** The areas with a page: Georgia, then the eleven regions. */
export const ENVIRONMENT_AREAS = ["georgia", ...ENVIRONMENT_REGIONS] as const;
export type EnvironmentArea = typeof ENVIRONMENT_AREAS[number];

export const environmentAreaIndexHref = (topic: EnvironmentAreaTopic) => ENVIRONMENT_SECTIONS.find(section => section.id === topic)!.href;
/** An area's slug and URL, its id on the shared region map and picker, the area of such an id and that area's page (`areaRoutes.ts`). */
export const environmentAreaRoutes = (topic: EnvironmentAreaTopic) => areaRoutes<EnvironmentArea>(environmentAreaIndexHref(topic));

/** Rows that exist for Georgia and every region: the waste collected, timber cut and illegal logging found. */
const AREA_MEASURES = ["environment.waste.collected", "environment.forest.timber_cut", "environment.forest.illegal_logging"];

/** An area's whole list, before rows without facts are dropped; its first row is the default and the ink reference. */
function areaDefinitions(topic: EnvironmentAreaTopic, area: EnvironmentArea): EnvironmentSeriesDefinition[] {
  const row = (heading: string, id: string, reference = false): EnvironmentSeriesDefinition => ({ id, reference, heading });
  if (topic === "waste") return [row("collected", `environment.waste.collected.${area}`, true), ...(area === "georgia" ? [row("wastePerPerson", "environment.waste.per_person")] : [])];
  const timber = [row("timber", `environment.forest.timber_cut.${area}`, true), row("timber", `environment.forest.illegal_logging.${area}`)];
  if (area !== "georgia") return timber;
  return [
    ...timber, row("protected", "environment.forest.timber_cut.protected_areas"), row("protected", "environment.forest.illegal_logging.protected_areas"),
    row("fires", "environment.forest.fires"), row("burntArea", "environment.forest.burnt_area"),
  ];
}

/** An area page's list (spec §9 and §10). Tbilisi has no timber figure, so its Forests page lists illegal logging only. */
export const environmentAreaSeries = (topic: EnvironmentAreaTopic, area: EnvironmentArea, facts: readonly ClientEnvironmentFact[]) =>
  withFacts(areaDefinitions(topic, area), facts);

export const environmentAreaDefaultSelection = (topic: EnvironmentAreaTopic, area: EnvironmentArea, facts: readonly ClientEnvironmentFact[]): string[] =>
  [environmentAreaSeries(topic, area, facts)[0].id];

export const environmentAreaCoverage = (topic: EnvironmentAreaTopic, area: EnvironmentArea, facts: readonly ClientEnvironmentFact[], selectedIds: readonly string[] = []) =>
  environmentListCoverage(environmentAreaSeries(topic, area, facts), selectedIds, facts);

export const parseEnvironmentAreaHash = (hash: string, topic: EnvironmentAreaTopic, area: EnvironmentArea, facts: readonly ClientEnvironmentFact[]): EnvironmentState =>
  parseEnvironmentListHash(hash, environmentAreaSeries(topic, area, facts), environmentAreaDefaultSelection(topic, area, facts), facts);

export const changeEnvironmentAreaSelection = (topic: EnvironmentAreaTopic, area: EnvironmentArea, state: EnvironmentState, next: readonly string[], facts: readonly ClientEnvironmentFact[]): EnvironmentState =>
  changeEnvironmentListSelection(state, environmentAreaSeries(topic, area, facts), next, facts);

/**
 * The hash a link to another area's page carries: this page's selection moved to that area (Georgia's timber cut becomes
 * the region's). Rows only Georgia has (per person, protected areas, fires) are dropped. The default selection, or nothing
 * left to carry, carries none.
 */
export function environmentAreaSelectionHash(topic: EnvironmentAreaTopic, selectedIds: readonly string[], area: EnvironmentArea): string {
  const moved = selectedIds.flatMap(id => {
    const measure = AREA_MEASURES.find(prefix => id.startsWith(`${prefix}.`));
    const place = measure && id.slice(measure.length + 1);
    return measure && (place === "georgia" || place!.startsWith("region_")) ? [`${measure}.${area}`] : [];
  });
  return !moved.length || moved.join(",") === areaDefinitions(topic, area)[0].id ? "" : `#${new URLSearchParams({ sel: moved.join(",") })}`;
}

export const buildEnvironmentAreaModel = (topic: EnvironmentAreaTopic, area: EnvironmentArea, facts: readonly ClientEnvironmentFact[], state: EnvironmentState): EnvironmentModel =>
  buildEnvironmentSeriesModel(environmentAreaSeries(topic, area, facts), facts, state);
