import { toClientPovertyFact } from "../data/poverty/importPoverty";
import type { ClientPovertyFact, PovertyFact } from "../data/poverty/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { povertyViews, povertyViewSeries, type PovertySectionId } from "./poverty";

/*
 * What the poverty pages hand their explorer: the observations a page shows and its series' names. Shared by the page
 * (lib/pages/poverty.tsx) and the MCP snapshot build (lib/factQuery/topics/poverty.ts), which cannot import the pages
 * (they pull in `server-only` and React).
 */

/** Display names for every series a poverty page can show, in the page's language. */
export function povertyLabels(presentation: Presentation, section: PovertySectionId): Record<string, string> {
  const ids = povertyViews(section).flatMap(view => povertyViewSeries(section, view).map(series => series.id));
  return Object.fromEntries(ids.map(id => [id, message(presentation.messages, `poverty.series.${id}`)]));
}

/** The observations a page's views can show. */
export function povertyPageFacts(facts: readonly PovertyFact[], section: PovertySectionId): ClientPovertyFact[] {
  return facts.map(toClientPovertyFact).filter(f => f.indicatorId.startsWith(section === "inequality" ? "gini." : "poverty."));
}
