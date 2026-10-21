import type { ClientMoneyBanksFact, MoneyBanksIndicator } from "../data/moneyBanks/types";
import type { ClientNationalGdpFact } from "./clientData";
import { shareOfGdp } from "./debtExplorer";
import { refitRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";

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
    // The % of GDP view shows the same four aggregates, divided by GDP (see moneyBanksViewFacts).
    case "amount": case "gdp": return section === "supply" ? flat(["money.m3", "money.m2", "money.m1", "money.m0"])
      : [...withParts("loans.total", true, ["loans.gel", "loans.fx"]), ...withParts("deposits.total", false, ["deposits.gel", "deposits.fx"]), top("deposits.individuals"), top("deposits.legal_entities")];
    case "fx_share": return flat(["loans.fx_share", "deposits.fx_share"]);
    case "main": return section === "bank-health" ? flat(["banks.npl_ratio", "banks.roa", "banks.roe", "banks.capital_ratio", "banks.tier1_ratio"])
      : [top("rates.policy", true), ...withParts("rates.loans_total", false, ["rates.loans_gel", "rates.loans_fx"]), ...withParts("rates.deposits_total", false, ["rates.deposits_gel", "rates.deposits_fx"])];
  }
}

/** Only on Money supply does the first series contain the others (M3 holds M2, M1 and M0); elsewhere it is a peer, so tables and Excel show no total row. */
export const moneyBanksHasTotalRow = (section: MoneyBanksSectionId) => section === "supply";

/** A view's initial selection: its first series, except that Loans and deposits compares the two totals. */
export function moneyBanksDefaultSelection(section: MoneyBanksSectionId, view: MoneyBanksView): string[] {
  return section === "loans-deposits" && view === "amount" ? ["loans.total", "deposits.total"] : [moneyBanksViewSeries(section, view)[0].id];
}

/**
 * The series the foreign-currency switch carries across, as [amount, share] pairs: every loan or deposit amount to its
 * foreign-currency share. A share carries back to its first pair, the total. The % of GDP switch keeps the same ids.
 */
const MEASURE_PAIRS: readonly (readonly [string, string])[] = [
  ...(["loans.total", "loans.gel", "loans.fx"] as const).map(id => [id, "loans.fx_share"] as const),
  ...(["deposits.total", "deposits.gel", "deposits.fx", "deposits.individuals", "deposits.legal_entities"] as const).map(id => [id, "deposits.fx_share"] as const),
];
const counterpart = (id: string) => { const pair = MEASURE_PAIRS.find(([amount, share]) => amount === id || share === id); return pair ? (pair[0] === id ? pair[1] : pair[0]) : id; };

const moneyBanksSeriesColor = (series: MoneyBanksSeriesDefinition, index: number): string => topicSeriesColor(series, index);

export type MoneyBanksState = TopicState & { view: MoneyBanksView };

const cellKey = (f: { indicatorId: string; year: number }) => `${f.indicatorId}:${f.year}`;

/**
 * The values a view shows. The % of GDP view divides each December amount of M3, M2, M1 and M0 by Fiscal.ge's national
 * GDP at current prices for the year, with the debt page's share of GDP, and marks the result calculated; a year without
 * GDP has no value. Every other view shows the facts as they are.
 */
export function moneyBanksViewFacts(view: MoneyBanksView, facts: readonly ClientMoneyBanksFact[], gdpFacts: readonly ClientNationalGdpFact[]): readonly ClientMoneyBanksFact[] {
  if (view !== "gdp") return facts;
  const ids = new Set<string>(moneyBanksViewSeries("supply", "gdp").map(s => s.id));
  const gdpByYear = new Map(gdpFacts.map(f => [f.year, f]));
  return facts.flatMap(f => {
    const share = ids.has(f.indicatorId) ? shareOfGdp(f.value, f.year, gdpByYear) : null;
    return share === null ? [] : [{ ...f, value: share * 100, unit: "percent" as const, decimals: 1, valueStatus: "calculated" as const }];
  });
}

