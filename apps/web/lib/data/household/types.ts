import { WAGES_REGIONS } from "../wages/types";

export const HOUSEHOLD_INCOME_INDICATORS = [
  "income.total", "income.wages", "income.self_employment", "income.agriculture_sales", "income.property", "income.pensions_assistance",
  "income.remittances", "income.gifts", "income.non_cash", "income.other_inflows", "income.borrowing_dissaving", "income.property_disposal",
] as const;
export const HOUSEHOLD_SPENDING_INDICATORS = [
  "spending.consumption", "spending.food", "spending.clothing", "spending.household_goods", "spending.health", "spending.housing_utilities",
  "spending.transport", "spending.education", "spending.other_consumption", "spending.non_cash", "spending.non_consumption",
  "spending.agriculture", "spending.transfers", "spending.saving_lending", "spending.property",
] as const;
export const HOUSEHOLD_INDICATORS = [...HOUSEHOLD_INCOME_INDICATORS, ...HOUSEHOLD_SPENDING_INDICATORS] as const;
export type HouseholdIndicator = (typeof HOUSEHOLD_INDICATORS)[number];
export const HOUSEHOLD_AREAS = ["georgia", "settlement.urban", "settlement.rural", ...WAGES_REGIONS] as const;
export type HouseholdArea = (typeof HOUSEHOLD_AREAS)[number];
export const HOUSEHOLD_MEASURES = ["per_household", "per_capita"] as const;
export type HouseholdMeasure = (typeof HOUSEHOLD_MEASURES)[number];
const SOURCE_KINDS = ["income", "spending"] as const;
const SOURCE_MEASURES = ["household", "capita"] as const;
const SOURCE_AREAS = ["national", "settlement", "region"] as const;
/** The 12 workbooks whose cells are served. */
export const HOUSEHOLD_SOURCES: string[] = SOURCE_KINDS.flatMap(kind => SOURCE_MEASURES.flatMap(measure => SOURCE_AREAS.map(area => `geostat_household_${kind}_${measure}_${area}`)));
/** Every source the package archives and the site publishes: the served workbooks, the unserved ones, the page captures and the metadata. */
export const HOUSEHOLD_PUBLIC_SOURCES: string[] = [
  ...HOUSEHOLD_SOURCES,
  ...SOURCE_KINDS.flatMap(kind => SOURCE_AREAS.map(area => `geostat_household_${kind}_population_${area}`)),
  "geostat_household_income_page", "geostat_household_spending_page", "geostat_household_hies_metadata_2026",
];
export type HouseholdFact = {
  year: number;
  indicatorId: HouseholdIndicator;
  areaId: HouseholdArea;
  measure: HouseholdMeasure;
  /** Exact stored source decimal. */
  value: string;
  /** The value rounded to the cell's displayed digits: 15 significant digits, then half-up to one decimal. */
  publishedValue: string;
  unit: "gel_month";
  basis: "actual";
  valueStatus: "survey_estimate";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  sourceNumberFormat: string;
  lastReviewedAt: string;
};
/** No source id: it is derivable with householdSourceId, which keeps the page payload small. */
export type ClientHouseholdFact = Pick<HouseholdFact, "year" | "indicatorId" | "areaId" | "measure"> & { value: number };
export type HouseholdAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function householdFactKey(fact: Pick<HouseholdFact, "indicatorId" | "areaId" | "measure" | "year">): string {
  return `${fact.indicatorId}:${fact.areaId}:${fact.measure}:${fact.year}`;
}
/** The served workbook an observation comes from. */
export function householdSourceId(indicatorId: string, areaId: string, measure: string): string {
  const kind = indicatorId.startsWith("income.") ? "income" : "spending";
  const area = areaId === "georgia" ? "national" : areaId.startsWith("settlement.") ? "settlement" : "region";
  return `geostat_household_${kind}_${measure === "per_capita" ? "capita" : "household"}_${area}`;
}
