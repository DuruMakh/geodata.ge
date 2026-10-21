import type { BreakRow } from "../demography/breaks";

/** The twelve served measures, in the research package's cell-map order. */
export const EDUCATION_MEASURES = [
  "schools", "pupils_national", "teachers", "pupils", "kindergartens", "kg_children", "kg_staff",
  "he_students", "he_admitted", "he_graduates", "vet_admitted", "vet_graduates",
] as const;
export type EducationMeasure = (typeof EDUCATION_MEASURES)[number];
export const EDUCATION_OWNERSHIP_GROUPS = ["total", "public", "private"] as const;
/** Higher education: the total, the three levels, ownership, sex and the eight fields of study. */
export const EDUCATION_HE_GROUPS = [
  "total", "level_bachelor", "level_master", "level_professional", "public", "private", "women", "men",
  "field_education", "field_humanities_arts", "field_social_business_law", "field_science", "field_engineering",
  "field_agriculture", "field_health_welfare", "field_services",
] as const;
/** Geostat's current vocational field list (from 2019), shown. */
export const EDUCATION_VET_FIELDS = [
  "field_agriculture_vet", "field_arts_humanities", "field_business_law", "field_education", "field_engineering",
  "field_health_welfare", "field_ict", "field_services", "field_social_journalism",
] as const;
/** The list Geostat phased out over 2019-2022: kept in the file with `shown = false`, never on a page. */
export const EDUCATION_VET_OLD_FIELDS = [
  "old_agricultural_sciences", "old_business_administration", "old_engineering", "old_natural_sciences",
  "old_inter_directional", "old_law", "old_social_sciences", "old_art", "old_health",
] as const;
export type EducationGroup =
  | (typeof EDUCATION_OWNERSHIP_GROUPS)[number]
  | "women"
  | "men"
  | (typeof EDUCATION_HE_GROUPS)[number]
  | (typeof EDUCATION_VET_FIELDS)[number]
  | (typeof EDUCATION_VET_OLD_FIELDS)[number];
export type EducationIndicator = `education.${EducationMeasure}.${EducationGroup}`;
export function educationIndicator(measure: EducationMeasure, group: EducationGroup): EducationIndicator {
  return `education.${measure}.${group}`;
}
/** The groups each measure is served with. */
export const EDUCATION_GROUPS: Record<EducationMeasure, readonly EducationGroup[]> = {
  schools: EDUCATION_OWNERSHIP_GROUPS,
  pupils_national: EDUCATION_OWNERSHIP_GROUPS,
  teachers: [...EDUCATION_OWNERSHIP_GROUPS, "women", "men"],
  pupils: ["total"],
  kindergartens: ["total"],
  kg_children: ["total"],
  kg_staff: ["total"],
  he_students: EDUCATION_HE_GROUPS,
  he_admitted: EDUCATION_HE_GROUPS,
  he_graduates: EDUCATION_HE_GROUPS,
  vet_admitted: ["total", "women", "men", ...EDUCATION_VET_FIELDS, ...EDUCATION_VET_OLD_FIELDS],
  vet_graduates: ["total", "women", "men", ...EDUCATION_VET_FIELDS, ...EDUCATION_VET_OLD_FIELDS],
};
/** The 105 served indicators, in the research package's cell-map order. */
export const EDUCATION_INDICATORS: readonly EducationIndicator[] = EDUCATION_MEASURES.flatMap(measure => EDUCATION_GROUPS[measure].map(group => educationIndicator(measure, group)));

export const EDUCATION_GEORGIA = "country.georgia";
/** The site's 11 regions: Tbilisi prints no municipalities, the others list theirs. */
export const EDUCATION_REGIONS = [
  "region.tbilisi", "region.adjara", "region.guria", "region.imereti", "region.kakheti", "region.mtskheta_mtianeti",
  "region.racha_lechkhumi_kvemo_svaneti", "region.samegrelo_zemo_svaneti", "region.samtskhe_javakheti", "region.kvemo_kartli", "region.shida_kartli",
] as const;
/** The 63 municipality codes Geostat's tables print, by region (Tbilisi is a region of its own, never code 04). */
export const EDUCATION_MUNICIPALITIES: Readonly<Record<string, readonly string[]>> = {
  "region.adjara": ["06", "07", "08", "09", "10", "11"],
  "region.kakheti": ["12", "13", "14", "15", "16", "17", "18", "19"],
  "region.imereti": ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"],
  "region.samegrelo_zemo_svaneti": ["32", "33", "34", "35", "36", "37", "38", "39", "40"],
  "region.shida_kartli": ["41", "44", "45", "47"],
  "region.kvemo_kartli": ["48", "49", "50", "51", "52", "53", "54"],
  "region.guria": ["55", "56", "57"],
  "region.samtskhe_javakheti": ["58", "59", "60", "61", "62", "63"],
  "region.mtskheta_mtianeti": ["65", "66", "67", "68"],
  "region.racha_lechkhumi_kvemo_svaneti": ["69", "70", "71", "72"],
};
/**
 * Units kept apart from the municipalities, with the region whose row they add to. Abkhazia AR adds to
 * Georgia directly. Never drawn and no page. Eredvi, Tighva and Kurta have values only before 2011.
 */
