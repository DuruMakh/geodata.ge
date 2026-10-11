import type { ClientMoneyBanksFact, MoneyBanksIndicator } from "../data/moneyBanks/types";
import { colorForItem, INK } from "./colors";
import { resolveRange, refitRange, type PeriodRange, type ResolvedPeriodRange } from "./periodRange";
import { parseYearRangeKeys, writeYearRangeKeys } from "./urlState";

export const MONEY_BANKS_SECTIONS = [
  { id: "supply", href: "/explorer/money/supply", labelKey: "common.moneySupply" },
  { id: "loans-deposits", href: "/explorer/money/loans-deposits", labelKey: "common.moneyLoansDeposits" },
  { id: "interest-rates", href: "/explorer/money/interest-rates", labelKey: "common.moneyInterestRates" },
  { id: "bank-health", href: "/explorer/money/bank-health", labelKey: "common.moneyBankHealth" },
] as const;
export type MoneyBanksSectionId = typeof MONEY_BANKS_SECTIONS[number]["id"];
/** The tabs of a page; the interest-rates page has one view. */
export type MoneyBanksView = "amount" | "gdp" | "loans" | "deposits" | "fx_share" | "main" | "npl" | "profits" | "capital";
const VIEWS: Record<MoneyBanksSectionId, readonly MoneyBanksView[]> = {
  "supply": ["amount", "gdp"],
  "loans-deposits": ["loans", "deposits", "fx_share"],
  "interest-rates": ["main"],
  "bank-health": ["npl", "profits", "capital"],
};

export function moneyBanksViews(section: MoneyBanksSectionId): readonly MoneyBanksView[] {
  return VIEWS[section];
}

export type MoneyBanksSeriesDefinition = { id: MoneyBanksIndicator; reference: boolean; parentId?: MoneyBanksIndicator };
const top = (id: MoneyBanksIndicator, reference = false): MoneyBanksSeriesDefinition => ({ id, reference });
/** A total followed by the parts that nest under it. */
const withParts = (id: MoneyBanksIndicator, reference: boolean, parts: readonly MoneyBanksIndicator[]): MoneyBanksSeriesDefinition[] =>
  [top(id, reference), ...parts.map(part => ({ id: part, reference: false, parentId: id }))];
const flat = (ids: readonly MoneyBanksIndicator[]) => ids.map((id, index) => top(id, index === 0));

/** The series a view offers, reference first. */
export function moneyBanksViewSeries(_section: MoneyBanksSectionId, view: MoneyBanksView): MoneyBanksSeriesDefinition[] {
  switch (view) {
    case "amount": return flat(["money.m3", "money.m2", "money.m1", "money.m0"]);
    case "gdp": return flat(["money.m3_to_gdp", "money.m2_to_gdp"]);
    case "loans": return withParts("loans.total", true, ["loans.gel", "loans.fx"]);
    case "deposits": return [...withParts("deposits.total", true, ["deposits.gel", "deposits.fx"]), top("deposits.individuals"), top("deposits.legal_entities")];
    case "fx_share": return flat(["loans.fx_share", "deposits.fx_share"]);
    case "main": return [top("rates.policy", true), ...withParts("rates.loans_total", false, ["rates.loans_gel", "rates.loans_fx"]), ...withParts("rates.deposits_total", false, ["rates.deposits_gel", "rates.deposits_fx"])];
    case "npl": return flat(["banks.npl_ratio"]);
    case "profits": return flat(["banks.roe", "banks.roa"]);
    case "capital": return flat(["banks.capital_ratio", "banks.tier1_ratio"]);
  }
}

export function moneyBanksSeriesColor(series: MoneyBanksSeriesDefinition, index: number): string {
  return series.reference ? INK : colorForItem(series.id, index);
}

export type MoneyBanksState = { mode: "line" | "table"; range: PeriodRange; view: MoneyBanksView; selectedIds: string[] };

const cellKey = (f: { indicatorId: string; year: number }) => `${f.indicatorId}:${f.year}`;

