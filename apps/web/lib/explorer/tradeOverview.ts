import { type ClientTradeOverviewFact, type TradeChartIndicator } from "../data/tradeOverview/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { unitFor, type ValueUnit } from "./format";
import { resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { tradeOverviewCoverage, tradeOverviewIndicators, type TradeOverviewState } from "./tradeOverviewState";

export const TRADE_OVERVIEW_COLORS: Record<TradeChartIndicator, string> = { "trade.turnover": INK, "trade.exports": "#1F6E56", "trade.imports": "#3D5A98", "trade.balance": "#8A7B65", "trade.domestic_exports": "#3D5A98", "trade.reexports": "#8A7B65" };
export type TradeOverviewModel = {
  years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; selectedIds: TradeChartIndicator[];
  valuesByIndicator: Record<TradeChartIndicator, Record<number, number | null>>;
  endValues: Record<TradeChartIndicator, number | null>; balanceValues: Array<number | null>;
};
export function buildTradeOverviewModel(facts: readonly ClientTradeOverviewFact[], state: TradeOverviewState, presentation: Presentation): TradeOverviewModel {
  const range = resolveRange(state.range, tradeOverviewCoverage(facts));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const byCell = new Map(facts.map(f => [`${f.indicatorId}:${f.year}`, f.valueUsd]));
  const indicators = tradeOverviewIndicators(facts);
  const valuesByIndicator = Object.fromEntries(indicators.map(id => [id, Object.fromEntries(years.map(year => [year, byCell.get(`${id}:${year}`) ?? null]))])) as TradeOverviewModel["valuesByIndicator"];
  const allValues = indicators.flatMap(id => years.map(year => valuesByIndicator[id][year]).filter((v): v is number => v !== null));
  const billion = allValues.some(value => Math.abs(value) >= 1_000_000_000);
  const unit = unitFor(allValues, { divisor: billion ? 1_000_000_000 : 1_000_000, label: message(presentation.messages, billion ? "trade.unit.billion" : "trade.unit.million"), decimals: 1 });
  unit.decimals = Math.max(1, unit.decimals);
  return { range, years, unit, selectedIds: indicators.filter(id => state.selectedIds.includes(id)), valuesByIndicator,
    endValues: Object.fromEntries(indicators.map(id => [id, valuesByIndicator[id][range.end]])) as TradeOverviewModel["endValues"],
    balanceValues: years.map(year => valuesByIndicator["trade.balance"]?.[year] ?? null),
  };
}
