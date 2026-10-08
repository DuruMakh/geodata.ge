import { TRADE_OVERVIEW_INDICATORS, type ClientTradeOverviewFact, type TradeOverviewIndicator } from "../data/tradeOverview/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export type TradeOverviewState = { mode: "line" | "table"; range: PeriodRange; selectedIds: TradeOverviewIndicator[] };
export const DEFAULT_TRADE_OVERVIEW_STATE: TradeOverviewState = { mode: "line", range: { kind: "all" }, selectedIds: ["trade.turnover"] };
export function tradeOverviewCoverage(facts: readonly ClientTradeOverviewFact[]) {
  const years = [...new Set(facts.map(f => f.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error("No Trade Overview source years");
  return { min: years[0], max: years.at(-1)!, years };
}
export function parseTradeOverviewHash(hash: string, facts: readonly ClientTradeOverviewFact[]): TradeOverviewState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const requested = p.has("sel") ? p.get("sel")!.split(",") : ["trade.turnover"];
  return { mode: p.get("view") === "table" ? "table" : "line", range: refitRange(parseYearRangeKeys(p), tradeOverviewCoverage(facts), { collapseToAll: true }), selectedIds: TRADE_OVERVIEW_INDICATORS.filter(id => requested.includes(id)) };
}
export function serializeTradeOverviewHash(state: TradeOverviewState): string {
  const p = new URLSearchParams({ view: state.mode, sel: state.selectedIds.join(",") });
  writeYearRangeKeys(p, state.range);
  return p.toString();
}
