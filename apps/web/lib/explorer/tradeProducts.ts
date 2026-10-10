import type { ClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import type { TradeProductEntity } from "../data/tradeProducts/types";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import { unitFor, type ValueUnit } from "./format";
import { resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { tradePartnerColor } from "./tradePartners";
import { TRADE_PRODUCT_TOTAL_ID, tradeProductsBulkSelection, tradeProductsCoverage, type TradeProductsState } from "./tradeProductsState";

export const tradeProductColor = tradePartnerColor;
export function tradeProductLabel(entity: TradeProductEntity, presentation: Presentation): string {
  return `${publicLabel(presentation.locale, entity.id, entity.labelKa, presentation.englishLabels)} · ${entity.code} · ${entity.sourceBlock.replace("-", "–")}`;
}
export type TradeProductRankingRow = { entityId: string; label: string; valueUsd: number | null; shareOfNational: number | null; rank: number | null; color: string };
export type TradeProductsModel = { years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; selectedIds: string[]; valuesByEntity: Record<string, Record<number, number | null>>; ranking: TradeProductRankingRow[]; missingRanking: TradeProductRankingRow[]; selectedCount: number; totalCount: number };

export function buildTradeProductsModel(data: ClientTradeProductsData, state: TradeProductsState, presentation: Presentation): TradeProductsModel {
  const range = resolveRange(state.range, tradeProductsCoverage(data)), years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const ids = tradeProductsBulkSelection(data), selected = new Set(state.selectedIds), selectedIds = ids.filter(id => selected.has(id));
  const valuesByEntity: TradeProductsModel["valuesByEntity"] = Object.fromEntries(ids.map(id => [id, Object.fromEntries(years.map(year => [year, null]))]));
  const measureIndex = state.measure === "trade.exports" ? 0 : 1;
  for (const [entityIndex, year, measure, value] of data.facts) {
    if (measure === measureIndex && year >= range.start && year <= range.end) valuesByEntity[data.entities[entityIndex].id][year] = value;
  }
  for (const fact of data.nationalFacts) if (fact.indicatorId === state.measure && fact.year >= range.start && fact.year <= range.end) valuesByEntity[TRADE_PRODUCT_TOTAL_ID][fact.year] = fact.valueUsd;
  const values = Object.values(valuesByEntity).flatMap(cells => Object.values(cells)).filter((value): value is number => value !== null);
  const billion = values.some(value => Math.abs(value) >= 1_000_000_000);
  const unit = unitFor(values, { divisor: billion ? 1_000_000_000 : 1_000_000, label: message(presentation.messages, billion ? "trade.unit.billion" : "trade.unit.million"), decimals: 1 });
  unit.decimals = Math.max(1, unit.decimals);
  const national = valuesByEntity[TRADE_PRODUCT_TOTAL_ID][range.end];
  const rows: TradeProductRankingRow[] = data.entities.map(entity => {
    const valueUsd = valuesByEntity[entity.id][range.end];
    return { entityId: entity.id, label: tradeProductLabel(entity, presentation), valueUsd, shareOfNational: valueUsd !== null && national !== null && national > 0 ? valueUsd / national : null, rank: null, color: tradeProductColor(entity.id) };
  });
  const labelOrder = (a: TradeProductRankingRow, b: TradeProductRankingRow) => a.label.localeCompare(b.label, presentation.locale) || a.entityId.localeCompare(b.entityId, "en");
  const ranking = rows.filter(row => row.valueUsd !== null).sort((a, b) => b.valueUsd! - a.valueUsd! || labelOrder(a, b)).map((row, index) => ({ ...row, rank: index + 1 }));
  const missingRanking = rows.filter(row => row.valueUsd === null).sort(labelOrder);
  return { years, range, unit, selectedIds, valuesByEntity, ranking, missingRanking, selectedCount: selectedIds.length, totalCount: ids.length };
}
