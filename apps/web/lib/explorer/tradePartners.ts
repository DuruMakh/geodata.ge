import type { ClientTradePartnersData } from "../data/tradePartners/importTradePartners";
import type { TradePartnerEntity, TradePartnerKind } from "../data/tradePartners/types";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import { INK, SERIES_COLORS } from "./colors";
import { unitFor, type ValueUnit } from "./format";
import { resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { TRADE_PARTNER_TOTAL_ID, tradePartnersBulkSelection, tradePartnersCoverage, type TradePartnersState } from "./tradePartnersState";

const palette = [...new Set(Object.values(SERIES_COLORS))].filter(color => color !== INK);
export function tradePartnerColor(id: string): string {
  if (id === TRADE_PARTNER_TOTAL_ID) return INK;
  let hash = 0;
  for (const letter of id) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
export type TradePartnerRankingRow = { entityId: string; kind: TradePartnerKind; label: string; valueUsd: number | null; shareOfNational: number | null; rank: number | null; color: string };
export type TradePartnersModel = { years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; selectedIds: string[]; valuesByEntity: Record<string, Record<number, number | null>>; activeEntities: TradePartnerEntity[]; offTabSelected: TradePartnerEntity[]; ranking: TradePartnerRankingRow[]; missingRanking: TradePartnerRankingRow[]; selectedCount: number; totalCount: number };

export function buildTradePartnersModel(data: ClientTradePartnersData, state: TradePartnersState, presentation: Presentation): TradePartnersModel {
  const range = resolveRange(state.range, tradePartnersCoverage(data));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const ids = tradePartnersBulkSelection(data), selectedIds = ids.filter(id => state.selectedIds.includes(id));
  const cells = new Map(data.facts.filter(f => f.indicatorId === state.measure).map(f => [`${f.entityId}:${f.year}`, f.valueUsd]));
  for (const fact of data.nationalFacts) if (fact.indicatorId === state.measure) cells.set(`${TRADE_PARTNER_TOTAL_ID}:${fact.year}`, fact.valueUsd);
  const valuesByEntity = Object.fromEntries(ids.map(id => [id, Object.fromEntries(years.map(year => [year, cells.get(`${id}:${year}`) ?? null]))]));
  const values = ids.flatMap(id => years.map(year => valuesByEntity[id][year]).filter((value): value is number => value !== null));
  const billion = values.some(value => Math.abs(value) >= 1_000_000_000);
  const unit = unitFor(values, { divisor: billion ? 1_000_000_000 : 1_000_000, label: message(presentation.messages, billion ? "trade.unit.billion" : "trade.unit.million"), decimals: 1 });
  unit.decimals = Math.max(1, unit.decimals);
  const kind = state.tab === "countries" ? "country" : "group";
  const activeEntities = data.entities.filter(entity => entity.kind === kind);
  const offTabSelected = data.entities.filter(entity => entity.kind !== kind && selectedIds.includes(entity.id));
  const national = valuesByEntity[TRADE_PARTNER_TOTAL_ID][range.end];
  const rows = activeEntities.map(entity => {
    const valueUsd = valuesByEntity[entity.id][range.end];
    return { entityId: entity.id, kind: entity.kind, label: publicLabel(presentation.locale, entity.id, entity.labelKa, presentation.englishLabels), valueUsd, shareOfNational: state.measure !== "trade.balance" && valueUsd !== null && national !== null && national > 0 ? valueUsd / national : null, rank: null, color: tradePartnerColor(entity.id) };
  });
  const labelOrder = (a: TradePartnerRankingRow, b: TradePartnerRankingRow) => a.label.localeCompare(b.label, presentation.locale) || a.entityId.localeCompare(b.entityId, "en");
  const ranking = rows.filter(row => row.valueUsd !== null).sort((a, b) => (state.measure === "trade.balance" ? Math.abs(b.valueUsd!) - Math.abs(a.valueUsd!) : b.valueUsd! - a.valueUsd!) || labelOrder(a, b)).map((row, index) => ({ ...row, rank: index + 1 }));
  const missingRanking = rows.filter(row => row.valueUsd === null).sort(labelOrder);
  const order = new Map([...ranking, ...missingRanking].map((row, index) => [row.entityId, index]));
  activeEntities.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { years, range, unit, selectedIds, valuesByEntity, activeEntities, offTabSelected, ranking, missingRanking, selectedCount: selectedIds.length, totalCount: ids.length };
}
