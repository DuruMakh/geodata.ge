import { MONEY_BANKS_LOAN_AREAS, MONEY_BANKS_LOAN_INDUSTRIES, MONEY_BANKS_LOAN_PURPOSES, loansRegionIndicator, type ClientMoneyBanksFact, type MoneyBanksIndicator } from "../data/moneyBanks/types";
import { OTHER_COLOR } from "./colors";
import type { ClientNationalGdpFact } from "./clientData";
import { shareOfGdp } from "./debtExplorer";
import { refitRange, type ResolvedPeriodRange } from "./periodRange";
import { buildTopicModel, parseTopicHash, serializeTopicHash, topicCoverage, topicHashView, topicSeriesColor, type TopicSeriesModel, type TopicState } from "./topicSeries";

export const MONEY_BANKS_SECTIONS = [
  { id: "supply", href: "/explorer/money/supply", labelKey: "common.moneySupply" },
  { id: "loans-deposits", href: "/explorer/money/loans-deposits", labelKey: "common.moneyLoansDeposits" },
  { id: "borrowers", href: "/explorer/money/borrowers", labelKey: "common.moneyBorrowers" },
  { id: "regions", href: "/explorer/money/regions", labelKey: "common.moneyRegions" },
  { id: "interest-rates", href: "/explorer/money/interest-rates", labelKey: "common.moneyInterestRates" },
  { id: "bank-health", href: "/explorer/money/bank-health", labelKey: "common.moneyBankHealth" },
] as const;
export type MoneyBanksSectionId = typeof MONEY_BANKS_SECTIONS[number]["id"];
/** The pages of the topic explorer; Loans by region is the index of its area pages (moneyBanksAreas.ts). */
export type MoneyBanksTopicId = Exclude<MoneyBanksSectionId, "regions">;
/** The views of a page: money supply and loans and deposits switch them with the icon measure switch; who borrows, interest rates and bank health have one. */
export type MoneyBanksView = "amount" | "gdp" | "fx_share" | "main";
const VIEWS: Record<MoneyBanksTopicId, readonly MoneyBanksView[]> = {
  "supply": ["amount", "gdp"],
  "loans-deposits": ["amount", "fx_share"],
  "borrowers": ["main"],
  "interest-rates": ["main"],
  "bank-health": ["main"],
};

export function moneyBanksViews(section: MoneyBanksTopicId): readonly MoneyBanksView[] {
  return VIEWS[section];
}

/** On Who borrows the rows under the first fall into three headed groups: the borrowers, the industries and the purposes of household loans. */
export type MoneyBanksHeading = "borrowers" | "industry" | "purpose";
export type MoneyBanksSeriesDefinition = { id: MoneyBanksIndicator; reference: boolean; parentId?: MoneyBanksIndicator; heading?: MoneyBanksHeading };
const top = (id: MoneyBanksIndicator, reference = false): MoneyBanksSeriesDefinition => ({ id, reference });
/** A total followed by the parts that nest under it. */
const withParts = (id: MoneyBanksIndicator, reference: boolean, parts: readonly MoneyBanksIndicator[]): MoneyBanksSeriesDefinition[] =>
  [top(id, reference), ...parts.map(part => ({ id: part, reference: false, parentId: id }))];
const flat = (ids: readonly MoneyBanksIndicator[]) => ids.map((id, index) => top(id, index === 0));
const BORROWER_ROWS = ["borrowers.businesses", "borrowers.households", "borrowers.people", "borrowers.individual_entrepreneurs"] as const;
const BORROWER_INDUSTRY_IDS = MONEY_BANKS_LOAN_INDUSTRIES.map(industry => `borrowers.industry.${industry}` as const);
const BORROWER_PURPOSE_IDS = MONEY_BANKS_LOAN_PURPOSES.map(purpose => `households.purpose.${purpose}` as const);
const headed = (heading: MoneyBanksHeading, ids: readonly MoneyBanksIndicator[]): MoneyBanksSeriesDefinition[] => ids.map(id => ({ ...top(id), heading }));

