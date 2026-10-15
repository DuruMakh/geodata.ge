/** The 10 served indicators, in the research package's cell-map order. */
export const EXTERNAL_POSITION_INDICATORS = [
  "ext_debt.total", "ext_debt.government", "ext_debt.central_bank", "ext_debt.banks", "ext_debt.companies", "ext_debt.intercompany",
  "reserves.total", "reserves.fx", "reserves.sdr", "reserves.gold",
] as const;
export type ExternalPositionIndicator = (typeof EXTERNAL_POSITION_INDICATORS)[number];
/** The two NBG workbooks the observations are read from. */
export const EXTERNAL_POSITION_SOURCES = ["nbg_gross_external_debt_bpm6", "nbg_official_reserve_assets"];
/** Every archived source: the two workbooks and the file listing they were found through. */
export const EXTERNAL_POSITION_PUBLIC_SOURCES = [...EXTERNAL_POSITION_SOURCES, "nbg_api_category_24"];
export type ExternalPositionFact = {
  year: number;
  indicatorId: ExternalPositionIndicator;
  /** Exact decimal in million USD: the stored debt token, or the stored reserves token (thousand USD) divided by 1000. */
  value: string;
  /** The value rounded half-up to one decimal. */
  publishedValue: string;
  unit: "usd_million";
  /** `YYYY-12-31`, except the single latest 2026 point (2026-06-30 for debt, 2026-09-30 for reserves). */
  periodEnd: string;
  basis: "actual";
  valueStatus: "official";
  sourceId: string;
  /** The sheet name; the reserves sheet name ends in a space. */
  sourceSheet: string;
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientExternalPositionFact = {
  year: number;
  indicatorId: ExternalPositionIndicator;
  /** US dollars. */
  value: number;
  latestPeriod: boolean;
  periodEnd: string;
  sourceId: string;
};
export type ExternalPositionAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  researchStatus: string;
  canonicalSha256: string;
  reviewedAt: string;
};
export function externalPositionFactKey(fact: Pick<ExternalPositionFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function externalPositionSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}
