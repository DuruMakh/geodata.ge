import type { TradeProductCategoryId } from "../tradeProducts/types";

export const TRADE_DOMESTIC_MEASURES = ["trade.domestic_exports", "trade.reexports"] as const;
export type TradeDomesticMeasure = (typeof TRADE_DOMESTIC_MEASURES)[number];
export const TRADE_DOMESTIC_SOURCES = {
  country: "geostat_trade_domestic-export-country-2014-2026",
  product: "geostat_trade_domestic-exports-by-4-digit-2014-2026",
} as const;
export const TRADE_DOMESTIC_DOCUMENT_IDS: Record<string, string> = Object.fromEntries([
  ...Object.values(TRADE_DOMESTIC_SOURCES), "geostat_trade_ftrade-1995-2026", "geostat_trade_export-country-1995-2026",
].map(id => [id, `source.${id.replaceAll("-", "_")}`]));
export type TradeDomesticEntity = {
  id: string; kind: "national" | "country" | "product"; code: string | null; labelKa: string; labelEn: string;
  sourceBlock: string; categoryId: TradeProductCategoryId | null; aliasesKa: string[]; aliasesEn: string[];
};
export type TradeDomesticFact = {
  entityId: string; year: number; indicatorId: TradeDomesticMeasure; valueUsd: string;
  unit: "usd"; basis: "actual"; valueStatus: "numeric"; publicationStatus: "unspecified";
  role: "total" | "detail" | "residual" | "derived"; sourceId: string; sourceRefs: string;
  sourceValue: string | null; sourceUnit: string | null; sourceLabel: string | null; sourceNumberFormat: string | null;
  sourceBlock: string; lastReviewedAt: string;
};
export type TradeDomesticData = { entities: TradeDomesticEntity[]; facts: TradeDomesticFact[] };
export type TradeDomesticAcceptance = {
  status: "passed"; scope: "annual_domestic_exports"; years: number[]; productYears: number[];
  primaryObservations: number; derivedObservations: number; countryEntities: number; productEntities: number;
  canonicalSha256: string; catalogueSha256: string; inputSha256: Record<string, string>; sourceSha256: Record<string, string>;
  researchPackageStatus: string; outsideScopeHoldCount: number; reviewedAt: string;
};
export const tradeDomesticFactKey = (fact: Pick<TradeDomesticFact, "entityId" | "year" | "indicatorId">) => `${fact.entityId}:${fact.year}:${fact.indicatorId}`;
