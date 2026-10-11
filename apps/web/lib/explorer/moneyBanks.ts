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
/** The views of a page: money supply and loans and deposits switch them with the icon measure switch; interest rates and bank health have one. */
export type MoneyBanksView = "amount" | "gdp" | "fx_share" | "main";
const VIEWS: Record<MoneyBanksSectionId, readonly MoneyBanksView[]> = {
  "supply": ["amount", "gdp"],
  "loans-deposits": ["amount", "fx_share"],
  "interest-rates": ["main"],
  "bank-health": ["main"],
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
export function moneyBanksViewSeries(section: MoneyBanksSectionId, view: MoneyBanksView): MoneyBanksSeriesDefinition[] {
  switch (view) {
    case "amount": return section === "supply" ? flat(["money.m3", "money.m2", "money.m1", "money.m0"])
      : [...withParts("loans.total", true, ["loans.gel", "loans.fx"]), ...withParts("deposits.total", false, ["deposits.gel", "deposits.fx"]), top("deposits.individuals"), top("deposits.legal_entities")];
    case "gdp": return flat(["money.m3_to_gdp", "money.m2_to_gdp"]);
    case "fx_share": return flat(["loans.fx_share", "deposits.fx_share"]);
    case "main": return section === "bank-health" ? flat(["banks.npl_ratio", "banks.roa", "banks.roe", "banks.capital_ratio", "banks.tier1_ratio"])
      : [top("rates.policy", true), ...withParts("rates.loans_total", false, ["rates.loans_gel", "rates.loans_fx"]), ...withParts("rates.deposits_total", false, ["rates.deposits_gel", "rates.deposits_fx"])];
  }
}

/** A view's initial selection: its first series, except that Loans and deposits compares the two totals. */
export function moneyBanksDefaultSelection(section: MoneyBanksSectionId, view: MoneyBanksView): string[] {
  return section === "loans-deposits" && view === "amount" ? ["loans.total", "deposits.total"] : [moneyBanksViewSeries(section, view)[0].id];
}

/**
 * The series the measure switch carries across, as [amount, share] pairs: M3 and M2 to and from NBG's ratios to GDP, and
 * every loan or deposit amount to its foreign-currency share. A share carries back to its first pair, the total.
 */
const MEASURE_PAIRS: readonly (readonly [string, string])[] = [
  ["money.m3", "money.m3_to_gdp"], ["money.m2", "money.m2_to_gdp"],
  ...(["loans.total", "loans.gel", "loans.fx"] as const).map(id => [id, "loans.fx_share"] as const),
  ...(["deposits.total", "deposits.gel", "deposits.fx", "deposits.individuals", "deposits.legal_entities"] as const).map(id => [id, "deposits.fx_share"] as const),
];
const counterpart = (id: string) => { const pair = MEASURE_PAIRS.find(([amount, share]) => amount === id || share === id); return pair && (pair[0] === id ? pair[1] : pair[0]); };

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
  return { mode: "line", range: { kind: "all" }, view, selectedIds: moneyBanksDefaultSelection(section, view) };
}

export function parseMoneyBanksHash(hash: string, section: MoneyBanksSectionId, facts: readonly ClientMoneyBanksFact[]): MoneyBanksState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const views = moneyBanksViews(section);
  const view = views.find(item => item === p.get("tab")) ?? views[0];
  const series = moneyBanksViewSeries(section, view);
  const requested = p.has("sel") ? p.get("sel")!.split(",") : moneyBanksDefaultSelection(section, view);
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
 * Switching view keeps mode and years (clamped to the view's coverage). Selected M3 and M2 carry across to and from
 * their GDP ratios, and loans and deposits to and from their foreign-currency shares (a share back to its total);
 * anything else (and an empty result) falls back to the new view's default selection.
 * A chosen range is never collapsed to "all", so 1995–2005 picked on the amounts becomes 1996–2005 on the GDP ratios
 * and stays 1996–2005 when switching back.
 */
export function changeMoneyBanksView(state: MoneyBanksState, section: MoneyBanksSectionId, view: MoneyBanksView, facts: readonly ClientMoneyBanksFact[]): MoneyBanksState {
  const carried = new Set(state.selectedIds.map(counterpart));
  const selectedIds = moneyBanksViewSeries(section, view).map(s => s.id).filter(id => carried.has(id));
  return { ...state, view, selectedIds: selectedIds.length ? selectedIds : moneyBanksDefaultSelection(section, view), range: refitRange(state.range, moneyBanksCoverage(section, view, facts), { collapseToAll: false }) };
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
