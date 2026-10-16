import type { BreakRow } from "../demography/breaks";

/** The 63 served series, in the research package's table order. */
export const CRIME_INDICATORS = [
  "crime.recorded.total", "crime.recorded.life", "crime.recorded.health", "crime.recorded.rights",
  "crime.recorded.family", "crime.recorded.property", "crime.recorded.public_safety", "crime.recorded.drugs",
  "crime.recorded.transport", "crime.recorded.malfeasance", "crime.recorded.government", "crime.recorded.other",
  "crime.convicted.total", "crime.convicted.type_murder", "crime.convicted.type_aggravated_murder", "crime.convicted.type_injury",
  "crime.convicted.type_rape", "crime.convicted.type_larceny", "crime.convicted.type_robbery", "crime.convicted.type_theft",
  "crime.convicted.type_drugs", "crime.convicted.type_hooliganism", "crime.convicted.type_traffic", "crime.convicted.type_other",
  "crime.convicted.age_14_17", "crime.convicted.age_18_24", "crime.convicted.age_25_29", "crime.convicted.age_30_49",
  "crime.convicted.age_50_plus", "crime.convicted.sex_women", "crime.convicted.sex_men", "crime.convicted.sentence_prison",
  "crime.convicted.sentence_corrective_labour", "crime.convicted.sentence_suspended", "crime.convicted.sentence_fine", "crime.convicted.sentence_deferred",
  "crime.convicted.sentence_community_work", "crime.convicted.sentence_other",
  "crime.prison.total", "crime.prison.women", "crime.prison.men", "crime.prison.adults",
  "crime.prison.juveniles", "crime.prison.sentenced", "crime.prison.pretrial",
  "crime.victims.total", "crime.victims.sex_men", "crime.victims.sex_women", "crime.victims.sex_unknown",
  "crime.victims.age_under_17", "crime.victims.age_17_24", "crime.victims.age_25_44", "crime.victims.age_45_plus",
  "crime.victims.age_unknown", "crime.victims.citizenship_georgia", "crime.victims.citizenship_foreign", "crime.victims.citizenship_dual",
  "crime.victims.citizenship_stateless", "crime.victims.citizenship_unknown",
  "crime.road.accidents", "crime.road.accidents_drunk", "crime.road.injured", "crime.road.killed",
] as const;
export type CrimeIndicator = (typeof CRIME_INDICATORS)[number];

export const CRIME_UNITS = ["crimes", "persons", "accidents"] as const;
export type CrimeUnit = (typeof CRIME_UNITS)[number];

/** The workbooks the reviewed values are read from. */
export const CRIME_SOURCES = [
  "geostat_crime_recorded", "geostat_crime_convicts_types", "geostat_crime_convicts_age_sex", "geostat_crime_convicts_penalties",
  "geostat_crime_prison", "geostat_crime_victims", "geostat_crime_road",
];
/** Every archived source: the 7 served workbooks, the 3 archived-only English workbooks, the 10 Georgian versions and the two page captures. */
export const CRIME_PUBLIC_SOURCES = [
  ...CRIME_SOURCES,
  "geostat_crime_recorded_2001_2011",
  "geostat_crime_juvenile",
  "geostat_crime_trafficking",
  "geostat_crime_registrirebuli_danasaulis_raodenoba_ka",
  "geostat_crime_registrirebuli_danasauli_2011_ka",
  "geostat_crime_msjavrdebulta_ricxovnoba_danasaulis_saxeebis_mixedvit_ka",
  "geostat_crime_msjavrdebulta_ricxovnoba_asakisa_da_skesis_mixedvit_ka",
  "geostat_crime_msjavrdebulta_ricxovnoba_sasjelis_ronisziebebis_mixedvit_ka",
  "geostat_crime_arasrulwlovani_msjavrdebulebis_raodenoba_cadenili_danasaulis_saxeebis_mi_ka",
  "geostat_crime_patimarta_ricxovnoba_ka",
  "geostat_crime_dazaralebulta_raodenoba_ka",
  "geostat_crime_avtosagzao_semtxvevebi_ka",
  "geostat_crime_trefikingi_ka",
  "geostat_crime_page", "geostat_crime_page_ka",
];

/** The reviewed research package the serving files are promoted from. */
export const CRIME_RESEARCH_DIRECTORY = "docs/Raw Data/Crime/geostat-crime-annual";

export type CrimeFact = {
  year: number;
  indicatorId: CrimeIndicator;
  /** The exact stored whole count. */
  value: string;
  /** The value as Geostat publishes it; every served cell is a whole count, so it equals `value`. */
  publishedValue: string;
  unit: CrimeUnit;
  basis: "actual";
  valueStatus: "official";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};

export type ClientCrimeFact = Pick<CrimeFact, "year" | "indicatorId" | "sourceId" | "unit"> & { value: number };
/** One row of `crime-series-breaks.csv`, the same columns as demography's break register. */
export type CrimeSeriesBreak = BreakRow;

export function crimeFactKey(fact: Pick<CrimeFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function crimeSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
