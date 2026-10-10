import type { ClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { MONEY_TRANSFER_TOTAL_ID, PERSONAL_TRANSFERS_ID, type MoneyTransferEntity } from "../data/externalFlows/types";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import { INK, SERIES_COLORS } from "./colors";
import { unitFor, type ValueUnit } from "./format";
import { resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { moneyTransfersBulkSelection, moneyTransfersCoverage, type MoneyTransfersState } from "./moneyTransfersState";

const palette = [...new Set(Object.values(SERIES_COLORS))].filter(color => color !== INK);
export function moneyTransferColor(id: string): string {
  if (id === MONEY_TRANSFER_TOTAL_ID) return INK;
  let hash = 0;
  for (const letter of id) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
export type MoneyTransferRankingRow = { entityId: string; label: string; valueUsd: number | null; share: number | null; rank: number | null; monthsReported: number | null; color: string };
export type MoneyTransferFigures = { year: number; received: number | null; sent: number | null; estimate: number | null; receivedShareOfGdp: number | null };
export type MoneyTransfersModel = {
  years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; selectedIds: string[];
  valuesByEntity: Record<string, Record<number, number | null>>; partialMonths: Record<string, Record<number, number>>;
  activeEntities: MoneyTransferEntity[]; offTabSelected: MoneyTransferEntity[];
  ranking: MoneyTransferRankingRow[]; missingRanking: MoneyTransferRankingRow[]; remainders: MoneyTransferRankingRow[];
  figures: MoneyTransferFigures; selectedCount: number; totalCount: number;
};

/** One measure (received or sent) drives every line, the ranking and the table; the four figures always show the end year. */
export function buildMoneyTransfersModel(data: ClientMoneyTransfersData, state: MoneyTransfersState, presentation: Presentation): MoneyTransfersModel {
  const range = resolveRange(state.range, moneyTransfersCoverage(data));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const ids = moneyTransfersBulkSelection(data), selectedIds = ids.filter(id => state.selectedIds.includes(id));
  const cell = (measure: string) => new Map(data.facts.filter(f => f.measure === measure).map(f => [`${f.entityId}:${f.year}`, f]));
  const cells = cell(state.measure);
  const valuesByEntity = Object.fromEntries(ids.map(id => [id, Object.fromEntries(years.map(year => [year, cells.get(`${id}:${year}`)?.valueUsd ?? null]))]));
  const partialMonths: Record<string, Record<number, number>> = {};
  for (const fact of cells.values()) if (fact.valueStatus === "partial_months" && years.includes(fact.year)) (partialMonths[fact.entityId] ??= {})[fact.year] = fact.monthsReported!;
  const values = ids.flatMap(id => years.map(year => valuesByEntity[id][year]).filter((value): value is number => value !== null));
  const billion = values.some(value => Math.abs(value) >= 1_000_000_000);
  const unit = unitFor(values, { divisor: billion ? 1_000_000_000 : 1_000_000, label: message(presentation.messages, billion ? "external.unit.billion" : "external.unit.million"), decimals: 1 });
  unit.decimals = Math.max(1, unit.decimals);
  const georgia = (entity: MoneyTransferEntity) => entity.kind === "total" || entity.kind === "estimate";
  const onTab = (entity: MoneyTransferEntity) => (state.tab === "georgia") === georgia(entity);
  const offTabSelected = data.entities.filter(entity => !onTab(entity) && selectedIds.includes(entity.id));
  const label = (id: string, labelKa: string) => publicLabel(presentation.locale, id, labelKa, presentation.englishLabels);
  const total = valuesByEntity[MONEY_TRANSFER_TOTAL_ID][range.end];
  const row = (entity: MoneyTransferEntity): MoneyTransferRankingRow => {
    const fact = cells.get(`${entity.id}:${range.end}`), valueUsd = fact?.valueUsd ?? null;
    return { entityId: entity.id, label: label(entity.id, entity.labelKa), valueUsd, share: entity.kind === "country" && valueUsd !== null && total !== null && total > 0 ? valueUsd / total : null, rank: null, monthsReported: fact?.valueStatus === "partial_months" ? fact.monthsReported : null, color: moneyTransferColor(entity.id) };
  };
  const labelOrder = (a: MoneyTransferRankingRow, b: MoneyTransferRankingRow) => a.label.localeCompare(b.label, presentation.locale) || a.entityId.localeCompare(b.entityId, "en");
  const countries = data.entities.filter(entity => entity.kind === "country").map(row);
  const ranking = countries.filter(r => r.valueUsd !== null).sort((a, b) => b.valueUsd! - a.valueUsd! || labelOrder(a, b)).map((r, index) => ({ ...r, rank: index + 1 }));
  const remainderEntities = data.entities.filter(entity => entity.kind === "remainder");
  const remainders = remainderEntities.map(row).filter(r => r.valueUsd !== null);
  const missingRanking = [...countries.filter(r => r.valueUsd === null), ...remainderEntities.map(row).filter(r => r.valueUsd === null)].sort(labelOrder);
  // Countries tab: ranked countries, then unavailable ones, then the remainders.
  const order = new Map([...ranking, ...countries.filter(r => r.valueUsd === null).sort(labelOrder)].map((r, index) => [r.entityId, index]));
  const activeEntities = data.entities.filter(onTab);
  if (state.tab === "countries") activeEntities.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  const end = (measure: string, id: string) => cell(measure).get(`${id}:${range.end}`)?.valueUsd ?? null;
  const received = end("received", MONEY_TRANSFER_TOTAL_ID), gdp = data.nominalGdpUsd[range.end];
  const figures = { year: range.end, received, sent: end("sent", MONEY_TRANSFER_TOTAL_ID), estimate: end("received", PERSONAL_TRANSFERS_ID), receivedShareOfGdp: received !== null && gdp ? received / gdp : null };
  return { years, range, unit, selectedIds, valuesByEntity, partialMonths, activeEntities, offTabSelected, ranking, missingRanking, remainders, figures, selectedCount: selectedIds.length, totalCount: ids.length };
}
