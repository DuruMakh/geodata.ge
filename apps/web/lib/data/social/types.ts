import type { BreakRow } from "../demography/breaks";
import { EDUCATION_GEORGIA } from "../education/types";

/** The site's places: Education's Georgia id, 11 regions and 63 municipality codes (Tbilisi is a region of its own, never code 04). */
export { EDUCATION_MUNICIPALITIES as SOCIAL_MUNICIPALITIES, EDUCATION_REGIONS as SOCIAL_REGIONS } from "../education/types";
export const SOCIAL_GEORGIA = EDUCATION_GEORGIA;
/**
 * SSA's own rows for excluded areas, with the region whose printed subtotal includes them. Upper Abkhazia is outside
 * every regional subtotal and adds to Georgia directly. Never drawn and no page.
 */
export const SOCIAL_UNITS: Readonly<Record<string, string | null>> = {
  "unit.akhalgori": "region.mtskheta_mtianeti",
  "unit.upper_abkhazia": null,
};

/** Social package eligibility groups, in spec §7 order. The four disability rows are parts of `disability`; the rest partition `total`. */
export const SOCIAL_PACKAGE_GROUPS = [
  "total", "disability", "disability_children", "disability_severe", "disability_significant", "disability_moderate",
  "survivors", "war_participants", "political_repression", "other",
] as const;
/**
 * SSA's eight age bands of the people in receiving families (tsa_allowance-03), as printed: `0_6` is SSA's "0_6", and
 * `70_plus` its "70 და მეტი" (70 and over). SSA does not say which band a boundary age falls in.
 */
export const SOCIAL_AGE_BANDS = ["0_6", "6_18", "18_30", "30_40", "40_60", "60_65", "65_70", "70_plus"] as const;
/** The Social payments rows after the total, in spec §4 order, by the research package's programme id. `pension_idp` is part of the state pension. */
export const SOCIAL_PAYMENT_PROGRAMMES = [
  "pension", "pension_highmountain", "social_package", "social_package_highmountain", "subsistence_allowance", "idp_refugee_allowance",
  "compensation_stipend", "maternity", "child_benefit_3rd_plus", "child_benefit_highmountain", "utility_subsidy", "electricity_tariff_subsidy",
  "highmountain_electricity", "electricity_large_families", "water_subsidy", "highmountain_doctors_nurses", "workplace_injury", "covid_vulnerable_compensation",
] as const;
export type SocialPaymentProgramme = (typeof SOCIAL_PAYMENT_PROGRAMMES)[number];

/** The funded pension scheme's money rows (stored as `social.funded_pension.{measure}.amount`, in GEL), in the order the Pension Fund's statements print them. */
export const FUNDED_PENSION_MONEY = [
  "savings", "net_assets", "contributions", "contributions_private", "contributions_public", "contributions_state", "interest", "securities_gains", "dividends", "payouts",
] as const;
/** The funded pension scheme's counts (stored as `social.funded_pension.{measure}`); the annual return is `social.funded_pension.return`. */
export const FUNDED_PENSION_COUNTS = ["members", "left", "paid_persons", "employers"] as const;

/** Every served indicator: the Pensions and Subsistence allowance place series, the Social package series and the Social payments rows. */
export const SOCIAL_INDICATORS = [
  "social.pension.recipients", "social.pension.amount", "social.pension.avg_monthly",
  "social.pension_idp.recipients", "social.pension_idp.amount",
  "social.pension_highmountain.recipients", "social.pension_highmountain.amount", "social.pension_highmountain.avg_monthly",
  "social.subsistence.families", "social.subsistence.employment_families", "social.subsistence.registered_families",
  "social.subsistence.persons", "social.subsistence.registered_persons",
  ...SOCIAL_AGE_BANDS.map(band => `social.subsistence.persons_age_${band}` as const),
  "social.subsistence.amount", "social.subsistence.employment_amount", "social.subsistence.avg_monthly",
  ...SOCIAL_PACKAGE_GROUPS.map(group => `social.social_package.${group}.recipients` as const),
  ...SOCIAL_PACKAGE_GROUPS.map(group => `social.social_package.${group}.amount` as const),
  "social.social_package.total.avg_monthly",
  ...SOCIAL_PACKAGE_GROUPS.filter(group => group !== "total").map(group => `social.social_package.${group}.avg_monthly` as const),
  "social.payments.total.amount",
  ...SOCIAL_PAYMENT_PROGRAMMES.map(programme => `social.payments.${programme}.amount` as const),
  ...FUNDED_PENSION_MONEY.map(measure => `social.funded_pension.${measure}.amount` as const),
  ...FUNDED_PENSION_COUNTS.map(measure => `social.funded_pension.${measure}` as const),
  "social.funded_pension.return",
] as const;
export type SocialIndicator = (typeof SOCIAL_INDICATORS)[number];

