import type { ClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_MEASURES } from "../data/tradeProducts/types";
import type { TradeChartIndicator } from "../data/tradeOverview/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";
import { TRADE_PRODUCT_TOTAL_ID, encodeTradeProductsSelection, decodeTradeProductsSelection, tradeProductsBulkSelection } from "./tradeProductsSelection";
export { TRADE_PRODUCT_TOTAL_ID, tradeProductsBulkSelection } from "./tradeProductsSelection";

export type TradeProductsState = { mode: "line" | "table"; measure: TradeChartIndicator; range: PeriodRange; selectedIds: string[] };
export const DEFAULT_TRADE_PRODUCTS_STATE: TradeProductsState = { mode: "line", measure: "trade.exports", range: { kind: "all" }, selectedIds: [TRADE_PRODUCT_TOTAL_ID] };
export function tradeProductsCoverage(data: ClientTradeProductsData, state?: Pick<TradeProductsState, "measure" | "selectedIds">) {
  const years = data.years;
  if (!years.length) throw new Error("No trade product source years");
  if (!state?.selectedIds.length) return { min: years[0], max: years.at(-1)!, years };
  const selected = new Set(state.selectedIds), published = new Set<number>(), numeric = new Set<number>();
  const measureIndex = (data.measures ?? TRADE_PRODUCT_MEASURES).findIndex(id => id === state.measure);
  for (const [entityIndex, year, measure, value] of data.facts) {
    if (!selected.has(data.entities[entityIndex].id)) continue;
    // Some versions exist in only one flow; its source years also locate the unavailable flow.
    published.add(year); if (measure === measureIndex && value !== null) numeric.add(year);
  }
  if (selected.has(TRADE_PRODUCT_TOTAL_ID)) for (const fact of data.nationalFacts) {
    published.add(fact.year); if (fact.indicatorId === state.measure && fact.valueUsd !== null) numeric.add(fact.year);
  }
  const available = numeric.size ? numeric : published;
  const min = available.size ? Math.min(...available) : years[0], max = available.size ? Math.max(...available) : years.at(-1)!;
  return { min, max, years: years.filter(year => year >= min && year <= max) };
}
/** The hidden crawl tables' states (lib/explorer/crawlTables.ts): each measure, every product the bulk action ticks, over every year; a measure without a published value has none. */
export function tradeProductsCrawlStates(data: ClientTradeProductsData): TradeProductsState[] {
  const published = new Set(data.facts.filter(fact => fact[3] !== null).map(fact => fact[2]));
  const selectedIds = tradeProductsBulkSelection(data);
  return (data.measures ?? TRADE_PRODUCT_MEASURES).filter((_, index) => published.has(index as 0 | 1)).map(measure => ({ mode: "line", measure, range: { kind: "all" }, selectedIds }));
}
export function parseTradeProductsHash(hash: string, data: ClientTradeProductsData): TradeProductsState & { selectionReset: boolean } {
  const params = new URLSearchParams(hash.replace(/^#/, "")), measure = params.get("measure") as TradeChartIndicator, measures = data.measures ?? TRADE_PRODUCT_MEASURES;
  const decoded = params.has("sel") ? decodeTradeProductsSelection(params.get("sel")!, data) : { selectedIds: [TRADE_PRODUCT_TOTAL_ID], invalid: false };
  const state: TradeProductsState = { mode: params.get("view") === "table" ? "table" : "line", measure: measures.some(id => id === measure) ? measure : measures[0], range: parseYearRangeKeys(params), selectedIds: decoded.selectedIds };
  return { ...state, range: refitRange(state.range, tradeProductsCoverage(data, state), { collapseToAll: true }), selectionReset: decoded.invalid };
}
export function serializeTradeProductsHash(state: TradeProductsState, data: ClientTradeProductsData): string {
  const params = new URLSearchParams({ measure: state.measure, view: state.mode, sel: encodeTradeProductsSelection(state.selectedIds, data) });
  writeYearRangeKeys(params, state.range); if (data.measures) params.set("section", "products"); return params.toString();
}
