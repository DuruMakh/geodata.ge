import { HOUSING_REGIONS } from "../housing/types";

/** The groups of people the survey breaks each measure into, in the pages' order. Measures on people aged 15+ have no 6-14. */
export const INTERNET_GROUPS = ["total", "urban", "rural", "female", "male", "age_6_14", "age_15_29", "age_30_59", "age_60_plus"] as const;
export const INTERNET_ADULT_GROUPS = INTERNET_GROUPS.filter(group => group !== "age_6_14");
/** The site's 11 regions: the Business and Housing hubs' IDs, in the same order. */
export const INTERNET_REGIONS = HOUSING_REGIONS;
/** Geostat's nine purposes of internet use (table 03), in the pages' order. */
export const INTERNET_ACTIVITIES = ["social", "calls", "news", "email", "health", "goods_info", "jobs", "banking", "software"] as const;
/** Contact with public services over the internet (table 16): any, then its three kinds. */
export const INTERNET_EGOV = ["any", "info", "download_forms", "submit_forms"] as const;
/** Measures of homes, served for Georgia (`total`), towns, villages and the 11 regions. */
export const INTERNET_HOME_MEASURES = ["homes_internet", "homes_computer"] as const;
/** Measures of people, served for every group (`INTERNET_GROUPS`, or `INTERNET_ADULT_GROUPS` for people aged 15+). */
export const INTERNET_PEOPLE_MEASURES = ["used_3m", "never_used", "own_mobile", "own_smartphone", "computer_3m"] as const;
export const INTERNET_ADULT_MEASURES = ["daily", "bought_online"] as const;
type Activity = (typeof INTERNET_ACTIVITIES)[number];
type Egov = (typeof INTERNET_EGOV)[number];
export type InternetMeasure =
  | (typeof INTERNET_HOME_MEASURES)[number] | (typeof INTERNET_PEOPLE_MEASURES)[number] | (typeof INTERNET_ADULT_MEASURES)[number]
  | `activity_${Activity}` | `egov_${Egov}`;
export type InternetGroup = (typeof INTERNET_GROUPS)[number] | (typeof INTERNET_REGIONS)[number];
export type InternetIndicator = `internet.${InternetMeasure}.${InternetGroup}`;
export function internetIndicator(measure: InternetMeasure, group: InternetGroup): InternetIndicator {
  return `internet.${measure}.${group}`;
}
const HOME_GROUPS: readonly InternetGroup[] = ["total", "urban", "rural", ...INTERNET_REGIONS];
/** The 102 served indicators, in the research package's order. */
export const INTERNET_INDICATORS: readonly InternetIndicator[] = [
  ...INTERNET_HOME_MEASURES.flatMap(measure => HOME_GROUPS.map(group => internetIndicator(measure, group))),
  ...(["used_3m", "never_used"] as const).flatMap(measure => INTERNET_GROUPS.map(group => internetIndicator(measure, group))),
  ...INTERNET_ADULT_MEASURES.flatMap(measure => INTERNET_ADULT_GROUPS.map(group => internetIndicator(measure, group))),
  ...INTERNET_ACTIVITIES.map(activity => internetIndicator(`activity_${activity}`, "total")),
  ...INTERNET_EGOV.map(kind => internetIndicator(`egov_${kind}`, "total")),
  ...(["own_mobile", "own_smartphone", "computer_3m"] as const).flatMap(measure => INTERNET_GROUPS.map(group => internetIndicator(measure, group))),
];
/** The ten Geostat tables the observations are read from. */
export const INTERNET_SOURCES = [
  "geostat_ict_homes_internet", "geostat_ict_homes_computer", "geostat_ict_last_internet_use", "geostat_ict_internet_frequency",
  "geostat_ict_ecommerce", "geostat_ict_purposes", "geostat_ict_public_services", "geostat_ict_own_mobile", "geostat_ict_own_smartphone",
  "geostat_ict_last_computer_use",
];
const ENGLISH_TABLES = [
  "geostat_ict_homes_internet", "geostat_ict_last_internet_use", "geostat_ict_purposes", "geostat_ict_internet_frequency", "geostat_ict_ecommerce",
  "geostat_ict_mobile_internet", "geostat_ict_internet_activities", "geostat_ict_homes_computer", "geostat_ict_last_computer_use",
  "geostat_ict_computer_frequency", "geostat_ict_software_activities", "geostat_ict_own_mobile", "geostat_ict_use_mobile",
  "geostat_ict_own_smartphone", "geostat_ict_use_smartphone", "geostat_ict_public_services", "geostat_ict_skills",
];
/** Every archived source: Geostat's 17 tables of the survey in English and Georgian, and the two category pages. */
export const INTERNET_PUBLIC_SOURCES = [...ENGLISH_TABLES.flatMap(id => [id, `${id}_ka`]), "geostat_ict_page", "geostat_ict_page_ka"];
export type InternetFact = {
  year: number;
  indicatorId: InternetIndicator;
  /** Exact decimal: the stored workbook number as text. */
  value: string;
  /** The value rounded half-up to one decimal, as Geostat's cells show it. */
  publishedValue: string;
  unit: "percent";
  basis: "actual";
  valueStatus: "survey_estimate";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientInternetFact = Pick<InternetFact, "year" | "indicatorId" | "sourceId"> & { value: number; unit: "percent"; decimals: 1 };
export type InternetAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function internetFactKey(fact: Pick<InternetFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function internetSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
