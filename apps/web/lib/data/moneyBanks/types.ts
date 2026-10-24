import { BUSINESS_REGIONS } from "../business/types";
import type { BreakRow } from "../demography/breaks";

/** The 11 industries of NBG's loans by economic activity (L3.10.1), in the file's order. */
export const MONEY_BANKS_LOAN_INDUSTRIES = [
  "agriculture", "industry", "construction", "trade", "hotels_restaurants", "transport_communications", "financial", "real_estate", "education", "health_social", "other_services",
] as const;
/** The seven purposes of household loans (LOP, sheet HH), in the file's order. */
export const MONEY_BANKS_LOAN_PURPOSES = ["consumer", "home", "sme", "large_business", "car", "pawn", "other"] as const;
/** Loans by region (LREG): Georgia, then the site's 11 regions. */
export const MONEY_BANKS_LOAN_AREAS = ["georgia", ...BUSINESS_REGIONS] as const;
export function loansRegionIndicator<A extends (typeof MONEY_BANKS_LOAN_AREAS)[number], P extends "total" | "gel" | "fx">(area: A, part: P): `loans_region.${A}.${P}` {
  return `loans_region.${area}.${part}`;
}

/** The 87 served indicators: the 28 of the research package's first cell map, then the 59 loan detail series (23 by borrower and purpose, 36 by area). */
export const MONEY_BANKS_INDICATORS = [
  "money.m3", "money.m2", "money.m1", "money.m0", "money.m3_to_gdp", "money.m2_to_gdp",
  "loans.total", "loans.gel", "loans.fx",
  "deposits.gel", "deposits.fx", "deposits.total", "deposits.individuals", "deposits.legal_entities",
  "loans.fx_share", "deposits.fx_share",
  "rates.policy", "rates.loans_total", "rates.loans_gel", "rates.loans_fx", "rates.deposits_total", "rates.deposits_gel", "rates.deposits_fx",
  "banks.npl_ratio", "banks.roa", "banks.roe", "banks.capital_ratio", "banks.tier1_ratio",
  "borrowers.total", "borrowers.businesses", "borrowers.households", "borrowers.people", "borrowers.individual_entrepreneurs",
  ...MONEY_BANKS_LOAN_INDUSTRIES.map(industry => `borrowers.industry.${industry}` as const),
  ...MONEY_BANKS_LOAN_PURPOSES.map(purpose => `households.purpose.${purpose}` as const),
  ...MONEY_BANKS_LOAN_AREAS.flatMap(area => (["total", "gel", "fx"] as const).map(part => loansRegionIndicator(area, part))),
] as const;
export type MoneyBanksIndicator = (typeof MONEY_BANKS_INDICATORS)[number];
/** The thirteen NBG workbooks the observations are read from. */
export const MONEY_BANKS_SOURCES = [
  "nbg_money_aggregates", "nbg_loans_l3_5", "nbg_deposits_d3_17", "nbg_deposits_individuals_d3_23", "nbg_deposits_legal_d3_27",
  "nbg_policy_rate", "nbg_loan_rates_lwir", "nbg_deposit_rates_dwir", "nbg_fsi_archive", "nbg_fsi",
  "nbg_loans_structure_l3_10_1", "nbg_loans_purpose_lop", "nbg_loans_regions_lreg",
];
/** Every archived source: the workbooks, the four methodology notes, the file listings and the statistics page. */
export const MONEY_BANKS_PUBLIC_SOURCES = [
  ...MONEY_BANKS_SOURCES,
  "nbg_meth_monetary_statistics", "nbg_meth_loans", "nbg_meth_deposits", "nbg_meth_interest_rates",
  "nbg_api_category_15", "nbg_api_category_16", "nbg_api_category_17", "nbg_api_category_19", "nbg_api_category_27",
  "nbg_statistics_page",
];
export type MoneyBanksFact = {
  year: number;
  indicatorId: MoneyBanksIndicator;
  /** Exact decimal: the stored workbook token, or for a calculated row the exact sum or ratio. */
  value: string;
  /** The value rounded half-up to its display precision (one decimal, two for the National Bank rate). */
  publishedValue: string;
  unit: "gel_million" | "percent";
  basis: "actual";
  valueStatus: "official" | "calculated";
  sourceId: string;
  /** The sheet name; for a calculated row the input sheets joined by `+` or `/`. */
  sourceSheet: string;
  /** The cell address; for a calculated row an expression over cell addresses, such as `J29+J29`. */
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientMoneyBanksFact = Pick<MoneyBanksFact, "year" | "indicatorId" | "sourceId" | "valueStatus"> & {
  value: number;
  unit: "gel" | "percent";
  decimals: number;
};
export type MoneyBanksAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
/** One row of `money-banks-series-breaks.csv`, the same columns as demography's break register. */
export type MoneyBanksSeriesBreak = BreakRow;
export function moneyBanksFactKey(fact: Pick<MoneyBanksFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function moneyBanksSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
