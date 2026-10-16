import { BUSINESS_REGIONS } from "../business/types";

/** The seven served measures: permits and completed objects (number and square metres), the price index, and Tbilisi district prices for flats and houses. */
export const HOUSING_MEASURES = ["permits_count", "permits_area", "completed_count", "completed_area", "price_index", "price_flat", "price_house"] as const;
export type HousingMeasure = (typeof HOUSING_MEASURES)[number];
export const HOUSING_PERMIT_COMPLETED_MEASURES = ["permits_count", "permits_area", "completed_count", "completed_area"] as const satisfies readonly HousingMeasure[];
export const HOUSING_DISTRICT_MEASURES = ["price_flat", "price_house"] as const satisfies readonly HousingMeasure[];
/** Geostat's 17 building types, in the by-type workbooks' column order. Completed objects have no `holiday_camps` column. */
export const HOUSING_TYPES = [
  "residential", "trade", "administrative", "hotels", "cafes", "industrial", "farm", "fuel", "parking",
  "education", "preschool", "health", "sports", "culture", "pharmacy", "holiday_camps", "other",
] as const;
/** The site's 11 regions: the Business hub's IDs, in the same order. */
export const HOUSING_REGIONS = BUSINESS_REGIONS;
/** The ten Tbilisi districts of Geostat's offer-price workbook. */
export const HOUSING_DISTRICTS = [
  "gldani", "didube", "vake", "isani", "krtsanisi", "mtatsminda", "nadzaladevi", "saburtalo", "samgori", "chughureti",
] as const;
export const HOUSING_PRICE_INDEX_GROUPS = ["total", "flats", "houses"] as const;
type HousingType = (typeof HOUSING_TYPES)[number];
type HousingRegion = (typeof HOUSING_REGIONS)[number];
export type HousingGroup =
  | "total"
  | HousingRegion
  | `${HousingRegion}_residential`
  | `type_${HousingType}`
  | (typeof HOUSING_PRICE_INDEX_GROUPS)[number]
  | `district_${(typeof HOUSING_DISTRICTS)[number]}`;
export type HousingIndicator = `housing.${HousingMeasure}.${HousingGroup}`;
export function housingIndicator(measure: HousingMeasure, group: HousingGroup): HousingIndicator {
  return `housing.${measure}.${group}`;
}
/** Completed objects have no holiday-camps column. */
const typesOf = (measure: HousingMeasure) => HOUSING_TYPES.filter(type => !(measure.startsWith("completed") && type === "holiday_camps"));
const permitsGroups = (measure: HousingMeasure): HousingGroup[] => [
  "total", ...HOUSING_REGIONS, ...typesOf(measure).map(type => `type_${type}` as const), ...HOUSING_REGIONS.map(region => `${region}_residential` as const),
];
/** The 181 served indicators, in the research package's cell-map order. */
export const HOUSING_INDICATORS: readonly HousingIndicator[] = [
  ...HOUSING_PERMIT_COMPLETED_MEASURES.flatMap(measure => permitsGroups(measure).map(group => housingIndicator(measure, group))),
  ...HOUSING_PRICE_INDEX_GROUPS.map(group => housingIndicator("price_index", group)),
  ...HOUSING_DISTRICT_MEASURES.flatMap(measure => HOUSING_DISTRICTS.map(district => housingIndicator(measure, `district_${district}`))),
];
/** The six Geostat workbooks the observations are read from. */
export const HOUSING_SOURCES = [
  "geostat_housing_permits_regions", "geostat_housing_completed_regions", "geostat_housing_permits_types", "geostat_housing_completed_types",
  "geostat_housing_price_index", "geostat_housing_tbilisi_prices",
];
/** Every archived source: the six served workbooks, the zips, municipal and quarterly tables, the other price and cost indices, and the three page captures. */
export const HOUSING_PUBLIC_SOURCES = [
  ...HOUSING_SOURCES,
  "geostat_housing_permits_zip", "geostat_housing_completed_zip", "geostat_housing_permits_municipalities", "geostat_housing_permits_quarterly",
  "geostat_housing_completed_quarterly", "geostat_housing_price_index_quarterly", "geostat_housing_price_index_annual",
  "geostat_housing_cci_monthly", "geostat_housing_cci_2022", "geostat_housing_cci_annual", "geostat_housing_construction", "geostat_housing_infrastructure",
  "geostat_housing_permits_page", "geostat_housing_prices_page", "geostat_housing_cost_page",
];
export type HousingFact = {
  year: number;
  indicatorId: HousingIndicator;
  /** Exact decimal: the stored workbook number as text. */
  value: string;
  /** The value rounded half-up to its display precision (one decimal for the index, none otherwise). */
  publishedValue: string;
  unit: "count" | "square_metres" | "index_2020" | "gel_per_square_metre";
  basis: "actual";
  valueStatus: "official";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientHousingFact = Pick<HousingFact, "year" | "indicatorId" | "sourceId"> & {
  value: number;
  unit: "count" | "area" | "index" | "price";
  decimals: number;
};
export type HousingAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function housingFactKey(fact: Pick<HousingFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
