import type { TradeOverviewIndicator } from "../tradeOverview/types";

export type TradePartnerKind = "country" | "group";
export type TradePartnerEntity = { id: string; kind: TradePartnerKind; sourceCode: string | null; labelKa: string };
export const TRADE_PARTNER_SOURCES = {
  country: { export: "geostat_trade_export-country-1995-2026", import: "geostat_trade_import-country-1995-2026" },
  group: { export: "geostat_trade_export--country-group-1995-2026", import: "geostat_trade_import-country-group-1995-2026" },
} as const;
export const TRADE_PARTNER_DOCUMENT_IDS: Record<string, string> = {
  "geostat_trade_export-country-1995-2026": "source.geostat_trade_export_country_1995_2026",
  "geostat_trade_import-country-1995-2026": "source.geostat_trade_import_country_1995_2026",
  "geostat_trade_export--country-group-1995-2026": "source.geostat_trade_export__country_group_1995_2026",
  "geostat_trade_import-country-group-1995-2026": "source.geostat_trade_import_country_group_1995_2026",
};
export const TRADE_PARTNER_GROUP_IDS = ["group.eu", "group.cis", "group.bsec", "group.oecd", "group.guam"] as const;
export type TradePartnerFact = {
  entityId: string; year: number; indicatorId: TradeOverviewIndicator; valueUsd: string | null;
  unit: "usd"; basis: "actual"; valueStatus: "numeric" | "blank" | "not_applicable"; publicationStatus: "unspecified";
  role: "detail" | "subtotal" | "derived"; sourceId: string; sourceRefs: string;
  sourceValue: string | null; sourceUnit: string | null; sourceLabel: string | null; sourceNumberFormat: string | null;
  sourceBlock: string; lastReviewedAt: string;
};
export type TradePartnersData = { entities: TradePartnerEntity[]; facts: TradePartnerFact[] };
export type TradePartnersAcceptance = {
  status: "passed"; scope: "annual_goods_partners"; years: number[]; countryEntities: number; groupEntities: number;
  primaryObservations: number; derivedObservations: number;
  primaryValueStatusCounts: { numeric: number; blank: number; not_applicable: number };
  sourceSha256: Record<string, string>; inputSha256: Record<string, string>; canonicalSha256: string; catalogueSha256: string;
  englishLabelsSha256: string; reviewedAt: string; researchPackageStatus: string; outsideScopeHoldCount: number;
};
export function tradePartnerFactKey(fact: Pick<TradePartnerFact, "entityId" | "indicatorId" | "year">): string {
  return `${fact.entityId}:${fact.indicatorId}:${fact.year}`;
}
