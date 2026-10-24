import Decimal from "decimal.js";
import { MONEY_BANKS_INDICATORS, MONEY_BANKS_LOAN_AREAS, MONEY_BANKS_LOAN_INDUSTRIES, MONEY_BANKS_LOAN_PURPOSES, MONEY_BANKS_SOURCES, loansRegionIndicator, moneyBanksFactKey, type MoneyBanksFact, type MoneyBanksIndicator } from "./types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);
/** The published first and last year of each indicator (research package coverage.csv). */
const FIRST_MAP_YEARS: Record<string, readonly [number, number]> = {
  "money.m3": [1995, 2025], "money.m2": [1995, 2025], "money.m1": [1995, 2025], "money.m0": [1995, 2025],
  "money.m3_to_gdp": [1996, 2025], "money.m2_to_gdp": [1996, 2025],
  "loans.total": [2002, 2025], "loans.gel": [2002, 2025], "loans.fx": [2002, 2025],
  "deposits.gel": [1996, 2025], "deposits.fx": [1996, 2025], "deposits.total": [1996, 2025],
  "deposits.individuals": [2002, 2025], "deposits.legal_entities": [2015, 2025],
  "loans.fx_share": [2002, 2025], "deposits.fx_share": [1996, 2025],
  "rates.policy": [2008, 2025],
  "rates.loans_total": [1996, 2025], "rates.loans_gel": [1996, 2025], "rates.loans_fx": [1996, 2025],
  "rates.deposits_total": [1996, 2025], "rates.deposits_gel": [1996, 2025], "rates.deposits_fx": [1996, 2025],
  "banks.npl_ratio": [2003, 2025], "banks.roa": [2001, 2025], "banks.roe": [2001, 2025],
  "banks.capital_ratio": [2014, 2025], "banks.tier1_ratio": [2014, 2025],
};
/** Loans by borrower and industry run from December 2003, except households and individual entrepreneurs, which start with the purposes and regions in December 2015. */
const LOAN_FROM_2003 = new Set(["borrowers.total", "borrowers.businesses", "borrowers.people", ...MONEY_BANKS_LOAN_INDUSTRIES.map(industry => `borrowers.industry.${industry}`)]);
const YEARS = Object.fromEntries(MONEY_BANKS_INDICATORS.map(id => [id, FIRST_MAP_YEARS[id] ?? [LOAN_FROM_2003.has(id) ? 2003 : 2015, 2025]])) as Record<MoneyBanksIndicator, readonly [number, number]>;
/** Lari plus foreign-currency deposits, the two shares, each household purpose (its lari and foreign-currency blocks added) and each area's total loans: the only derived values. */
const CALCULATED: readonly string[] = [
  "deposits.total", "deposits.individuals", "deposits.legal_entities", "loans.fx_share", "deposits.fx_share",
  ...MONEY_BANKS_LOAN_PURPOSES.map(purpose => `households.purpose.${purpose}`),
  ...MONEY_BANKS_LOAN_AREAS.map(area => loansRegionIndicator(area, "total")),
];
/** Bank-health values to 2021 come from the archive FSI file and values from 2022 from the current file. */
const LAST_ARCHIVE_YEAR = 2021;
/** Return on assets and equity may be negative (as in 2008); every other percent lies between 0 and 100. */
const SIGNED: readonly string[] = ["banks.roa", "banks.roe"];
const TOLERANCE = new D("0.01");
/** NBG rounds each loan figure on its own, so the loan detail sums hold within half a million lari. */
const LOAN_TOLERANCE = new D("0.5");
/** What NBG shows for 2025, as published. */
const ANCHORS: readonly (readonly [MoneyBanksIndicator, string])[] = [
  ["money.m3", "57680.2"], ["loans.total", "72453.0"], ["rates.policy", "8.00"], ["banks.npl_ratio", "2.5"], ["deposits.fx_share", "48.6"], ["loans.fx_share", "41.9"],
  ["borrowers.total", "69035.7"], ["borrowers.households", "37355.4"], ["loans_region.georgia.total", "71780.2"], ["loans_region.region_tbilisi.total", "52420.1"],
];

