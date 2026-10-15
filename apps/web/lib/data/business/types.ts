import type { BreakRow } from "../demography/breaks";

/** The ten served measures: five from the enterprise survey, five from business demography. */
export const BUSINESS_MEASURES = ["turnover", "employed", "investment", "profit", "loss", "active", "births", "deaths", "birth_rate", "death_rate"] as const;
export type BusinessMeasure = (typeof BUSINESS_MEASURES)[number];
export const BUSINESS_SURVEY_MEASURES = ["turnover", "employed", "investment", "profit", "loss"] as const satisfies readonly BusinessMeasure[];
export const BUSINESS_FIRM_COUNT_MEASURES = ["active", "births", "deaths"] as const satisfies readonly BusinessMeasure[];
export const BUSINESS_RATE_MEASURES = ["birth_rate", "death_rate"] as const satisfies readonly BusinessMeasure[];
export const BUSINESS_SIZES = ["size_large", "size_medium", "size_small"] as const;
/** The survey's 14 activity columns (sections B–E are one column, `Industry`). */
export const BUSINESS_SURVEY_SECTORS = [
  "sector_a", "sector_b_e", "sector_f", "sector_g", "sector_h", "sector_i", "sector_j",
  "sector_l", "sector_m", "sector_n", "sector_p", "sector_q", "sector_r", "sector_s",
] as const;
/** Business demography's 18 NACE Rev. 2 sections; O, T and U are out of scope. */
export const BUSINESS_DEMOGRAPHY_SECTORS = [
  "sector_a", "sector_b", "sector_c", "sector_d", "sector_e", "sector_f", "sector_g", "sector_h", "sector_i",
  "sector_j", "sector_k", "sector_l", "sector_m", "sector_n", "sector_p", "sector_q", "sector_r", "sector_s",
] as const;
/** Geostat's `ACTIVITY UNKNOWN` row: part of the firms total but of no section. */
export const BUSINESS_SECTOR_UNKNOWN = "sector_unknown";
/** The site's 11 regions, in `REGIONAL_ECONOMY_REGIONS` order. */
export const BUSINESS_REGIONS = [
  "region_tbilisi", "region_adjara", "region_guria", "region_imereti", "region_kakheti", "region_mtskheta_mtianeti",
  "region_racha_lechkhumi_kvemo_svaneti", "region_samegrelo_zemo_svaneti", "region_samtskhe_javakheti", "region_kvemo_kartli", "region_shida_kartli",
] as const;
/** Firms by region add Abkhazeti AR and an unknown region to the 11, which together add up to the total. */
export const BUSINESS_DEMOGRAPHY_REGIONS = [...BUSINESS_REGIONS, "region_abkhazeti", "region_unknown"] as const;
export type BusinessGroup =
  | "total"
  | (typeof BUSINESS_SIZES)[number]
  | (typeof BUSINESS_SURVEY_SECTORS)[number]
  | (typeof BUSINESS_DEMOGRAPHY_SECTORS)[number]
  | typeof BUSINESS_SECTOR_UNKNOWN
  | (typeof BUSINESS_DEMOGRAPHY_REGIONS)[number];
export type BusinessIndicator = `business.${BusinessMeasure}.${BusinessGroup}`;
export function businessIndicator(measure: BusinessMeasure, group: BusinessGroup): BusinessIndicator {
  return `business.${measure}.${group}`;
}
/** The 284 served indicators, in the research package's cell-map order. */
export const BUSINESS_INDICATORS: readonly BusinessIndicator[] = [
  ...BUSINESS_SURVEY_MEASURES.flatMap(measure => (["total", ...BUSINESS_SIZES, ...BUSINESS_SURVEY_SECTORS, ...BUSINESS_REGIONS] as const).map(group => businessIndicator(measure, group))),
  ...BUSINESS_FIRM_COUNT_MEASURES.flatMap(measure => (["total", ...BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_SECTOR_UNKNOWN, ...BUSINESS_DEMOGRAPHY_REGIONS] as const).map(group => businessIndicator(measure, group))),
  ...BUSINESS_RATE_MEASURES.flatMap(measure => (["total", ...BUSINESS_DEMOGRAPHY_SECTORS, BUSINESS_SECTOR_UNKNOWN] as const).map(group => businessIndicator(measure, group))),
];
/** The five Geostat workbooks the observations are read from. */
export const BUSINESS_SOURCES = [
  "geostat_business_turnover", "geostat_business_employed", "geostat_business_investment", "geostat_business_profit_loss", "geostat_business_demography",
];
/** Every archived source: the served workbooks, the other survey and demography tables, the remarks, the two page captures and Geostat's two metadata documents. */
export const BUSINESS_PUBLIC_SOURCES = [
  ...BUSINESS_SOURCES,
  "geostat_business_production_value", "geostat_business_employees", "geostat_business_earnings", "geostat_business_value_added",
  "geostat_business_intermediate_consumption", "geostat_business_personnel_costs", "geostat_business_purchases", "geostat_business_purchases_for_resale",
  "geostat_business_gender", "geostat_business_fixed_assets", "geostat_business_labour_productivity", "geostat_business_remarks",
  "geostat_business_demography_other", "geostat_business_demography_births", "geostat_business_demography_deaths",
  "geostat_business_survey_page", "geostat_business_demography_page", "geostat_business_survey_metadata", "geostat_business_demography_metadata",
];
export type BusinessFact = {
  year: number;
  indicatorId: BusinessIndicator;
  /** Exact decimal: the stored workbook token. */
  value: string;
  /** The value rounded half-up to its display precision (one decimal for amounts and rates, none for persons and firms). */
  publishedValue: string;
  unit: "gel_million" | "persons" | "enterprises" | "percent";
  basis: "actual";
  valueStatus: "official";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientBusinessFact = Pick<BusinessFact, "year" | "indicatorId" | "sourceId"> & {
  value: number;
  unit: "gel" | "persons" | "enterprises" | "percent";
  decimals: number;
};
export type BusinessAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
/** One row of `business-series-breaks.csv`, the same columns as demography's break register. */
export type BusinessSeriesBreak = BreakRow;
export function businessFactKey(fact: Pick<BusinessFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function businessSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