export const EDUCATION_UNITS: Readonly<Record<string, string | null>> = {
  "unit.abkhazia_ar": null,
  "unit.akhalgori": "region.mtskheta_mtianeti",
  "unit.eredvi": "region.shida_kartli",
  "unit.tighva": "region.shida_kartli",
  "unit.kurta": "region.shida_kartli",
};
/** The six Geostat workbooks the observations are read from. */
export const EDUCATION_SOURCES = [
  "geostat_education_schools_national", "geostat_education_teachers_national", "geostat_education_municipal",
  "geostat_education_kindergartens", "geostat_education_higher", "geostat_education_vocational",
];
/** Every archived source: the six served workbooks, the other Geostat education tables and the four category-page captures. */
export const EDUCATION_PUBLIC_SOURCES = [
  ...EDUCATION_SOURCES,
  "geostat_education_schools_by_stage_region", "geostat_education_pupils_by_grade_age", "geostat_education_pupils_by_level_grade",
  "geostat_education_pupils_suspended", "geostat_education_pupils_ict", "geostat_education_school_graduates",
  "geostat_education_pupils_social_status", "geostat_education_enrolment_rates", "geostat_education_proficiency",
  "geostat_education_grade_progression", "geostat_education_school_to_vet", "geostat_education_school_to_vet_sen",
  "geostat_education_vet_institutions", "geostat_education_vet_regions_sex", "geostat_education_vet_employees", "geostat_education_vet_sen",
  "geostat_education_secondary_professional_types", "geostat_education_secondary_professional_private",
  "geostat_education_secondary_professional_specialization", "geostat_education_secondary_professional_regions",
  "geostat_education_secondary_professional_pupils_regions", "geostat_education_secondary_professional_admitted",
  "geostat_education_secondary_professional_admitted_specialization", "geostat_education_secondary_professional_graduates",
  "geostat_education_secondary_professional_graduates_specialization", "geostat_education_secondary_professional_teachers",
  "geostat_education_higher_subprogrammes", "geostat_education_higher_age_citizenship", "geostat_education_higher_foreign_students",
  "geostat_education_higher_abroad", "geostat_education_higher_professors", "geostat_education_higher_institutions",
  "geostat_education_doctoral", "geostat_education_doctoral_age", "geostat_education_doctoral_heads", "geostat_education_doctoral_foreign",
  "geostat_education_preschool_page", "geostat_education_general_page", "geostat_education_vocational_page", "geostat_education_higher_page",
];
export type EducationFact = {
  year: number;
  /** `2025/26` for a school year (stored as its start year), `2025` for a vocational calendar year. */
  periodLabel: string;
  indicatorId: EducationIndicator;
  /** `country.georgia`, a `region.*` id, a two-digit municipality code or a `unit.*` id. */
  geographyId: string;
  /** Exact decimal: the stored workbook token (a text cell with its spaces removed). */
  value: string;
  /** The value at the cell's displayed precision: one decimal for Georgia's pupils in thousands, none otherwise. */
  publishedValue: string;
  unit: "persons" | "persons_thousand" | "institutions";
  basis: "actual";
  valueStatus: "official";
  /** False only for the old vocational fields. */
  shown: boolean;
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientEducationFact = Pick<EducationFact, "year" | "indicatorId" | "geographyId" | "sourceId"> & {
  value: number;
  unit: "persons" | "institutions";
  decimals: 0 | 1;
};
export type EducationAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
/** One row of `education-series-breaks.csv`, the same columns as demography's break register. */
export type EducationSeriesBreak = BreakRow;
export function educationFactKey(fact: Pick<EducationFact, "indicatorId" | "geographyId" | "year">): string {
  return `${fact.indicatorId}:${fact.geographyId}:${fact.year}`;
}
export function educationSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
