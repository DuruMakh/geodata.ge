import type { ClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import { TRADE_PRODUCT_MEASURES, type TradeProductMeasure } from "../data/tradeProducts/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";
import { TRADE_PRODUCT_TOTAL_ID, encodeTradeProductsSelection, decodeTradeProductsSelection } from "./tradeProductsSelection";
export { TRADE_PRODUCT_TOTAL_ID, tradeProductsBulkSelection } from "./tradeProductsSelection";

export type TradeProductsState = { mode: "line" | "table"; measure: TradeProductMeasure; range: PeriodRange; selectedIds: string[] };
export const DEFAULT_TRADE_PRODUCTS_STATE: TradeProductsState = { mode: "line", measure: "trade.exports", range: { kind: "all" }, selectedIds: [TRADE_PRODUCT_TOTAL_ID] };
export function tradeProductsCoverage(data: ClientTradeProductsData) {
  const years = data.years;
  if (!years.length) throw new Error("No trade product source years");
  return { min: years[0], max: years.at(-1)!, years };
}
export function parseTradeProductsHash(hash: string, data: ClientTradeProductsData): TradeProductsState & { selectionReset: boolean } {
  const params = new URLSearchParams(hash.replace(/^#/, "")), measure = params.get("measure") as TradeProductMeasure;
  const decoded = params.has("sel") ? decodeTradeProductsSelection(params.get("sel")!, data) : { selectedIds: [TRADE_PRODUCT_TOTAL_ID], invalid: false };
  return { mode: params.get("view") === "table" ? "table" : "line", measure: TRADE_PRODUCT_MEASURES.includes(measure) ? measure : "trade.exports", range: refitRange(parseYearRangeKeys(params), tradeProductsCoverage(data), { collapseToAll: true }), selectedIds: decoded.selectedIds, selectionReset: decoded.invalid };
}
export function serializeTradeProductsHash(state: TradeProductsState, data: ClientTradeProductsData): string {
  const params = new URLSearchParams({ measure: state.measure, view: state.mode, sel: encodeTradeProductsSelection(state.selectedIds, data) });
  writeYearRangeKeys(params, state.range); return params.toString();
}
