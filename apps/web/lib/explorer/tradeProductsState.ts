import type { ClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_MEASURES, type TradeProductMeasure } from "../data/tradeProducts/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";
import { TRADE_PRODUCT_TOTAL_ID, encodeTradeProductsSelection, decodeTradeProductsSelection } from "./tradeProductsSelection";
export { TRADE_PRODUCT_TOTAL_ID, tradeProductsBulkSelection } from "./tradeProductsSelection";

export type TradeProductsState = { mode: "line" | "table"; measure: TradeProductMeasure; range: PeriodRange; selectedIds: string[] };
export const DEFAULT_TRADE_PRODUCTS_STATE: TradeProductsState = { mode: "line", measure: "trade.exports", range: { kind: "all" }, selectedIds: [TRADE_PRODUCT_TOTAL_ID] };
export function tradeProductsCoverage(data: ClientTradeProductsData, state?: Pick<TradeProductsState, "measure" | "selectedIds">) {
  const years = data.years;
  if (!years.length) throw new Error("No trade product source years");
  if (!state?.selectedIds.length) return { min: years[0], max: years.at(-1)!, years };
  const selected = new Set(state.selectedIds), published = new Set<number>(), numeric = new Set<number>();
  const measureIndex = state.measure === "trade.exports" ? 0 : 1;
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
export function parseTradeProductsHash(hash: string, data: ClientTradeProductsData): TradeProductsState & { selectionReset: boolean } {
  const params = new URLSearchParams(hash.replace(/^#/, "")), measure = params.get("measure") as TradeProductMeasure;
  const decoded = params.has("sel") ? decodeTradeProductsSelection(params.get("sel")!, data) : { selectedIds: [TRADE_PRODUCT_TOTAL_ID], invalid: false };
  const state: TradeProductsState = { mode: params.get("view") === "table" ? "table" : "line", measure: TRADE_PRODUCT_MEASURES.includes(measure) ? measure : "trade.exports", range: parseYearRangeKeys(params), selectedIds: decoded.selectedIds };
  return { ...state, range: refitRange(state.range, tradeProductsCoverage(data, state), { collapseToAll: true }), selectionReset: decoded.invalid };
}
export function serializeTradeProductsHash(state: TradeProductsState, data: ClientTradeProductsData): string {
  const params = new URLSearchParams({ measure: state.measure, view: state.mode, sel: encodeTradeProductsSelection(state.selectedIds, data) });
  writeYearRangeKeys(params, state.range); return params.toString();
}
