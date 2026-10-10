export const WAGES_INDICATORS = ["average_monthly_nominal_earnings", "median_monthly_earnings"] as const;
export type WagesIndicator = (typeof WAGES_INDICATORS)[number];
export const WAGES_DIMENSIONS = ["national", "sex", "ownership", "business_sector", "region"] as const;
export type WagesDimension = (typeof WAGES_DIMENSIONS)[number];
export const WAGES_SECTORS = ["sector.a", "sector.b", "sector.c", "sector.d", "sector.e", "sector.f", "sector.g", "sector.h", "sector.i", "sector.j", "sector.k", "sector.l", "sector.m", "sector.n", "sector.o", "sector.p", "sector.q", "sector.r", "sector.s"] as const;
export type WagesSector = (typeof WAGES_SECTORS)[number];
export const WAGES_REGIONS = ["region.tbilisi", "region.adjara", "region.guria", "region.imereti", "region.kakheti", "region.mtskheta_mtianeti", "region.racha_lechkhumi_kvemo_svaneti", "region.samegrelo_zemo_svaneti", "region.samtskhe_javakheti", "region.kvemo_kartli", "region.shida_kartli"] as const;
export const WAGES_GROUPS: Record<WagesDimension, readonly string[]> = {
  national: ["georgia"], sex: ["women", "men"], ownership: ["public", "non_public"], business_sector: ["business", "non_business"], region: WAGES_REGIONS,
};
export const WAGES_SOURCES = ["headline", "activity", "sex", "business_sector", "ownership", "region", "median"].map(id => `geostat_earnings_annual_${id}`);
export const WAGES_PUBLIC_SOURCES = [...WAGES_SOURCES, "geostat_wages_source_page", "geostat_earnings_release_2025", "geostat_median_release_2025", "geostat_earnings_metadata_2026", "geostat_median_metadata_2026"];
export type WagesFact = {
  year: number;
  indicatorId: WagesIndicator;
  dimension: WagesDimension;
  groupId: string;
  sectorId: "total" | WagesSector;
  /** Exact stored source decimal; null only for a published unavailable marker. */
  value: string | null;
  /** The value rounded half-up to the cell's display precision. */
  publishedValue: string | null;
  unit: "gel";
  basis: "actual";
  valueStatus: "survey_estimate" | "administrative" | "unavailable";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  sourceNumberFormat: string | null;
  lastReviewedAt: string;
};
export type ClientWagesFact = Pick<WagesFact, "year" | "indicatorId" | "dimension" | "groupId" | "sectorId" | "valueStatus" | "sourceId"> & { value: number | null; decimals: number };
export type WagesAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  numericObservations: number;
  unavailableObservations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function wagesFactKey(fact: Pick<WagesFact, "indicatorId" | "dimension" | "groupId" | "sectorId" | "year">): string {
  return `${fact.indicatorId}:${fact.dimension}:${fact.groupId}:${fact.sectorId}:${fact.year}`;
}
export function wagesSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