/** The series a view offers, reference first. */
export function moneyBanksViewSeries(section: MoneyBanksTopicId, view: MoneyBanksView): MoneyBanksSeriesDefinition[] {
  switch (view) {
    // The % of GDP view shows the same four aggregates, divided by GDP (see moneyBanksViewFacts).
    case "amount": case "gdp": return section === "supply" ? flat(["money.m3", "money.m2", "money.m1", "money.m0"])
      : [...withParts("loans.total", true, ["loans.gel", "loans.fx"]), ...withParts("deposits.total", false, ["deposits.gel", "deposits.fx"]), top("deposits.individuals"), top("deposits.legal_entities")];
    case "fx_share": return flat(["loans.fx_share", "deposits.fx_share"]);
    case "main": return section === "borrowers" ? [top("borrowers.total", true), ...headed("borrowers", BORROWER_ROWS), ...headed("industry", BORROWER_INDUSTRY_IDS), ...headed("purpose", BORROWER_PURPOSE_IDS)]
      : section === "bank-health" ? flat(["banks.npl_ratio", "banks.roa", "banks.roe", "banks.capital_ratio", "banks.tier1_ratio"])
      : [top("rates.policy", true), ...withParts("rates.loans_total", false, ["rates.loans_gel", "rates.loans_fx"]), ...withParts("rates.deposits_total", false, ["rates.deposits_gel", "rates.deposits_fx"])];
  }
}

/** Only on Money supply does the first series contain the others (M3 holds M2, M1 and M0); elsewhere it is a peer (Who borrows lists the same loans three ways), so tables and Excel show no total row. */
export const moneyBanksHasTotalRow = (section: MoneyBanksTopicId) => section === "supply";