function sourceFor(indicatorId: MoneyBanksIndicator, year: number): string {
  if (indicatorId.startsWith("money.")) return "nbg_money_aggregates";
  if (indicatorId.startsWith("borrowers.")) return "nbg_loans_structure_l3_10_1";
  if (indicatorId.startsWith("households.purpose.")) return "nbg_loans_purpose_lop";
  if (indicatorId.startsWith("loans_region.")) return "nbg_loans_regions_lreg";
  if (indicatorId.startsWith("loans.")) return "nbg_loans_l3_5";
  if (indicatorId === "deposits.individuals") return "nbg_deposits_individuals_d3_23";
  if (indicatorId === "deposits.legal_entities") return "nbg_deposits_legal_d3_27";
  if (indicatorId.startsWith("deposits.")) return "nbg_deposits_d3_17";
  if (indicatorId === "rates.policy") return "nbg_policy_rate";
  if (indicatorId.startsWith("rates.loans_")) return "nbg_loan_rates_lwir";
  if (indicatorId.startsWith("rates.deposits_")) return "nbg_deposit_rates_dwir";
  return year <= LAST_ARCHIVE_YEAR ? "nbg_fsi_archive" : "nbg_fsi";
}
const unitFor = (indicatorId: string) => (indicatorId.startsWith("money.") && !indicatorId.endsWith("_to_gdp")) || /^(loans|deposits)\.(total|gel|fx|individuals|legal_entities)$/.test(indicatorId) || /^(borrowers|households|loans_region)\./.test(indicatorId) ? "gel_million" : "percent";

/** Every key the serving package must contain, exactly once. */
export function expectedMoneyBanksKeys(): Set<string> {
  const keys = new Set<string>();
  for (const indicatorId of MONEY_BANKS_INDICATORS) for (const year of range(...YEARS[indicatorId])) keys.add(`${indicatorId}:${year}`);
  return keys;
}

/** Interest rates are shown with two decimals, as NBG prints them; every other value with one. */
export function moneyBanksDisplayDecimals(indicatorId: string): 1 | 2 {
  return indicatorId.startsWith("rates.") ? 2 : 1;
}

