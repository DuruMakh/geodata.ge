import { toClientScienceCultureFact } from "../data/scienceCulture/importScienceCulture";
import { SCIENCE_CULTURE_REGIONS, type ClientScienceCultureFact, type ScienceCultureFact } from "../data/scienceCulture/types";
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { scienceCultureTopicSeries, type ScienceCultureSeriesDefinition, type ScienceCultureTopicId } from "./scienceCulture";
import { museumAreaSeries, type MuseumArea } from "./scienceCultureMuseums";

/*
 * What the Science and culture pages hand their explorers: the observations a page shows and its series' names. Shared by
 * the pages (lib/pages/science-culture.tsx, science-culture-museum-area.tsx) and the MCP snapshot build
 * (lib/factQuery/topics/scienceCulture.ts), which cannot import the pages (they pull in `server-only` and React).
 */

/** Display names of the series a list shows; a region's row is named as Georgia's (the heading says what it counts, the page names the area). */
export function scienceCultureLabels(messages: Messages, definitions: readonly ScienceCultureSeriesDefinition[]): Record<string, string> {
  const regions: readonly string[] = SCIENCE_CULTURE_REGIONS;
  return Object.fromEntries(definitions.map(({ id }) => {
    const [, measure, group] = id.split(".");
    return [id, message(messages, `scienceCulture.series.${measure}.${regions.includes(group) ? "total" : group}`)];
  }));
}

/** The observations a topic page's list can show. */
export function scienceCulturePageFacts(facts: readonly ScienceCultureFact[], section: ScienceCultureTopicId): ClientScienceCultureFact[] {
  const ids = new Set<string>(scienceCultureTopicSeries(section).map(({ id }) => id));
  return facts.map(toClientScienceCultureFact).filter(f => ids.has(f.indicatorId));
}

/** The observations a museum area page's list shows. */
export function museumAreaFacts(facts: readonly ScienceCultureFact[], area: MuseumArea): ClientScienceCultureFact[] {
  const ids = new Set<string>(museumAreaSeries(area).map(item => item.id));
  return facts.map(toClientScienceCultureFact).filter(f => ids.has(f.indicatorId));
}
