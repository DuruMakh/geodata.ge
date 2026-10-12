import type { ClientTradePartnersData } from "../data/tradePartners/importTradePartners";
import { TRADE_OVERVIEW_INDICATORS, type TradeChartIndicator } from "../data/tradeOverview/types";
import { refitRange, type PeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export type TradePartnersTab = "countries" | "groups" | "types";
export type TradePartnersState = { mode: "line" | "table"; measure: TradeChartIndicator; tab: TradePartnersTab; range: PeriodRange; selectedIds: string[] };
export const TRADE_PARTNER_TOTAL_ID = "goods.total";
export function tradePartnersTotalId(data: Pick<ClientTradePartnersData, "dataset">): "goods.total" | "services.total" {
  return data.dataset === "services" ? "services.total" : TRADE_PARTNER_TOTAL_ID;
}
export const DEFAULT_TRADE_PARTNERS_STATE: TradePartnersState = { mode: "line", measure: "trade.turnover", tab: "countries", range: { kind: "all" }, selectedIds: [TRADE_PARTNER_TOTAL_ID] };

export function tradePartnersCoverage(data: ClientTradePartnersData) {
  const years = [...new Set(data.facts.map(fact => fact[1]))].sort((a, b) => a - b);
  if (!years.length) throw new Error("No trade partner source years");
  return { min: years[0], max: years.at(-1)!, years };
}
export function tradePartnersBulkSelection(data: ClientTradePartnersData): string[] {
  return [tradePartnersTotalId(data), ...data.entities.map(entity => entity.id)];
}
export function parseTradePartnersHash(hash: string, data: ClientTradePartnersData): TradePartnersState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const requested = params.has("sel") ? params.get("sel")!.split(",") : [tradePartnersTotalId(data)];
  const measure = params.get("measure") as TradeChartIndicator, measures = data.measures ?? TRADE_OVERVIEW_INDICATORS;
  return { mode: params.get("view") === "table" ? "table" : "line", measure: measures.some(id => id === measure) ? measure : measures[0], tab: data.dataset === "services" ? "types" : params.get("tab") === "groups" && data.entities.some(entity => entity.kind === "group") ? "groups" : "countries", range: refitRange(parseYearRangeKeys(params), tradePartnersCoverage(data), { collapseToAll: true }), selectedIds: tradePartnersBulkSelection(data).filter(id => requested.includes(id)) };
}
export function serializeTradePartnersHash(state: TradePartnersState, data?: ClientTradePartnersData): string {
  const params = new URLSearchParams({ measure: state.measure, tab: state.tab, view: state.mode, sel: state.selectedIds.join(",") });
  writeYearRangeKeys(params, state.range);
  if (data?.dataset === "services") params.set("section", "types");
  else if (data?.measures) params.set("section", "countries");
  return params.toString();
}
export function setTradePartnersTab(state: TradePartnersState, tab: TradePartnersTab): TradePartnersState {
  return { ...state, tab };
}
