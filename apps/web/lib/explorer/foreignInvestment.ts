import type { ClientForeignInvestmentData } from "../data/externalFlows/importForeignInvestment";
import { FOREIGN_INVESTMENT_TOTAL_ID, type ForeignInvestmentEntity } from "../data/externalFlows/types";
import type { Presentation } from "../i18n/types";
import { publicLabel } from "../i18n/labels";
import { message } from "../i18n/messages";
import { unitFor, type ValueUnit } from "./format";
import { resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { moneyTransferColor } from "./moneyTransfers";
import { FOREIGN_INVESTMENT_OTHERS_ID, foreignInvestmentCoverage, type ForeignInvestmentState } from "./foreignInvestmentState";

const TOP_COUNTRIES = 10;

/** The same stable per-id colour rule as Money from abroad; the total is ink. */
export const foreignInvestmentColor = (id: string): string => moneyTransferColor(id === FOREIGN_INVESTMENT_TOTAL_ID ? "transfer.total" : id);
export type ForeignInvestmentRankingRow = { entityId: string; label: string; valueUsd: number | null; share: number | null; rank: number | null; color: string };
export type ForeignInvestmentSeries = { id: string; label: string; color: string };
export type ForeignInvestmentModel = {
  years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; selectedIds: string[];
  valuesByEntity: Record<string, Record<number, number | null>>;
  /** The list the tab offers: the total first, then its items (on the country tab the end year's top 10 and Other countries). */
  series: ForeignInvestmentSeries[];
  ranking: ForeignInvestmentRankingRow[]; other: ForeignInvestmentRankingRow | null;
  selectedCount: number; totalCount: number;
};

export function buildForeignInvestmentModel(data: ClientForeignInvestmentData, state: ForeignInvestmentState, presentation: Presentation): ForeignInvestmentModel {
  const range = resolveRange(state.range, foreignInvestmentCoverage(data, state.dimension));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const cells = new Map(data.facts.map(f => [`${f.entityId}:${f.year}`, f.valueUsd]));
  const value = (id: string, year: number) => cells.get(`${id}:${year}`) ?? null;
  const label = (entity: ForeignInvestmentEntity) => publicLabel(presentation.locale, entity.id, entity.labelKa, presentation.englishLabels);
  const byValue = (a: ForeignInvestmentEntity, b: ForeignInvestmentEntity) => value(b.id, range.end)! - value(a.id, range.end)! || label(a).localeCompare(label(b), presentation.locale);
  const total = data.entities.find(entity => entity.id === FOREIGN_INVESTMENT_TOTAL_ID)!;
  const items = data.entities.filter(entity => entity.dimension === state.dimension);
  const country = state.dimension === "country";
  // Countries fold into the end year's top 10 and Other countries; sectors and regions are short fixed lists shown in full.
  const listed = country ? items.filter(entity => entity.kind === "country" && value(entity.id, range.end) !== null).sort(byValue).slice(0, TOP_COUNTRIES) : items;
  const series: ForeignInvestmentSeries[] = [total, ...listed].map(entity => ({ id: entity.id, label: label(entity), color: foreignInvestmentColor(entity.id) }));
  if (country) series.push({ id: FOREIGN_INVESTMENT_OTHERS_ID, label: message(presentation.messages, "external.investment.otherCountries"), color: foreignInvestmentColor(FOREIGN_INVESTMENT_OTHERS_ID) });
  const ids = series.map(item => item.id), selectedIds = ids.filter(id => state.selectedIds.includes(id));
  // Other countries is the total less the top 10, so the list always adds up to the total.
  const otherValue = (year: number) => { const all = value(FOREIGN_INVESTMENT_TOTAL_ID, year); return all === null ? null : all - listed.reduce((sum, entity) => sum + (value(entity.id, year) ?? 0), 0); };
  const valuesByEntity = Object.fromEntries(ids.map(id => [id, Object.fromEntries(years.map(year => [year, id === FOREIGN_INVESTMENT_OTHERS_ID ? otherValue(year) : value(id, year)]))]));
  const values = ids.flatMap(id => years.map(year => valuesByEntity[id][year]).filter((v): v is number => v !== null));
  const billion = values.some(v => Math.abs(v) >= 1_000_000_000);
  const unit = unitFor(values, { divisor: billion ? 1_000_000_000 : 1_000_000, label: message(presentation.messages, billion ? "external.unit.billion" : "external.unit.million"), decimals: 1 });
  unit.decimals = Math.max(1, unit.decimals);
  const end = value(FOREIGN_INVESTMENT_TOTAL_ID, range.end);
  const share = (v: number | null) => v !== null && end !== null && end > 0 ? v / end : null;
  const ranking = listed.filter(entity => value(entity.id, range.end) !== null).sort(byValue).map((entity, index) => {
    const v = value(entity.id, range.end);
    return { entityId: entity.id, label: label(entity), valueUsd: v, share: share(v), rank: index + 1, color: foreignInvestmentColor(entity.id) };
  });
  const otherEnd = country ? otherValue(range.end) : null;
  const other = otherEnd === null ? null : { entityId: FOREIGN_INVESTMENT_OTHERS_ID, label: series.at(-1)!.label, valueUsd: otherEnd, share: share(otherEnd), rank: null, color: series.at(-1)!.color };
  return { years, range, unit, selectedIds, valuesByEntity, series, ranking, other, selectedCount: selectedIds.length, totalCount: ids.length };
}
