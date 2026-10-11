import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import type { ClientTradeOverviewFact } from "../tradeOverview/types";
import type { ClientTradePartnersData } from "../tradePartners/importTradePartners";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { TRADE_SERVICES_FIELDS, tradeServicesFactKey, type TradeServiceEntity, type TradeServiceFact, type TradeServicesAcceptance, type TradeServicesData } from "./types";
import { tradeServicesHash, validateTradeServicesData } from "./validation";

export async function loadTradeServicesData(): Promise<TradeServicesData> {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [bytes, catalogue, reportBytes, labelsBytes] = await Promise.all([readFile(path.join(root, "data/imports/trade-services-annual.csv")), readFile(path.join(root, "data/taxonomy/trade-services.json")), readFile(path.join(root, "data/reports/trade-services-validation.json"), "utf8"), readFile(path.join(root, "data/localization/en/labels.json"), "utf8")]);
  const report = JSON.parse(reportBytes) as TradeServicesAcceptance;
  if (tradeServicesHash(bytes) !== report.canonicalSha256 || tradeServicesHash(catalogue) !== report.catalogueSha256) throw new Error("Services canonical/catalogue acceptance fingerprint mismatch");
  const rows = parse(bytes, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || rows.some(row => Object.keys(row).length !== TRADE_SERVICES_FIELDS.length || TRADE_SERVICES_FIELDS.some(field => !(field in row)))) throw new Error("Services canonical fields missing or unexpected");
  const facts = rows.map(row => ({ entityId: row.entity_id, year: Number(row.year), indicatorId: row.indicator_id as TradeServiceFact["indicatorId"], valueUsd: row.value_usd === "" ? null : row.value_usd, unit: row.unit as "usd", basis: row.basis as "actual", valueStatus: row.value_status as TradeServiceFact["valueStatus"], publicationStatus: row.publication_status as "unspecified", role: row.role as TradeServiceFact["role"], sourceId: row.source_id || null, sourceRefs: row.source_refs, sourceValue: row.source_value || null, sourceUnit: row.source_unit || null, sourceLabel: row.source_label || null, sourceNumberFormat: row.source_number_format || null, sourceBlock: row.source_block || null, lastReviewedAt: row.last_reviewed_at }));
  const data = { entities: JSON.parse(catalogue.toString()) as TradeServiceEntity[], facts };
  const labels = JSON.parse(labelsBytes) as Record<string, { text: string }>;
  validateTradeServicesData(data, report, Object.fromEntries(Object.entries(labels).map(([id, entry]) => [id, entry.text])));
  return data;
}
export function assertTradeServicesParity(csv: TradeServicesData, mirror: TradeServicesData): void {
  assertSameServedRows("Services catalogue", csv.entities, mirror.entities, entity => entity.id);
  const normalize = (facts: TradeServiceFact[]) => facts.map(f => ({ ...f, valueUsd: f.valueUsd === null ? null : new Decimal(f.valueUsd).toFixed() }));
  assertSameServedRows("Services facts", normalize(csv.facts), normalize(mirror.facts), tradeServicesFactKey);
}
let served: Promise<TradeServicesData> | null = null;
export function loadServedTradeServicesData(): Promise<TradeServicesData> {
  served ??= (async () => {
    const csv = await loadTradeServicesData();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadTradeServicesDataFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadTradeServicesDataFromDb(); assertTradeServicesParity(csv, mirror); return mirror;
  })(); return served;
}
export function toClientTradeServicesData(data: TradeServicesData): { national: ClientTradeOverviewFact[]; types: ClientTradePartnersData; englishLabels: Record<string, string> } {
  const national = data.facts.filter(f => f.entityId === "services.total" && f.valueUsd !== null).map(f => ({ year: f.year, indicatorId: f.indicatorId, valueUsd: Number(f.valueUsd), sourceId: f.sourceId, publicationStatus: f.publicationStatus, role: f.role === "derived" ? "derived" as const : "total" as const, lastReviewedAt: f.lastReviewedAt }));
  const entities = data.entities.filter(e => e.kind === "service_type").map(e => ({ id: e.id, kind: "service_type" as const, sourceCode: null, labelKa: e.labelKa }));
  const ids = new Set(entities.map(e => e.id));
  return { national, types: { dataset: "services", entities, nationalFacts: national, facts: data.facts.filter(f => ids.has(f.entityId)).map(f => ({ entityId: f.entityId, year: f.year, indicatorId: f.indicatorId, valueUsd: f.valueUsd === null ? null : Number(f.valueUsd), sourceId: f.sourceId, basis: f.basis, publicationStatus: f.publicationStatus, lastReviewedAt: f.lastReviewedAt })) }, englishLabels: Object.fromEntries(data.entities.map(e => [e.id, e.labelEn])) };
}
