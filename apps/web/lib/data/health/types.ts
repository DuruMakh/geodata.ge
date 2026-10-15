import type { BreakRow } from "../demography/breaks";
import { WAGES_REGIONS } from "../wages/types";

export const HEALTH_INDICATORS = [
  "health.staff.doctors", "health.staff.doctors_internal", "health.staff.doctors_surgery", "health.staff.doctors_obgyn", "health.staff.doctors_paediatrics",
  "health.staff.doctors_eye", "health.staff.doctors_ent", "health.staff.doctors_neurology", "health.staff.doctors_psychiatry", "health.staff.doctors_tuberculosis",
  "health.staff.doctors_dermatovenereology", "health.staff.doctors_radiology", "health.staff.doctors_rehabilitation", "health.staff.doctors_dentistry", "health.staff.doctors_other",
  "health.staff.nurses", "health.staff.nurses_midwives", "health.staff.nurses_medical", "health.staff.nurses_doctor_assistants",
  "health.staff.nurses_lab_assistants", "health.staff.nurses_xray_assistants", "health.staff.nurses_other",
  "health.facilities.hospitals", "health.facilities.outpatient_clinics", "health.facilities.beds", "health.visits.outpatient",
  "health.illness.infectious", "health.illness.cancer", "health.illness.blood", "health.illness.endocrine", "health.illness.mental",
  "health.illness.nervous_sense_organs", "health.illness.nervous", "health.illness.eye", "health.illness.ear", "health.illness.circulatory",
  "health.illness.respiratory", "health.illness.digestive", "health.illness.skin", "health.illness.musculoskeletal", "health.illness.urogenital",
  "health.illness.pregnancy", "health.illness.perinatal", "health.illness.congenital", "health.illness.injuries",
  "health.illness.tuberculosis", "health.illness.hiv", "health.illness.diabetes", "health.illness.anaemia", "health.illness.syphilis", "health.illness.gonorrhoea",
  "health.deaths.total", "health.deaths.infectious", "health.deaths.cancer", "health.deaths.blood", "health.deaths.endocrine", "health.deaths.mental",
  "health.deaths.nervous", "health.deaths.eye", "health.deaths.ear", "health.deaths.circulatory", "health.deaths.respiratory", "health.deaths.digestive",
  "health.deaths.skin", "health.deaths.musculoskeletal", "health.deaths.urogenital", "health.deaths.pregnancy", "health.deaths.perinatal",
  "health.deaths.congenital", "health.deaths.ill_defined", "health.deaths.external", "health.deaths.covid19",
  "health.death_rate.total",
] as const;
export type HealthIndicator = (typeof HEALTH_INDICATORS)[number];

/** Georgia and the 11 regions. Only `health.deaths.*` and `health.death_rate.total` have regional rows; Abkhazia is never served. */
export const HEALTH_AREAS = ["georgia", ...WAGES_REGIONS] as const;
export type HealthArea = (typeof HEALTH_AREAS)[number];

export const HEALTH_UNITS = ["persons", "persons_thousand", "units", "units_thousand", "visits_thousand", "per_1000_population"] as const;
export type HealthUnit = (typeof HEALTH_UNITS)[number];

/** The workbooks the reviewed values are read from. */
export const HEALTH_SOURCES = [
  "geostat_health_physicians", "geostat_health_nurses", "geostat_health_main", "geostat_health_morbidity_groups", "geostat_health_tuberculosis",
  "geostat_health_hiv", "geostat_health_diabetes", "geostat_health_anaemia", "geostat_health_sti", "geostat_deaths_by_cause_region", "geostat_death_rate_region",
];
/** Every archived source: the served workbooks, the 23 archived-only workbooks and the two page captures. */
export const HEALTH_PUBLIC_SOURCES = [
  ...HEALTH_SOURCES,
  "geostat_health_abortions", "geostat_health_morbidity_of_children_0_14_years_old_with_acute_and_chronic_diseases",
  "geostat_health_morbidity_caused_by_some_infectious_disease", "geostat_health_emergent_medical_care", "geostat_health_circulatory_system",
  "geostat_health_respiratory_system", "geostat_health_16_number_of_persons_medicines", "geostat_health_17_the_cost_of_medicines",
  "geostat_health_18_the_number_of_beneficiaries_with_disabilities", "geostat_health_19_number_of_cases_services_of_persons_with_disabilities",
  "geostat_health_20_number_of_cases_services_of_persons_with_disabilities_by_regions", "geostat_health_number_of_beneficiaries_screened_for_malignant_neoplasms",
  "geostat_deaths_25_1_infant_mortality_rate_by_regions_and_sex", "geostat_deaths_26_1_under_5_mortality_rate_by_regions_andsex",
  "geostat_deaths_23_1_deaths_by_chapters_sex", "geostat_deaths_23_3_deaths_by_chapters_urban_rural", "geostat_deaths_23_4_deaths_by_chapters_age_sex",
  "geostat_deaths_23_6_number_of_maternal_deaths_by_regions", "geostat_deaths_23_7_number_of_maternal_deaths_by_age_groups",
  "geostat_deaths_23_10_deaths_from_suicide_by_regions_and_sex", "geostat_deaths_23_11_suicide_rate_by_sex", "geostat_deaths_23_5_deaths_by_causes_age_sex",
  "geostat_deaths_23_8_maternal_mortality_rate_by_regions", "geostat_health_page", "geostat_deaths_page",
];

/** The reviewed research package the serving files are promoted from. */
export const HEALTH_RESEARCH_DIRECTORY = "docs/Raw Data/Health/geostat-health-annual";

export type HealthFact = {
  year: number;
  indicatorId: HealthIndicator;
  areaId: HealthArea;
  /** Exact stored source decimal. */
  value: string;
  /** The value as Geostat publishes it (see `healthPublishedValue`). */
  publishedValue: string;
  unit: HealthUnit;
  basis: "actual";
  valueStatus: "published";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  sourceNumberFormat: string;
  lastReviewedAt: string;
};

/** `value` is the published figure in the stored unit; `decimals` is the number of decimals it is published with. */
export type ClientHealthFact = Pick<HealthFact, "year" | "indicatorId" | "areaId" | "sourceId" | "unit"> & { value: number; decimals: number };
/** One row of `health-series-breaks.csv`, the same columns as demography's break register. */
export type HealthSeriesBreak = BreakRow;
export type HealthAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function healthFactKey(fact: Pick<HealthFact, "indicatorId" | "areaId" | "year">): string {
  return `${fact.indicatorId}:${fact.areaId}:${fact.year}`;
}
export function healthSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
