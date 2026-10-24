import { MONEY_BANKS_LOAN_AREAS, loansRegionIndicator, type ClientMoneyBanksFact } from "../data/moneyBanks/types";
import { areaRoutes } from "./areaRoutes";
import { moneyBanksSeriesColor, type MoneyBanksModel, type MoneyBanksSeriesDefinition } from "./moneyBanks";
import { buildTopicModel, parseTopicHash, topicCoverage, type TopicState } from "./topicSeries";

/** The areas with a page: Georgia, then the eleven regions. */
export type MoneyBanksArea = typeof MONEY_BANKS_LOAN_AREAS[number];
/** The Loans by region index, whose map and list open the area pages. */
export const MONEY_BANKS_REGIONS_HREF = "/explorer/money/regions";
/** An area's slug and URL, its id on the shared region map and picker, the area of such an id and that area's page (`areaRoutes.ts`). */
export const { areaSlug: moneyBanksAreaSlug, areaHref: moneyBanksAreaHref, mapId: moneyBanksMapId, areaOfMapId: moneyBanksAreaOfMapId, regionHref: moneyBanksRegionHref } = areaRoutes<MoneyBanksArea>(MONEY_BANKS_REGIONS_HREF);

/** An area's list: all loans (the ink reference), then loans in lari and in foreign currency. No headings, no nesting. */
export const moneyBanksAreaSeries = (area: MoneyBanksArea): MoneyBanksSeriesDefinition[] =>
  (["total", "gel", "fx"] as const).map(part => ({ id: loansRegionIndicator(area, part), reference: part === "total" }));

export const moneyBanksAreaDefaultSelection = (area: MoneyBanksArea): string[] => [loansRegionIndicator(area, "total")];

/** The years the area's three series have a value in. */
const areaCoverage = (area: MoneyBanksArea, facts: readonly ClientMoneyBanksFact[]) => {
  const ids = new Set<string>(moneyBanksAreaSeries(area).map(s => s.id));
  return topicCoverage(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year), `No loans by region years for ${area}`);
};

/** Reads the view of the page for `area`. All three rows are in one unit, so any selection is allowed. */
export const parseMoneyBanksAreaHash = (hash: string, area: MoneyBanksArea, facts: readonly ClientMoneyBanksFact[]): TopicState =>
  parseTopicHash(new URLSearchParams(hash.replace(/^#/, "")), moneyBanksAreaSeries(area), moneyBanksAreaDefaultSelection(area), areaCoverage(area, facts));

/** The hash a link to another area's page carries: this page's selection moved to that area (a lari row stays a lari row). The default selection carries none. */
export function moneyBanksAreaSelectionHash(selectedIds: readonly string[], area: MoneyBanksArea): string {
  const moved = [...new Set(selectedIds.map(id => loansRegionIndicator(area, id.split(".")[2] as "total" | "gel" | "fx")))];
  return moved.join(",") === moneyBanksAreaDefaultSelection(area).join(",") ? "" : `#${new URLSearchParams({ sel: moved.join(",") })}`;
}

export function buildMoneyBanksAreaModel(area: MoneyBanksArea, allFacts: readonly ClientMoneyBanksFact[], state: TopicState): MoneyBanksModel {
  const definitions = moneyBanksAreaSeries(area);
  const byCell = new Map(allFacts.map(f => [`${f.indicatorId}:${f.year}`, f]));
  const first = (id: string) => allFacts.find(f => f.indicatorId === id);
  return {
    ...buildTopicModel({ range: state.range, coverage: areaCoverage(area, allFacts), selectedIds: state.selectedIds, color: moneyBanksSeriesColor,
      definitions: definitions.map(definition => ({ ...definition, decimals: first(definition.id)?.decimals ?? 1 })),
      value: (definition, year) => byCell.get(`${definition.id}:${year}`)?.value }),
    unit: first(definitions[0].id)!.unit,
  };
}
