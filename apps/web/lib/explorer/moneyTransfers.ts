import type { ClientMoneyTransfersData } from "../data/externalFlows/importMoneyTransfers";
import { MONEY_TRANSFER_TOTAL_ID, type MoneyTransferEntity } from "../data/externalFlows/types";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import { INK, SERIES_COLORS } from "./colors";
import { unitFor, type ValueUnit } from "./format";
import { resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { moneyTransfersCoverage, OTHER_COUNTRIES_ID, type MoneyTransfersState } from "./moneyTransfersState";

const TOP_COUNTRIES = 10;

const palette = [...new Set(Object.values(SERIES_COLORS))].filter(color => color !== INK);
export function moneyTransferColor(id: string): string {
  if (id === MONEY_TRANSFER_TOTAL_ID) return INK;
  let hash = 0;
  for (const letter of id) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
export type MoneyTransferRankingRow = { entityId: string; label: string; valueUsd: number | null; share: number | null; rank: number | null; monthsReported: number | null; color: string };
export type MoneyTransferSeries = { id: string; label: string; color: string };
export type MoneyTransfersModel = {
  years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; selectedIds: string[];
  valuesByEntity: Record<string, Record<number, number | null>>; partialMonths: Record<string, Record<number, number>>;
  /** The list the page offers: the all-country total, the end year's top 10 countries, then all other countries together. */
  series: MoneyTransferSeries[];
  ranking: MoneyTransferRankingRow[]; other: MoneyTransferRankingRow | null;
  selectedCount: number; totalCount: number;
};

/** One measure (received or sent) drives every line, the ranking and the table. The top 10 are the end year's largest countries. */
export function buildMoneyTransfersModel(data: ClientMoneyTransfersData, state: MoneyTransfersState, presentation: Presentation): MoneyTransfersModel {
  const range = resolveRange(state.range, moneyTransfersCoverage(data));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const cells = new Map(data.facts.filter(f => f.measure === state.measure).map(f => [`${f.entityId}:${f.year}`, f]));
  const value = (id: string, year: number) => cells.get(`${id}:${year}`)?.valueUsd ?? null;
  const label = (entity: MoneyTransferEntity) => publicLabel(presentation.locale, entity.id, entity.labelKa, presentation.englishLabels);
  const total = data.entities.find(entity => entity.id === MONEY_TRANSFER_TOTAL_ID)!;
  const top = data.entities.filter(entity => entity.kind === "country" && value(entity.id, range.end) !== null)
    .sort((a, b) => value(b.id, range.end)! - value(a.id, range.end)! || label(a).localeCompare(label(b), presentation.locale)).slice(0, TOP_COUNTRIES);
  const topIds = new Set(top.map(entity => entity.id));
  const folded = data.entities.filter(entity => entity.id !== MONEY_TRANSFER_TOTAL_ID && !topIds.has(entity.id));
  const series: MoneyTransferSeries[] = [total, ...top].map(entity => ({ id: entity.id, label: label(entity), color: moneyTransferColor(entity.id) }));
  series.push({ id: OTHER_COUNTRIES_ID, label: message(presentation.messages, "external.money.otherCountries"), color: moneyTransferColor(OTHER_COUNTRIES_ID) });
  const ids = series.map(item => item.id), selectedIds = ids.filter(id => state.selectedIds.includes(id));
  // Other countries is the all-country total less the top 10, so the list always adds up to the total.
  const otherValue = (year: number) => { const all = value(MONEY_TRANSFER_TOTAL_ID, year); return all === null ? null : all - top.reduce((sum, entity) => sum + (value(entity.id, year) ?? 0), 0); };
  const valuesByEntity = Object.fromEntries(ids.map(id => [id, Object.fromEntries(years.map(year => [year, id === OTHER_COUNTRIES_ID ? otherValue(year) : value(id, year)]))]));
  const partialMonths: Record<string, Record<number, number>> = {};
  for (const fact of cells.values()) {
    if (fact.valueStatus !== "partial_months" || !years.includes(fact.year)) continue;
    const id = topIds.has(fact.entityId) || fact.entityId === MONEY_TRANSFER_TOTAL_ID ? fact.entityId : OTHER_COUNTRIES_ID;
    const byYear = (partialMonths[id] ??= {});
    byYear[fact.year] = Math.min(byYear[fact.year] ?? 12, fact.monthsReported!);
  }
  const values = ids.flatMap(id => years.map(year => valuesByEntity[id][year]).filter((v): v is number => v !== null));
  const billion = values.some(v => Math.abs(v) >= 1_000_000_000);
  const unit = unitFor(values, { divisor: billion ? 1_000_000_000 : 1_000_000, label: message(presentation.messages, billion ? "external.unit.billion" : "external.unit.million"), decimals: 1 });
  unit.decimals = Math.max(1, unit.decimals);
  const end = value(MONEY_TRANSFER_TOTAL_ID, range.end);
  const share = (v: number | null) => v !== null && end !== null && end > 0 ? v / end : null;
  const ranking = top.map((entity, index) => {
    const fact = cells.get(`${entity.id}:${range.end}`)!;
    return { entityId: entity.id, label: label(entity), valueUsd: fact.valueUsd, share: share(fact.valueUsd), rank: index + 1, monthsReported: fact.valueStatus === "partial_months" ? fact.monthsReported : null, color: moneyTransferColor(entity.id) };
  });
  const otherEnd = folded.length ? otherValue(range.end) : null;
  const other = otherEnd === null ? null : { entityId: OTHER_COUNTRIES_ID, label: series.at(-1)!.label, valueUsd: otherEnd, share: share(otherEnd), rank: null, monthsReported: null, color: series.at(-1)!.color };
  return { years, range, unit, selectedIds, valuesByEntity, partialMonths, series, ranking, other, selectedCount: selectedIds.length, totalCount: ids.length };
}
