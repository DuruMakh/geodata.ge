import type { ClientCurrentAccountFact } from "../data/externalFlows/importCurrentAccount";
import { CURRENT_ACCOUNT_SERIES, type CurrentAccountFlow, type CurrentAccountSeriesId } from "../data/externalFlows/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { unitFor, type ValueUnit } from "./format";
import { resolveRange, type ResolvedPeriodRange } from "./periodRange";
import { currentAccountCoverage, type CurrentAccountState, type CurrentAccountTab } from "./currentAccountState";

export const CURRENT_ACCOUNT_COLORS: Record<CurrentAccountSeriesId, string> = { "ca.balance": INK, "ca.goods": "#3D5A98", "ca.services": "#1F6E56", "ca.primary_income": "#A5822B", "ca.secondary_income": "#7A4E8C" };
const FLOW_BY_TAB: Record<CurrentAccountTab, CurrentAccountFlow> = { balance: "net", in: "credit", out: "debit" };
export type CurrentAccountGdp = { year: number; valueUsd: number; preliminary: boolean };
export type CurrentAccountSeries = { id: CurrentAccountSeriesId; label: string; color: string };
export type CurrentAccountModel = {
  years: number[]; range: ResolvedPeriodRange; unit: ValueUnit; series: CurrentAccountSeries[]; selectedIds: CurrentAccountSeriesId[];
  valuesById: Record<CurrentAccountSeriesId, Record<number, number | null>>; endValues: Record<CurrentAccountSeriesId, number | null>;
  /** Years in range whose GDP is preliminary, named only when the unit is % of GDP. */
  preliminaryGdpYears: number[];
};

/** The tab picks the flow (net, credit or debit); the unit is nominal USD or a percentage of nominal GDP in USD. */
export function buildCurrentAccountModel(facts: readonly ClientCurrentAccountFact[], gdp: readonly CurrentAccountGdp[], state: CurrentAccountState, presentation: Presentation): CurrentAccountModel {
  const range = resolveRange(state.range, currentAccountCoverage(facts));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
  const flow = FLOW_BY_TAB[state.tab], gdpByYear = new Map(gdp.map(row => [row.year, row]));
  const cells = new Map(facts.filter(fact => fact.flow === flow).map(fact => [`${fact.seriesId}:${fact.year}`, fact.valueUsd]));
  const value = (id: CurrentAccountSeriesId, year: number) => {
    const usd = cells.get(`${id}:${year}`) ?? null, base = gdpByYear.get(year)?.valueUsd;
    if (state.unit === "usd" || usd === null) return usd;
    return base ? (usd / base) * 100 : null;
  };
  const valuesById = Object.fromEntries(CURRENT_ACCOUNT_SERIES.map(id => [id, Object.fromEntries(years.map(year => [year, value(id, year)]))])) as CurrentAccountModel["valuesById"];
  const all = CURRENT_ACCOUNT_SERIES.flatMap(id => years.map(year => valuesById[id][year]).filter((v): v is number => v !== null));
  let unit: ValueUnit;
  if (state.unit === "gdp") unit = { divisor: 1, decimals: 1, label: message(presentation.messages, "main.percentGdp") };
  else {
    const billion = all.some(v => Math.abs(v) >= 1_000_000_000);
    unit = unitFor(all, { divisor: billion ? 1_000_000_000 : 1_000_000, label: message(presentation.messages, billion ? "external.unit.billion" : "external.unit.million"), decimals: 1 });
    unit.decimals = Math.max(1, unit.decimals);
  }
  return {
    years, range, unit, valuesById,
    series: CURRENT_ACCOUNT_SERIES.map(id => ({ id, label: message(presentation.messages, `external.account.series.${id}`), color: CURRENT_ACCOUNT_COLORS[id] })),
    selectedIds: CURRENT_ACCOUNT_SERIES.filter(id => state.selectedIds.includes(id)),
    endValues: Object.fromEntries(CURRENT_ACCOUNT_SERIES.map(id => [id, valuesById[id][range.end]])) as CurrentAccountModel["endValues"],
    preliminaryGdpYears: state.unit === "gdp" ? years.filter(year => gdpByYear.get(year)?.preliminary) : [],
  };
}
