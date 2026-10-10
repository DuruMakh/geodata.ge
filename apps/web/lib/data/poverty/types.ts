export const POVERTY_INDICATORS = [
  "poverty.absolute", "poverty.relative_60", "poverty.relative_40", "poverty.international_300", "poverty.international_420", "poverty.international_830",
  "gini.total_income", "gini.cash_inflows", "gini.total_inflows", "gini.consumption_expenditure", "gini.cash_expenditure", "gini.total_expenditure",
] as const;
export type PovertyIndicator = (typeof POVERTY_INDICATORS)[number];
export const POVERTY_GROUPS = ["georgia", "settlement.urban", "settlement.rural", "age.0_17", "age.18_64", "age.65_plus", "sex.female", "sex.male"] as const;
export type PovertyGroup = (typeof POVERTY_GROUPS)[number];
export const POVERTY_SOURCES = ["geostat_poverty_absolute", "geostat_poverty_relative", "geostat_poverty_international", "geostat_gini"];
export const POVERTY_PUBLIC_SOURCES = [...POVERTY_SOURCES, "geostat_poverty_source_page", "geostat_poverty_metadata_2026", "geostat_hies_metadata_2026"];
export type PovertyFact = {
  year: number;
  indicatorId: PovertyIndicator;
  groupId: PovertyGroup;
  /** Exact stored source decimal. */
  value: string;
  /** The value rounded half-up to the cell's display precision. */
  publishedValue: string;
  unit: "percent" | "index";
  basis: "actual";
  valueStatus: "survey_estimate";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  sourceNumberFormat: string;
  lastReviewedAt: string;
};
export type ClientPovertyFact = Pick<PovertyFact, "year" | "indicatorId" | "groupId" | "sourceId"> & { value: number; decimals: number };
export type PovertyAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function povertyFactKey(fact: Pick<PovertyFact, "indicatorId" | "groupId" | "year">): string {
  return `${fact.indicatorId}:${fact.groupId}:${fact.year}`;
}
export function povertySourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