/** A view's years: every year any of its series has a value. */
export function moneyBanksCoverage(section: MoneyBanksSectionId, view: MoneyBanksView, facts: readonly ClientMoneyBanksFact[]) {
  const ids = new Set<string>(moneyBanksViewSeries(section, view).map(s => s.id));
  const years = [...new Set(facts.filter(f => ids.has(f.indicatorId)).map(f => f.year))].sort((a, b) => a - b);
  if (!years.length) throw new Error(`No money and banks years for ${section}:${view}`);
  return { min: years[0], max: years.at(-1)!, years };
}

export function defaultMoneyBanksState(section: MoneyBanksSectionId): MoneyBanksState {
  const view = moneyBanksViews(section)[0];
  return { mode: "line", range: { kind: "all" }, view, selectedIds: [moneyBanksViewSeries(section, view)[0].id] };
}

export function parseMoneyBanksHash(hash: string, section: MoneyBanksSectionId, facts: readonly ClientMoneyBanksFact[]): MoneyBanksState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const views = moneyBanksViews(section);
  const view = views.find(item => item === p.get("tab")) ?? views[0];
  const series = moneyBanksViewSeries(section, view);
  const requested = p.has("sel") ? p.get("sel")!.split(",") : [series[0].id];
  return {
    mode: p.get("view") === "table" ? "table" : "line", view,
    range: refitRange(parseYearRangeKeys(p), moneyBanksCoverage(section, view, facts), { collapseToAll: true }),
    selectedIds: series.map(s => s.id).filter(id => requested.includes(id)),
  };
}

export function serializeMoneyBanksHash(state: MoneyBanksState, section: MoneyBanksSectionId): string {
  const p = new URLSearchParams();
  if (moneyBanksViews(section).length > 1) p.set("tab", state.view);
  p.set("view", state.mode);
  p.set("sel", state.selectedIds.join(","));
  writeYearRangeKeys(p, state.range);
  return p.toString();
}

/**
 * Switching tab keeps mode and years (clamped to the tab's coverage), and selects the new tab's reference.
 * A chosen range is never collapsed to "all", so 2005–2025 picked on Bad loans becomes 2014–2025 on Capital
 * and stays 2014–2025 when switching back.
 */
export function changeMoneyBanksView(state: MoneyBanksState, section: MoneyBanksSectionId, view: MoneyBanksView, facts: readonly ClientMoneyBanksFact[]): MoneyBanksState {
  return { ...state, view, selectedIds: [moneyBanksViewSeries(section, view)[0].id], range: refitRange(state.range, moneyBanksCoverage(section, view, facts), { collapseToAll: false }) };
}

export type MoneyBanksSeriesModel = MoneyBanksSeriesDefinition & { color: string; valuesByYear: Record<number, number | null>; endValue: number | null; decimals: number };
export type MoneyBanksModel = { range: ResolvedPeriodRange; years: number[]; series: MoneyBanksSeriesModel[]; selected: MoneyBanksSeriesModel[]; unit: "gel" | "percent" };

export function buildMoneyBanksModel(section: MoneyBanksSectionId, facts: readonly ClientMoneyBanksFact[], state: MoneyBanksState): MoneyBanksModel {
  const range = resolveRange(state.range, moneyBanksCoverage(section, state.view, facts));
  const years = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  const definitions = moneyBanksViewSeries(section, state.view);
  const series = definitions.map((definition, index) => {
    const valuesByYear = Object.fromEntries(years.map(year => [year, byCell.get(cellKey({ indicatorId: definition.id, year }))?.value ?? null]));
    const decimals = facts.find(f => f.indicatorId === definition.id)?.decimals ?? 1;
    return { ...definition, color: moneyBanksSeriesColor(definition, index), valuesByYear, endValue: valuesByYear[range.end], decimals };
  });
  const unit = facts.find(f => f.indicatorId === definitions[0].id)!.unit;
  return { range, years, series, selected: series.filter(s => state.selectedIds.includes(s.id)), unit };
}
