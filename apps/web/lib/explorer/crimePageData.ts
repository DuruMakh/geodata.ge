import type { CrimeFact } from "../data/crime/types";
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { crimeSeries, type CrimeSectionId } from "./crime";

/*
 * What the Crime and justice pages hand their explorers: the observations a page shows and its series' names. Shared by
 * the page (lib/pages/crime.tsx) and the MCP snapshot build (lib/factQuery/topics/crime.ts), which cannot import the
 * pages (they pull in `server-only` and React).
 */

/** The served observations a section's series show. */
export function crimePageFacts(facts: readonly CrimeFact[], section: CrimeSectionId): CrimeFact[] {
  const ids = new Set<string>(crimeSeries(section).map(series => series.id));
  return facts.filter(f => ids.has(f.indicatorId));
}

/** Display names of a section's series. */
export function crimeLabels(messages: Messages, section: CrimeSectionId): Record<string, string> {
  return Object.fromEntries(crimeSeries(section).map(({ id }) => [id, message(messages, `crime.series.${id}`)]));
}
