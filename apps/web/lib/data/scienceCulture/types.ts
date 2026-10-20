import type { BreakRow } from "../demography/breaks";
import { BUSINESS_REGIONS } from "../business/types";

/** The 19 served measures, in the design spec's order (section 9). */
export const SCIENCE_CULTURE_MEASURES = [
  "researchers", "rd_staff", "institutions", "rd_spending", "invention_applications", "invention_patents", "utility_applications", "utility_patents",
  "museums", "museum_visitors", "museum_tours", "museum_exhibitions", "museum_staff", "theatres", "theatre_audience", "theatre_shows", "theatre_events",
  "theatre_seats", "theatre_staff",
] as const;
export type ScienceCultureMeasure = (typeof SCIENCE_CULTURE_MEASURES)[number];
/** The site's 11 regions: the Business hub's IDs, in the same order. */
export const SCIENCE_CULTURE_REGIONS = BUSINESS_REGIONS;
const REGION_GROUPS = SCIENCE_CULTURE_REGIONS;
const STAFF_GROUPS = ["total", "women", "men", "permanent", "contract", "age_under25", "age_25_54", "age_55_plus"] as const;
const PATENT_GROUPS = ["local", "foreign", "international"] as const;
const TOTAL = ["total"] as const;
/** The groups each measure is served for. */
export const SCIENCE_CULTURE_GROUPS = {
  researchers: [
    "total", "women", "men", "degree_doctoral", "degree_master", "degree_bachelor", "degree_short_cycle",
    "age_under25", "age_25_34", "age_35_44", "age_45_54", "age_55_64", "age_65_plus",
    "field_natural", "field_engineering", "field_medical", "field_agricultural", "field_social", "field_humanities", "field_not_identified",
  ],
  rd_staff: ["total", "women", "men", "technicians", "support", "not_specified"],
  institutions: TOTAL,
  rd_spending: TOTAL,
  invention_applications: PATENT_GROUPS,
  invention_patents: PATENT_GROUPS,
  utility_applications: PATENT_GROUPS,
  utility_patents: PATENT_GROUPS,
  museums: ["total", "type_memorial", "type_history", "type_art", "type_reserve", "type_literature", "type_other", ...REGION_GROUPS],
  museum_visitors: ["total", ...REGION_GROUPS],
  museum_tours: ["total", ...REGION_GROUPS],
  museum_exhibitions: ["total", ...REGION_GROUPS],
  museum_staff: STAFF_GROUPS,
  theatres: ["total", "type_drama", "type_puppet", "type_opera_ballet", "type_youth"],
  theatre_audience: TOTAL,
  theatre_shows: ["total", "away", "abroad"],
  theatre_events: ["total", "away", "abroad"],
  theatre_seats: TOTAL,
  theatre_staff: STAFF_GROUPS,
} as const satisfies Record<ScienceCultureMeasure, readonly string[]>;
type Groups = typeof SCIENCE_CULTURE_GROUPS;
export type ScienceCultureGroup<M extends ScienceCultureMeasure = ScienceCultureMeasure> = Groups[M][number];
export type ScienceCultureIndicator = { [M in ScienceCultureMeasure]: `science_culture.${M}.${Groups[M][number]}` }[ScienceCultureMeasure];
export function scienceCultureIndicator<M extends ScienceCultureMeasure>(measure: M, group: ScienceCultureGroup<M>): ScienceCultureIndicator {
  return `science_culture.${measure}.${group}` as ScienceCultureIndicator;
}
/** The 123 served indicators, in the research package's order (sorted by ID). */
export const SCIENCE_CULTURE_INDICATORS: readonly ScienceCultureIndicator[] = SCIENCE_CULTURE_MEASURES
  .flatMap(measure => (SCIENCE_CULTURE_GROUPS[measure] as readonly ScienceCultureGroup[]).map(group => `science_culture.${measure}.${group}` as ScienceCultureIndicator))
  .sort();
/** The eleven Geostat workbooks the observations are read from. */
export const SCIENCE_CULTURE_SOURCES = [
  "geostat_science_researchers", "geostat_science_rd_staff", "geostat_science_institutions", "geostat_science_patents",
  "geostat_culture_museums", "geostat_culture_museums_count_regions", "geostat_culture_museums_regions", "geostat_culture_museum_staff",
  "geostat_culture_theatres", "geostat_culture_theatre_events", "geostat_culture_theatre_staff",
];
/** Every archived source: the eleven served workbooks, the cross-check and unused English workbooks, the thirteen Georgian workbooks and the two page captures. */
export const SCIENCE_CULTURE_PUBLIC_SOURCES = [
  ...SCIENCE_CULTURE_SOURCES,
  "geostat_science_publications", "geostat_culture_museum_exhibits", "geostat_culture_theatres_regions", "geostat_culture_theatres_count_regions",
  "geostat_culture_libraries", "geostat_culture_libraries_regions", "geostat_culture_publishing",
  "geostat_ka_science_institutions", "geostat_ka_science_rd_staff", "geostat_ka_science_researchers", "geostat_ka_science_patents",
  "geostat_ka_culture_museums", "geostat_ka_culture_museums_count_regions", "geostat_ka_culture_museums_regions", "geostat_ka_culture_museum_staff",
  "geostat_ka_culture_theatres", "geostat_ka_culture_theatres_regions", "geostat_ka_culture_theatres_count_regions", "geostat_ka_culture_theatre_staff",
  "geostat_ka_culture_theatre_events",
  "geostat_science_page", "geostat_culture_page",
];
export type ScienceCultureFact = {
  year: number;
  indicatorId: ScienceCultureIndicator;
  /** Exact decimal: the stored workbook number as text. */
  value: string;
  /** The value at its published precision: counts and persons whole, thousands and million GEL at the larger of the decimals the cell shows and stores. */
  publishedValue: string;
  unit: "persons" | "persons_thousand" | "count" | "count_thousand" | "gel_million";
  basis: "actual";
  valueStatus: "official";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientScienceCultureFact = Pick<ScienceCultureFact, "year" | "indicatorId" | "sourceId"> & {
  value: number;
  unit: "persons" | "thousand" | "count" | "gel";
  decimals: number;
};
export type ScienceCultureSeriesBreak = BreakRow;
export type ScienceCultureAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function scienceCultureFactKey(fact: Pick<ScienceCultureFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function scienceCultureSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