/** The Pension Fund's audited IFRS statements (one per document that serves a year) and its 2025 annual report, which serves the counts and the return. */
export const FUNDED_PENSION_SOURCES = [
  "pension_fund_ifrs_2020", "pension_fund_ifrs_2022", "pension_fund_ifrs_2023", "pension_fund_ifrs_2024", "pension_fund_ifrs_2025", "pension_fund_report_2025",
];
/** The SSA tables the served values are read from, as `ssa_` and the research package's table id, then the Pension Fund's documents. */
export const SOCIAL_SOURCES = [
  "ssa_pension_01", "ssa_pension_02", "ssa_pension_04", "ssa_tsa_allowance_01", "ssa_tsa_allowance_02", "ssa_tsa_allowance_03", "ssa_tsa_db_01",
  "ssa_socpackage_01", "ssa_socpackage_02", "ssa_socpackage_10", "ssa_idp_refugee_02", "ssa_compensation_04", "ssa_maternity_01",
  "ssa_maternity_03", "ssa_demography_02", "ssa_demography_04", "ssa_utilitysubsidy_02", "ssa_other_01", "ssa_other_02",
  "ssa_other_03", "ssa_other_04", "ssa_highmountain_01", "ssa_highmountain_03", "ssa_workinjury_03",
  ...FUNDED_PENSION_SOURCES,
];
/** The served tables and SSA's statistics page, which the Social payments total (a sum of the tables' rows) cites. */
export const SOCIAL_PUBLIC_SOURCES = [...SOCIAL_SOURCES, "ssa_statistics"];
/**
 * The archived SSA topic page (data/methodology/source-archives/social-protection.csv) that lists a served table: SSA renames
 * its workbooks on every upload, so a table is cited by its topic's page (`ssa_pension_04` → `ssa_pension`), and the statistics
 * list cites itself. A Pension Fund document is archived under its own id (`pension_fund_ifrs_2020`).
 */
export function socialArchiveSourceId(sourceId: string): string {
  return sourceId.startsWith("ssa_") ? sourceId.replace(/_\d+$/, "") : sourceId;
}
export function socialSourceId(tableId: string): string {
  return `ssa_${tableId.replace(/-/g, "_")}`;
}

export type SocialFact = {
  year: number;
  indicatorId: SocialIndicator;
  /** `country.georgia`, a `region.*` id, a two-digit municipality code or a `unit.*` id. */
  geographyId: string;
  /** Exact decimal: whole persons, families or GEL (negative only for the funded pension's securities gains); an average in GEL to two decimals; the funded pension's return to one decimal. */
  value: string;
  /** Money is GEL as summed; `gel_million` is the client's display unit, never stored. `employers` and `percent` are the funded pension's. */
  unit: "persons" | "families" | "gel" | "gel_million" | "employers" | "percent";
  /** How many monthly sheets the value covers: 1 for a December count. */
  months: number;
  basis: "actual";
  /** `official` for one printed cell, `calculated` for a sum, an average or the payments total. */
  valueStatus: "official" | "calculated";
  sourceId: string;
  /** The workbook in the research package's `official/workbooks/`; an average names its money and count workbooks, separated by `;` when they differ. */
  sourceWorkbook: string;
  /** The sheet, or `*` for every monthly sheet. */
  sourceSheet: string;
  /** The package's cell expression; an average is `(money cells)/(count cells)`, the payments total the `+`-joined payments rows it adds. */
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientSocialFact = Pick<SocialFact, "year" | "indicatorId" | "geographyId" | "sourceId" | "months" | "valueStatus"> & { value: number };
export type SocialAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
/** One row of `social-protection-series-breaks.csv`, the same columns as demography's break register. */
export type SocialSeriesBreak = BreakRow;
export function socialFactKey(fact: Pick<SocialFact, "indicatorId" | "geographyId" | "year">): string {
  return `${fact.indicatorId}:${fact.geographyId}:${fact.year}`;
}
export function socialSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
