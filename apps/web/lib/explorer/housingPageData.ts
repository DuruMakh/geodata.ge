import { toClientHousingFact } from "../data/housing/importHousing";
import type { ClientHousingFact, HousingFact } from "../data/housing/types";
import { message } from "../i18n/messages";
import type { Messages, Presentation } from "../i18n/types";
import { housingTopicSeries, type HousingTopicId } from "./housing";
import { housingAreaSeries, type HousingArea } from "./housingAreas";

/*
 * What the Housing pages hand their explorers: the observations a page shows and its series' names. Shared by the pages
 * (lib/pages/housing.tsx, housing-area.tsx) and the MCP snapshot build (lib/factQuery/topics/housing.ts), which cannot
 * import the pages (they pull in `server-only` and React).
 */

/**
 * Display names for every series a topic page can show: all buildings and the building types, or the price index's
 * three rows and the Tbilisi districts. Names carry no prefix: the heading they sit under names their measure and unit.
 */
export function housingLabels(presentation: Presentation, section: HousingTopicId): Record<string, string> {
  const t = (key: string) => message(presentation.messages, `housing.${key}`);
  return Object.fromEntries(housingTopicSeries(section).map(({ id }) => {
    const [, measure, group] = id.split(".");
    if (measure === "price_index") return [id, t(`series.index.${group}`)];
    if (group.startsWith("district_")) return [id, t(`series.district.${group.slice("district_".length)}`)];
    return [id, group === "total" ? t("series.total") : t(`series.type.${group.slice("type_".length)}`)];
  }));
}

/** The observations a topic page's list can show. */
export function housingPageFacts(facts: readonly HousingFact[], section: HousingTopicId): ClientHousingFact[] {
  const ids = new Set<string>(housingTopicSeries(section).map(series => series.id));
  return facts.map(toClientHousingFact).filter(f => ids.has(f.indicatorId));
}

/** The observations an area page's list shows. */
export function housingAreaFacts(facts: readonly HousingFact[], area: HousingArea): ClientHousingFact[] {
  const ids = new Set<string>(housingAreaSeries(area).map(item => item.id));
  return facts.map(toClientHousingFact).filter(f => ids.has(f.indicatorId));
}

/** An area page's row names: all buildings or residential buildings; its heading says permits or completed and the unit, and the area is the page's own. */
export function housingAreaSeriesLabels(messages: Messages, area: HousingArea): Record<string, string> {
  return Object.fromEntries(housingAreaSeries(area).map(item => [item.id, message(messages, item.id.endsWith("residential") ? "housing.series.type.residential" : "housing.series.total")]));
}
