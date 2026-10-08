export const TRADE_OVERVIEW_INDICATORS = ["trade.turnover", "trade.exports", "trade.imports", "trade.balance"] as const;
export type TradeOverviewIndicator = (typeof TRADE_OVERVIEW_INDICATORS)[number];
export const TRADE_OVERVIEW_SOURCE = "geostat_trade_ftrade-1995-2026";
export const TRADE_OVERVIEW_SHEET = "1995-2026";
export type TradeOverviewFact = {
  year: number;
  indicatorId: TradeOverviewIndicator;
  valueUsd: string;
  unit: "usd";
  basis: "actual";
  valueStatus: "numeric";
  publicationStatus: "unspecified";
  role: "total" | "derived";
  sourceId: string;
  sourceRefs: string;
  sourceValue: string | null;
  sourceUnit: string | null;
  sourceLabel: string | null;
  sourceNumberFormat: string | null;
  lastReviewedAt: string;
};
export type ClientTradeOverviewFact = Pick<TradeOverviewFact, "year" | "indicatorId" | "sourceId" | "publicationStatus" | "role" | "lastReviewedAt"> & { valueUsd: number };
export type TradeOverviewAcceptance = {
  status: "passed";
  scope: "national_goods_overview";
  years: number[];
  primaryObservations: number;
  derivedObservations: number;
  sourceSha256: string;
  canonicalSha256: string;
  researchPackageStatus: string;
  outsideScopeHoldCount: number;
  reviewedAt: string;
};
export function tradeOverviewFactKey(fact: Pick<TradeOverviewFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
