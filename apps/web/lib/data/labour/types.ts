/** Geostat's NACE Rev. 2 aggregates in print order; `sector_b_e` is "Industry" (sections B to E). */
export const LABOUR_JOB_ITEMS = [
  "total", "sector_a", "sector_b_e", "sector_f", "sector_g", "sector_h", "sector_i", "sector_j", "sector_k", "sector_l",
  "sector_m", "sector_n", "sector_o", "sector_p", "sector_q", "sector_r", "sector_s", "sector_t", "sector_u", "not_identified",
] as const;
/** The hours tables print the same rows without real estate, extra-territorial bodies and "not identified". */
export const LABOUR_HOURS_ITEMS = LABOUR_JOB_ITEMS.filter(
  (item): item is Exclude<(typeof LABOUR_JOB_ITEMS)[number], "sector_l" | "sector_u" | "not_identified"> => !["sector_l", "sector_u", "not_identified"].includes(item),
);
export const LABOUR_JOB_GROUPS = ["all", "women", "men"] as const;
export const LABOUR_HOURS_GROUPS = ["all", "women", "men", "urban", "rural"] as const;
const INFORMAL_ITEMS = ["total", "women", "men", "urban", "rural"] as const;
const UNDERUSE_ITEMS = ["unemployment_rate", "time_related", "potential", "composite"] as const;
const NEET_ITEMS = ["total", "women", "men"] as const;

/** The 160 series, in the research package's table order. */
export const LABOUR_INDICATORS = [
  ...LABOUR_JOB_GROUPS.flatMap(group => LABOUR_JOB_ITEMS.map(item => `labour.jobs.${group}.${item}` as const)),
  ...LABOUR_HOURS_GROUPS.flatMap(group => LABOUR_HOURS_ITEMS.map(item => `labour.hours.${group}.${item}` as const)),
  ...INFORMAL_ITEMS.map(item => `labour.informal.${item}` as const),
  ...UNDERUSE_ITEMS.map(item => `labour.underuse.${item}` as const),
  ...(["age_15_24", "age_15_29"] as const).flatMap(age => NEET_ITEMS.map(item => `labour.neet.${age}.${item}` as const)),
] as const;
export type LabourIndicator = (typeof LABOUR_INDICATORS)[number];

export type LabourUnit = "thousand_persons" | "hours" | "percent";

/** The workbooks the reviewed values are read from. */
export const LABOUR_SOURCES = [
  "geostat_lfs_jobs_industry", "geostat_lfs_hours_sex", "geostat_lfs_hours_settlement",
  "geostat_lfs_informal", "geostat_lfs_underuse", "geostat_lfs_neet",
];
/** Every archived source: the 6 served workbooks, their Georgian versions and the two page captures. */
export const LABOUR_PUBLIC_SOURCES = [
  ...LABOUR_SOURCES,
  ...LABOUR_SOURCES.map(id => `${id}_ka`),
  "geostat_lfs_detail_page", "geostat_lfs_detail_page_ka",
];

/** The reviewed research package the serving files are promoted from. */
export const LABOUR_RESEARCH_DIRECTORY = "docs/Raw Data/Unemployment/geostat-labour-force-detail";

export type LabourFact = {
  year: number;
  indicatorId: LabourIndicator;
  /** The exact text Geostat's workbook stores for the cell, never rounded; it can carry an exponent. */
  value: string;
  /** `value` rounded to 15 significant digits, then to one decimal; it is what the pages show. */
  publishedValue: string;
  unit: LabourUnit;
  basis: "actual";
  valueStatus: "survey_estimate";
  sourceId: string;
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};

export type ClientLabourFact = Pick<LabourFact, "year" | "indicatorId" | "sourceId" | "unit"> & { value: number };

export function labourFactKey(fact: Pick<LabourFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function labourSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