/** A view's years: every year any of its series has a value. */
export function moneyBanksCoverage(section: MoneyBanksSectionId, view: MoneyBanksView, facts: readonly ClientMoneyBanksFact[], gdpFacts: readonly ClientNationalGdpFact[] = []) {
  const ids = new Set<string>(moneyBanksViewSeries(section, view).map(s => s.id));
  return topicCoverage(moneyBanksViewFacts(view, facts, gdpFacts).filter(f => ids.has(f.indicatorId)).map(f => f.year), `No money and banks years for ${section}:${view}`);
}

export function defaultMoneyBanksState(section: MoneyBanksSectionId): MoneyBanksState {
  const view = moneyBanksViews(section)[0];
  return { mode: "line", range: { kind: "all" }, view, selectedIds: moneyBanksDefaultSelection(section, view) };
}

export function parseMoneyBanksHash(hash: string, section: MoneyBanksSectionId, facts: readonly ClientMoneyBanksFact[], gdpFacts: readonly ClientNationalGdpFact[] = []): MoneyBanksState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const view = topicHashView(p, moneyBanksViews(section));
  return { ...parseTopicHash(p, moneyBanksViewSeries(section, view), moneyBanksDefaultSelection(section, view), moneyBanksCoverage(section, view, facts, gdpFacts)), view };
}

export function serializeMoneyBanksHash(state: MoneyBanksState, section: MoneyBanksSectionId): string {
  const p = new URLSearchParams();
  if (moneyBanksViews(section).length > 1) p.set("tab", state.view);
  return serializeTopicHash(state, p);
}

/**
 * Switching view keeps mode and years (clamped to the view's coverage). M3, M2, M1 and M0 keep their selection between
 * the amounts and % of GDP, and loans and deposits carry to and from their foreign-currency shares (a share back to its
 * total); an empty result falls back to the new view's default selection.
 * A chosen range is never collapsed to "all", so 1995–2005 picked on the amounts becomes 1996–2005 on % of GDP
 * and stays 1996–2005 when switching back.
 */
export function changeMoneyBanksView(state: MoneyBanksState, section: MoneyBanksSectionId, view: MoneyBanksView, facts: readonly ClientMoneyBanksFact[], gdpFacts: readonly ClientNationalGdpFact[] = []): MoneyBanksState {
  const carried = new Set(state.selectedIds.map(counterpart));
  const selectedIds = moneyBanksViewSeries(section, view).map(s => s.id).filter(id => carried.has(id));
  return { ...state, view, selectedIds: selectedIds.length ? selectedIds : moneyBanksDefaultSelection(section, view), range: refitRange(state.range, moneyBanksCoverage(section, view, facts, gdpFacts), { collapseToAll: false }) };
}

export type MoneyBanksSeriesModel = TopicSeriesModel<MoneyBanksSeriesDefinition & { decimals: number }>;
export type MoneyBanksModel = { range: ResolvedPeriodRange; years: number[]; series: MoneyBanksSeriesModel[]; selected: MoneyBanksSeriesModel[]; unit: "gel" | "percent" };

export function buildMoneyBanksModel(section: MoneyBanksSectionId, allFacts: readonly ClientMoneyBanksFact[], state: MoneyBanksState, gdpFacts: readonly ClientNationalGdpFact[] = []): MoneyBanksModel {
  const coverage = moneyBanksCoverage(section, state.view, allFacts, gdpFacts);
  const facts = moneyBanksViewFacts(state.view, allFacts, gdpFacts);
  const byCell = new Map(facts.map(f => [cellKey(f), f]));
  const definitions = moneyBanksViewSeries(section, state.view);
  const unit = facts.find(f => f.indicatorId === definitions[0].id)!.unit;
  return {
    ...buildTopicModel({ range: state.range, coverage, selectedIds: state.selectedIds, color: moneyBanksSeriesColor,
      definitions: definitions.map(definition => ({ ...definition, decimals: facts.find(f => f.indicatorId === definition.id)?.decimals ?? 1 })),
      value: (definition, year) => byCell.get(cellKey({ indicatorId: definition.id, year }))?.value }),
    unit,
  };
}
