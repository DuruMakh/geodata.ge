import type { ClientEnvironmentFact } from "../data/environment/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { environmentLabelKey, type EnvironmentSeriesDefinition } from "./environment";

/*
 * What the Environment and climate pages hand their explorers: the observations a list shows and its series' names.
 * Shared by the pages (lib/pages/environment*.tsx) and the MCP snapshot build (lib/factQuery/topics/environment.ts),
 * which cannot import the pages (they pull in `server-only` and React).
 */

/** The observations a topic, city or area list can show: each page receives only those. */
export function environmentListFacts(facts: readonly ClientEnvironmentFact[], series: readonly EnvironmentSeriesDefinition[]): ClientEnvironmentFact[] {
  const ids = new Set(series.map(item => item.id));
  return facts.filter(f => ids.has(f.indicatorId));
}

/** The names of a list's series, without prefixes: the heading each row sits under names its measure and unit. */
export const environmentLabels = (presentation: Presentation, ids: readonly string[]): Record<string, string> =>
  Object.fromEntries(ids.map(id => [id, message(presentation.messages, `environment.${environmentLabelKey(id)}`)]));