export function validateMoneyBanksFacts(facts: readonly MoneyBanksFact[]): void {
  const expected = expectedMoneyBanksKeys();
  const values = new Map<string, Decimal>();
  for (const fact of facts) {
    const key = moneyBanksFactKey(fact);
    if (!MONEY_BANKS_INDICATORS.includes(fact.indicatorId)) throw new Error(`Invalid money and banks identity: ${key}`);
    if (!expected.has(key)) throw new Error(`Money and banks observation outside the approved coverage: ${key}`);
    if (values.has(key)) throw new Error(`Duplicate money and banks observation: ${key}`);
    const calculated = CALCULATED.includes(fact.indicatorId);
    const cellPattern = calculated ? /^[A-Z0-9+/()]+$/ : /^[A-Z]+\d+$/;
    if (fact.unit !== unitFor(fact.indicatorId) || fact.basis !== "actual" || fact.valueStatus !== (calculated ? "calculated" : "official") || fact.sourceId !== sourceFor(fact.indicatorId, fact.year)
      || !fact.sourceSheet || !cellPattern.test(fact.sourceCell) || !/^\d{4}-\d{2}-\d{2}$/.test(fact.lastReviewedAt)) throw new Error(`Invalid money and banks source contract: ${key}`);
    let value: Decimal;
    try { value = new D(fact.value); } catch { throw new Error(`Invalid money and banks value: ${key}`); }
    const low = fact.unit === "gel_million" ? 0 : SIGNED.includes(fact.indicatorId) ? -100 : 0;
    if (!value.isFinite() || value.lt(low) || (fact.unit === "percent" && value.gt(100)) || value.decimalPlaces() > 30) throw new Error(`Money and banks value outside its range or database precision: ${key}`);
    const decimals = moneyBanksDisplayDecimals(fact.indicatorId);
    // Round half-up from the value as Excel displays it (15 significant digits): 8.4499999999999993 shows 8.45 and publishes 8.5.
    if (fact.publishedValue !== value.toSignificantDigits(15).toFixed(decimals)) throw new Error(`Money and banks published value does not match its stored value: ${key}`);
    values.set(key, value);
  }
  const missing = [...expected].filter(key => !values.has(key));
  if (missing.length) throw new Error(`Incomplete money and banks coverage: ${missing.length} missing, first ${missing[0]}`);
  const v = (indicatorId: string, year: number) => values.get(`${indicatorId}:${year}`)!;
  for (const year of range(1995, 2025)) {
    const [m0, m1, m2, m3] = ["money.m0", "money.m1", "money.m2", "money.m3"].map(id => v(id, year));
    if (m0.gt(m1) || m1.gt(m2) || m2.gt(m3)) throw new Error(`Money aggregates out of order: ${year}`);
  }
  // Total deposits are themselves lari plus foreign currency, so for them this restates the calculation; for loans it is an independent check.
  for (const kind of ["loans", "deposits"]) for (const year of range(...YEARS[`${kind}.total` as MoneyBanksIndicator])) {
    if (v(`${kind}.gel`, year).plus(v(`${kind}.fx`, year)).minus(v(`${kind}.total`, year)).abs().gt(TOLERANCE)) throw new Error(`Money and banks lari plus foreign currency differs from total ${kind}: ${year}`);
  }
  for (const year of range(...YEARS["deposits.legal_entities"])) {
    if (v("deposits.individuals", year).plus(v("deposits.legal_entities", year)).minus(v("deposits.total", year)).abs().gt(TOLERANCE)) throw new Error(`Money and banks people plus companies differs from all deposits: ${year}`);
  }
  for (const kind of ["loans", "deposits"]) for (const year of range(...YEARS[`${kind}.fx_share` as MoneyBanksIndicator])) {
    if (v(`${kind}.fx`, year).times(100).div(v(`${kind}.total`, year)).minus(v(`${kind}.fx_share`, year)).abs().gt("1e-9")) throw new Error(`Money and banks calculated share does not follow its amounts: ${kind}.fx_share:${year}`);
  }
  const near = (a: Decimal, b: Decimal) => a.minus(b).abs().lte(LOAN_TOLERANCE);
  for (const year of range(...YEARS["borrowers.total"])) {
    // Up to 2014 NBG splits loans into businesses and people; from 2015 into businesses and households, which are people plus individual entrepreneurs.
    const sectors = year < 2015 ? v("borrowers.businesses", year).plus(v("borrowers.people", year)) : v("borrowers.businesses", year).plus(v("borrowers.households", year));
    if (!near(sectors, v("borrowers.total", year))) throw new Error(`Money and banks borrowers do not add up to all loans: ${year}`);
    if (year >= 2015 && !near(v("borrowers.people", year).plus(v("borrowers.individual_entrepreneurs", year)), v("borrowers.households", year))) throw new Error(`Money and banks borrowers do not add up to all loans: ${year}`);
    if (!near(MONEY_BANKS_LOAN_INDUSTRIES.reduce((sum, industry) => sum.plus(v(`borrowers.industry.${industry}`, year)), new D(0)), v("borrowers.businesses", year))) throw new Error(`Money and banks industries do not add up to businesses: ${year}`);
  }
  for (const year of range(...YEARS["loans_region.georgia.total"])) {
    for (const part of ["gel", "fx"] as const) {
      const regions = MONEY_BANKS_LOAN_AREAS.slice(1).reduce((sum, area) => sum.plus(v(loansRegionIndicator(area, part), year)), new D(0));
      if (!near(regions, v(loansRegionIndicator("georgia", part), year))) throw new Error(`Money and banks regions differ from Georgia: ${part}:${year}`);
    }
    for (const area of MONEY_BANKS_LOAN_AREAS) {
      if (!near(v(loansRegionIndicator(area, "gel"), year).plus(v(loansRegionIndicator(area, "fx"), year)), v(loansRegionIndicator(area, "total"), year))) throw new Error(`Money and banks area lari plus foreign currency differs from its total: ${area}:${year}`);
    }
  }
  for (const [indicatorId, published] of ANCHORS) if (facts.find(f => f.indicatorId === indicatorId && f.year === 2025)!.publishedValue !== published) throw new Error(`Money and banks anchor value changed: ${indicatorId}:2025`);
  if (!MONEY_BANKS_SOURCES.every(id => facts.some(f => f.sourceId === id))) throw new Error("Money and banks source missing from the serving package");
}
