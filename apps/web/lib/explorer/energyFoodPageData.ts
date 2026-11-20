import { toClientEnergyFoodFact } from "../data/energyFood/importEnergyFood";
import type { ClientEnergyFoodFact, EnergyFoodFact } from "../data/energyFood/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { energyFoodSeries, type EnergyFoodSectionId } from "./energyFood";

/*
 * What the Energy and food pages hand their explorer: the observations a page shows and its series' names. Shared by the
 * page (lib/pages/energy-food.tsx) and the MCP snapshot build (lib/factQuery/topics/energyFood.ts), which cannot import
 * the pages (they pull in `server-only` and React).
 */

/** The served observations a section's series show, as the client gets them. */
export function energyFoodPageFacts(facts: readonly EnergyFoodFact[], section: EnergyFoodSectionId): ClientEnergyFoodFact[] {
  const ids = new Set<string>(energyFoodSeries(section).map(series => series.id));
  return facts.map(toClientEnergyFoodFact).filter(f => ids.has(f.indicatorId));
}

/** Display names for every series a page shows, in the page's language. */
export function energyFoodLabels(presentation: Presentation, section: EnergyFoodSectionId): Record<string, string> {
  return Object.fromEntries(energyFoodSeries(section).map(series => [series.id, message(presentation.messages, `energyFood.series.${series.id}`)]));
}