/** A view's initial selection: its first series, except that Loans and deposits compares the two totals. */
export function moneyBanksDefaultSelection(section: MoneyBanksTopicId, view: MoneyBanksView): string[] {
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

/** The economic-sector key (`sector.*`) of each of NBG's 11 loan industries, so an industry wears the colour it has on the business pages. */
const INDUSTRY_SECTOR_KEYS: Readonly<Record<typeof MONEY_BANKS_LOAN_INDUSTRIES[number], string>> = {
  agriculture: "a", industry: "c", construction: "f", trade: "g", hotels_restaurants: "i", transport_communications: "h", financial: "k", real_estate: "l", education: "p", health_social: "q", other_services: "s",
};
/**
 * The borrower and purpose rows wear fixed palette hexes that no sector colour uses (as Business's size rows do), all 23 rows
 * of the page differing. Other loans is the shared "other" colour, so no other row takes a grey beside it.
 */
const BORROWER_COLORS: Readonly<Record<string, string>> = {
  "borrowers.businesses": "#B3402A", "borrowers.households": "#4A707A", "borrowers.people": "#A5822B", "borrowers.individual_entrepreneurs": "#8C5A32",
  "households.purpose.consumer": "#667722", "households.purpose.home": "#7777AA", "households.purpose.sme": "#4E5D74", "households.purpose.large_business": "#1A8C8A",
  "households.purpose.car": "#5B5347", "households.purpose.pawn": "#A3477A", "households.purpose.other": OTHER_COLOR,
};

export const moneyBanksSeriesColor = (series: MoneyBanksSeriesDefinition, index: number): string => {
  const industry = series.id.startsWith("borrowers.industry.") ? series.id.slice("borrowers.industry.".length) as keyof typeof INDUSTRY_SECTOR_KEYS : null;
  if (industry) return topicSeriesColor(series, index, `sector.${INDUSTRY_SECTOR_KEYS[industry]}`);
  return BORROWER_COLORS[series.id] ?? topicSeriesColor(series, index);
};

/** One row of the register's loan breaks, as the Excel status column marks it: the year its reference date falls in and the series it applies to. */
export type MoneyBanksLoanBreak = { breakId: string; year: number; appliesTo: readonly string[] };
const BORROWER_IDS = ["borrowers.total", ...BORROWER_ROWS, ...BORROWER_INDUSTRY_IDS, ...BORROWER_PURPOSE_IDS];
/** The four loan breaks of `money-banks-series-breaks.csv`, in its order; a test compares them with the register. */
export const MONEY_BANKS_LOAN_BREAKS: readonly MoneyBanksLoanBreak[] = [
  { breakId: "loans_activity_2014", year: 2014, appliesTo: BORROWER_INDUSTRY_IDS },
  { breakId: "loans_overdue_2015", year: 2015, appliesTo: BORROWER_IDS },
  { breakId: "loans_sector_2022", year: 2022, appliesTo: [...BORROWER_ROWS, ...BORROWER_INDUSTRY_IDS, "households.purpose.sme", "households.purpose.large_business"] },
  { breakId: "loans_microbanks_2025", year: 2025, appliesTo: [...BORROWER_IDS, ...MONEY_BANKS_LOAN_AREAS.flatMap(area => (["total", "gel", "fx"] as const).map(part => loansRegionIndicator(area, part)))] },
];

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
export function moneyBanksCoverage(section: MoneyBanksTopicId, view: MoneyBanksView, facts: readonly ClientMoneyBanksFact[], gdpFacts: readonly ClientNationalGdpFact[] = []) {
  const ids = new Set<string>(moneyBanksViewSeries(section, view).map(s => s.id));
  return topicCoverage(moneyBanksViewFacts(view, facts, gdpFacts).filter(f => ids.has(f.indicatorId)).map(f => f.year), `No money and banks years for ${section}:${view}`);
}

export function defaultMoneyBanksState(section: MoneyBanksTopicId): MoneyBanksState {
  const view = moneyBanksViews(section)[0];
  return { mode: "line", range: { kind: "all" }, view, selectedIds: moneyBanksDefaultSelection(section, view) };
}

export function parseMoneyBanksHash(hash: string, section: MoneyBanksTopicId, facts: readonly ClientMoneyBanksFact[], gdpFacts: readonly ClientNationalGdpFact[] = []): MoneyBanksState {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const view = topicHashView(p, moneyBanksViews(section));
  return { ...parseTopicHash(p, moneyBanksViewSeries(section, view), moneyBanksDefaultSelection(section, view), moneyBanksCoverage(section, view, facts, gdpFacts)), view };
}

export function serializeMoneyBanksHash(state: MoneyBanksState, section: MoneyBanksTopicId): string {
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
export function changeMoneyBanksView(state: MoneyBanksState, section: MoneyBanksTopicId, view: MoneyBanksView, facts: readonly ClientMoneyBanksFact[], gdpFacts: readonly ClientNationalGdpFact[] = []): MoneyBanksState {
  const carried = new Set(state.selectedIds.map(counterpart));
  const selectedIds = moneyBanksViewSeries(section, view).map(s => s.id).filter(id => carried.has(id));
  return { ...state, view, selectedIds: selectedIds.length ? selectedIds : moneyBanksDefaultSelection(section, view), range: refitRange(state.range, moneyBanksCoverage(section, view, facts, gdpFacts), { collapseToAll: false }) };
}

export type MoneyBanksSeriesModel = TopicSeriesModel<MoneyBanksSeriesDefinition & { decimals: number }>;
export type MoneyBanksModel = { range: ResolvedPeriodRange; years: number[]; series: MoneyBanksSeriesModel[]; selected: MoneyBanksSeriesModel[]; unit: "gel" | "percent" };

export function buildMoneyBanksModel(section: MoneyBanksTopicId, allFacts: readonly ClientMoneyBanksFact[], state: MoneyBanksState, gdpFacts: readonly ClientNationalGdpFact[] = []): MoneyBanksModel {
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
