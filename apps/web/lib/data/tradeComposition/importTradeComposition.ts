import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { toClientTradeOverviewFact } from "../tradeOverview/importTradeOverview";
import type { TradeOverviewFact } from "../tradeOverview/types";
import { packTradePartnerFacts, type ClientTradePartnersData } from "../tradePartners/importTradePartners";
import { TRADE_COMPOSITION_FIELDS, tradeCompositionFactKey, type TradeCompositionAcceptance, type TradeCompositionClassification, type TradeCompositionData, type TradeCompositionEntity, type TradeCompositionFact } from "./types";
import { tradeCompositionHash, validateTradeCompositionData } from "./validation";

export async function loadTradeCompositionData(): Promise<TradeCompositionData> {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [bytes, catalogue, reportBytes, labelsBytes] = await Promise.all([
    readFile(path.join(root, "data/imports/trade-composition-annual.csv")),
    readFile(path.join(root, "data/taxonomy/trade-composition.json")),
    readFile(path.join(root, "data/reports/trade-composition-validation.json"), "utf8"),
    readFile(path.join(root, "data/localization/en/labels.json"), "utf8"),
  ]);
  const report = JSON.parse(reportBytes) as TradeCompositionAcceptance;
  if (tradeCompositionHash(bytes) !== report.canonicalSha256 || tradeCompositionHash(catalogue) !== report.catalogueSha256) throw new Error("Composition canonical/catalogue acceptance fingerprint mismatch");
  const rows = parse(bytes, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || rows.some(row => Object.keys(row).length !== TRADE_COMPOSITION_FIELDS.length || TRADE_COMPOSITION_FIELDS.some(field => !(field in row)))) throw new Error("Composition canonical fields missing or unexpected");
  const facts: TradeCompositionFact[] = rows.map(row => ({
    entityId: row.entity_id, year: Number(row.year), indicatorId: row.indicator_id as TradeCompositionFact["indicatorId"], valueUsd: row.value_usd === "" ? null : row.value_usd,
    unit: row.unit as "usd", basis: row.basis as "actual", valueStatus: row.value_status as TradeCompositionFact["valueStatus"], publicationStatus: row.publication_status as "unspecified", role: row.role as "detail",
    sourceId: row.source_id, sourceRefs: row.source_refs, sourceValue: row.source_value || null, sourceUnit: row.source_unit || null, sourceLabel: row.source_label || null, sourceNumberFormat: row.source_number_format || null,
    sourceBlock: row.source_block as "2000-2025", lastReviewedAt: row.last_reviewed_at,
  }));
  const data = { entities: JSON.parse(catalogue.toString()) as TradeCompositionEntity[], facts };
  const labels = JSON.parse(labelsBytes) as Record<string, { text: string }>;
  validateTradeCompositionData(data, report, Object.fromEntries(Object.entries(labels).map(([id, entry]) => [id, entry.text])));
  return data;
}

export function assertTradeCompositionParity(csv: TradeCompositionData, mirror: TradeCompositionData): void {
  assertSameServedRows("Composition catalogue", csv.entities, mirror.entities, entity => entity.id);
  const normalize = (facts: readonly TradeCompositionFact[]) => facts.map(f => ({ ...f, valueUsd: f.valueUsd === null ? null : new Decimal(f.valueUsd).toFixed() }));
  assertSameServedRows("Composition facts", normalize(csv.facts), normalize(mirror.facts), tradeCompositionFactKey);
}

let served: Promise<TradeCompositionData> | null = null;
export function resetTradeCompositionCacheForTests(): void { served = null; }
export function loadServedTradeCompositionData(): Promise<TradeCompositionData> {
  served ??= (async () => {
    const csv = await loadTradeCompositionData();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadTradeCompositionDataFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadTradeCompositionDataFromDb();
    assertTradeCompositionParity(csv, mirror);
    return mirror;
  })();
  return served;
}

export function toClientTradeCompositionData(data: TradeCompositionData, national: readonly TradeOverviewFact[]): { sitc: ClientTradePartnersData; bec: ClientTradePartnersData; englishLabels: Record<string, string> } {
  const project = (classification: TradeCompositionClassification): ClientTradePartnersData => {
    const entities = data.entities.filter(e => e.classification === classification).sort((a, b) => Number(a.sourceCode) - Number(b.sourceCode)).map(e => ({ id: e.id, kind: "commodity_group" as const, sourceCode: e.sourceCode, labelKa: e.labelKa }));
    const ids = new Set(entities.map(e => e.id));
    const facts = data.facts.filter(f => ids.has(f.entityId));
    const years = new Set(facts.map(f => f.year));
    return {
      dataset: "composition", classification, entities, facts: packTradePartnerFacts(entities, facts), measures: ["trade.exports", "trade.imports"],
      nationalFacts: national.filter(f => years.has(f.year) && (f.indicatorId === "trade.exports" || f.indicatorId === "trade.imports")).map(toClientTradeOverviewFact),
    };
  };
  return { sitc: project("sitc"), bec: project("bec"), englishLabels: Object.fromEntries(data.entities.map(e => [e.id, e.labelEn])) };
}
