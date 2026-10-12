export const TRADE_PRODUCT_MEASURES = ["trade.exports", "trade.imports"] as const;
export type TradeProductMeasure = (typeof TRADE_PRODUCT_MEASURES)[number];
export const TRADE_PRODUCT_BLOCKS = ["1995-1999", "2000-2014", "2015-2019", "2020-2025"] as const;
export type TradeProductSourceBlock = (typeof TRADE_PRODUCT_BLOCKS)[number];
export const TRADE_PRODUCT_CATEGORIES = ["food_agriculture", "minerals_fuels", "chemicals_materials", "clothing_wood_paper", "metals_stone_glass", "machinery_electronics", "vehicles_transport", "other_products"] as const;
export type TradeProductCategoryId = (typeof TRADE_PRODUCT_CATEGORIES)[number];
export type TradeProductEntity = { id: string; sourceBlock: TradeProductSourceBlock; code: string; labelKa: string; sourceLabelEn: string; categoryId: TradeProductCategoryId; aliasesKa: string[]; aliasesEn: string[] };
export const TRADE_PRODUCT_SOURCES = {
  "1995-1999": { export: "geostat_trade_export-product-by-4-digit-1995-1999", import: "geostat_trade_import-products--1995-1999-eng" },
  "2000-2014": { export: "geostat_trade_export-product-by-4-digit-2000-2014", import: "geostat_trade_import-product-by-4-digit-2000-2014" },
  "2015-2019": { export: "geostat_trade_export-product-by-4-digit-2015-2026", import: "geostat_trade_import-product-by-4-digit-2015-2026" },
  "2020-2025": { export: "geostat_trade_export-product-by-4-digit-2015-2026", import: "geostat_trade_import-product-by-4-digit-2015-2026" },
} as const;
export const TRADE_PRODUCT_DOCUMENT_IDS: Record<string, string> = Object.fromEntries([...new Set(Object.values(TRADE_PRODUCT_SOURCES).flatMap(sources => Object.values(sources)))].map(id => [id, `source.${id.replaceAll("-", "_")}`]));
export type TradeProductFact = {
  entityId: string; year: number; indicatorId: TradeProductMeasure; valueUsd: string | null;
  unit: "usd"; basis: "actual"; valueStatus: "numeric" | "blank" | "not_applicable"; publicationStatus: "unspecified";
  role: "detail"; sourceId: string; sourceRefs: string; sourceValue: string | null; sourceUnit: string;
  sourceLabel: string; sourceNumberFormat: string; sourceBlock: TradeProductSourceBlock; lastReviewedAt: string;
};
export type TradeProductsData = { entities: TradeProductEntity[]; facts: TradeProductFact[] };
export type TradeProductsAcceptance = {
  status: "passed"; scope: "annual_goods_products"; years: number[]; productEntities: number;
  primaryObservations: number; controlObservations: number; primaryValueStatusCounts: { numeric: number; blank: number; not_applicable: number };
  sourceSha256: Record<string, string>; inputSha256: Record<string, string>; canonicalSha256: string; catalogueSha256: string; englishLabelsSha256: string;
  reviewedAt: string; researchPackageStatus: string; outsideScopeHoldCount: number;
};
export function tradeProductFactKey(fact: Pick<TradeProductFact, "entityId" | "indicatorId" | "year">): string {
  return `${fact.entityId}:${fact.indicatorId}:${fact.year}`;
}
export function tradeProductCategory(code: string): TradeProductCategoryId {
  if (code === "7700") return "other_products";
  const prefix = Number(code.slice(0, 2));
  if (prefix < 1 || prefix > 99) return "other_products";
  const index = [24, 27, 40, 67, 83, 85, 89, 99].findIndex(max => prefix <= max);
  return TRADE_PRODUCT_CATEGORIES[index];
}
