import type { TradePartnerFact } from "../tradePartners/types";

export type TradeCompositionClassification = "sitc" | "bec";
export type TradeCompositionEntity = { id: string; classification: TradeCompositionClassification; sourceCode: string; labelKa: string; labelEn: string };
export type TradeCompositionFact = Omit<TradePartnerFact, "indicatorId" | "role" | "sourceBlock"> & { indicatorId: "trade.exports" | "trade.imports"; role: "detail"; sourceBlock: "2000-2025" };
export type TradeCompositionData = { entities: TradeCompositionEntity[]; facts: TradeCompositionFact[] };
export const TRADE_COMPOSITION_YEARS = Array.from({ length: 26 }, (_, i) => 2000 + i);
export const TRADE_COMPOSITION_IDS = [...Array.from({ length: 10 }, (_, i) => `trade.sitc1.${i}`), ...Array.from({ length: 7 }, (_, i) => `trade.bec1.${i + 1}`)];
export const TRADE_COMPOSITION_SOURCES = {
  sitc: { export: "geostat_trade_export-sitc-2000-2026", import: "geostat_trade_import-sitc-2000-2026" },
  bec: { export: "geostat_trade_export-bec-2000-2026", import: "geostat_trade_import-bec-2000-2026" },
} as const;
export const TRADE_COMPOSITION_RESEARCH = "docs/Raw Data/Trade/geostat-external-trade/2026-10-07";
export const TRADE_COMPOSITION_INPUT_FILES = ["independent-verification.json", "prepared-validation.json", "full-source-manifest.json", "source-layouts.json", "expected-observation-inventory.json", "unresolved-source-issues.json", "prepared-reconciliation.csv", "coverage.csv", ...(["sitc", "bec"] as const).flatMap(classification => [`goods-products-annual/${classification}1-2000-2025.csv`, ...Object.values(TRADE_COMPOSITION_SOURCES[classification]).map(id => `source-observations/${id}-02-2000-2025.csv`)])];
export type TradeCompositionReconciliation = { classification: TradeCompositionClassification; indicatorId: "trade.exports" | "trade.imports"; year: number; detailSumUsd: string; controlUsd: string; nationalUsd: string; detailDifferenceUsd: string; nationalDifferenceUsd: string };
export type TradeCompositionAcceptance = {
  status: "passed"; scope: "annual_goods_composition"; years: number[]; entities: number;
  primaryObservations: number; numericObservations: number; unavailableObservations: number; derivedObservations: number; controlObservations: number;
  classifications: Record<TradeCompositionClassification, { entities: number; primaryObservations: number; controlObservations: number }>;
  reconciliation: TradeCompositionReconciliation[];
  canonicalSha256: string; catalogueSha256: string; englishLabelsSha256: string; inputSha256: Record<string, string>; sourceSha256: Record<string, string>;
  researchPackageStatus: string; outsideScopeHoldCount: number; outsideScopeHolds: Record<string, string>[]; reviewedAt: string;
};
export const tradeCompositionFactKey = (fact: Pick<TradeCompositionFact, "entityId" | "year" | "indicatorId">) => `${fact.entityId}:${fact.year}:${fact.indicatorId}`;
export const TRADE_COMPOSITION_FIELDS = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];
