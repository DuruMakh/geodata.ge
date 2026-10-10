import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { toClientTradeOverviewFact } from "../tradeOverview/importTradeOverview";
import type { ClientTradeOverviewFact, TradeOverviewFact } from "../tradeOverview/types";
import { readTradeProductCatalogue } from "./catalogue";
import { tradeProductFactKey, type TradeProductEntity, type TradeProductFact, type TradeProductSourceBlock, type TradeProductsData, type TradeProductsAcceptance } from "./types";
import { tradeProductsEnglishLabels, validateTradeProductsData } from "./validation";

export type ClientTradeProductFact = [entityIndex: number, year: number, measureIndex: 0 | 1, valueUsd: number | null];
export type ClientTradeProductsData = { entities: TradeProductEntity[]; years: number[]; facts: ClientTradeProductFact[]; nationalFacts: ClientTradeOverviewFact[]; catalogueFingerprint: string; sourceBlock?: TradeProductSourceBlock };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function loadTradeProductsData(): Promise<TradeProductsData> {
  const root = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");
  const [csv, catalogue, entities, reportText, labelsText] = await Promise.all([
    readFile(path.join(root, "data/imports/trade-products-annual.csv")), readFile(path.join(root, "data/imports/trade-products-catalogue.csv")), readTradeProductCatalogue(root),
    readFile(path.join(root, "data/reports/trade-products-validation.json"), "utf8"), readFile(path.join(root, "data/localization/en/labels.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as TradeProductsAcceptance;
  if (report.status !== "passed" || report.scope !== "annual_goods_products" || report.canonicalSha256 !== hash(csv) || report.catalogueSha256 !== hash(catalogue) || report.englishLabelsSha256 !== hash(tradeProductsEnglishLabels(entities, JSON.parse(labelsText)))) throw new Error("Trade products acceptance/catalogue/canonical fingerprint mismatch");
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  const required = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];
  if (!rows.length || rows.some(row => required.some(field => !(field in row)))) throw new Error("Trade product canonical fields missing");
  const facts: TradeProductFact[] = rows.map(row => ({
    entityId: row.entity_id, year: Number(row.year), indicatorId: row.indicator_id as TradeProductFact["indicatorId"], valueUsd: row.value_usd === "" ? null : new Decimal(row.value_usd).toFixed(),
    unit: row.unit as "usd", basis: row.basis as "actual", valueStatus: row.value_status as TradeProductFact["valueStatus"], publicationStatus: row.publication_status as "unspecified", role: row.role as "detail", sourceId: row.source_id, sourceRefs: row.source_refs,
    sourceValue: row.source_value || null, sourceUnit: row.source_unit, sourceLabel: row.source_label, sourceNumberFormat: row.source_number_format, sourceBlock: row.source_block as TradeProductFact["sourceBlock"], lastReviewedAt: row.last_reviewed_at,
  }));
  validateTradeProductsData({ entities, facts }, report);
  return { entities, facts };
}
export async function loadTradeProductEntities(): Promise<TradeProductEntity[]> {
  return (await loadServedTradeProductsData()).entities;
}
export async function loadTradeProductCatalogueFingerprint(sourceBlock?: TradeProductSourceBlock): Promise<string> {
  const fingerprint = hash(await readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/trade-products-catalogue.csv")));
  return sourceBlock ? hash(`${fingerprint}:${sourceBlock}`) : fingerprint;
}
export function assertTradeProductsParity(csv: TradeProductsData, mirror: TradeProductsData): void {
  assertSameServedRows("Trade product catalogue", csv.entities, mirror.entities, entity => entity.id);
  const normalize = (facts: readonly TradeProductFact[]) => facts.map(fact => ({ ...fact, valueUsd: fact.valueUsd === null ? null : new Decimal(fact.valueUsd).toFixed() }));
  assertSameServedRows("Trade product facts", normalize(csv.facts), normalize(mirror.facts), tradeProductFactKey);
}
let servedPromise: Promise<TradeProductsData> | null = null;
export function loadServedTradeProductsData(): Promise<TradeProductsData> {
  servedPromise ??= (async () => {
    const csv = await loadTradeProductsData();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadTradeProductsDataFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadTradeProductsDataFromDb(); assertTradeProductsParity(csv, mirror); return mirror;
  })();
  return servedPromise;
}
export function toClientTradeProductsData(data: TradeProductsData, nationalFacts: readonly TradeOverviewFact[], catalogueFingerprint: string, sourceBlock?: TradeProductSourceBlock): ClientTradeProductsData {
  const entities = data.entities.filter(entity => !sourceBlock || entity.sourceBlock === sourceBlock).sort((a, b) => a.sourceBlock.localeCompare(b.sourceBlock, "en") || a.code.localeCompare(b.code, "en"));
  const indices = new Map(entities.map((entity, index) => [entity.id, index]));
  const facts = sourceBlock ? data.facts.filter(fact => indices.has(fact.entityId)) : data.facts;
  const years = [...new Set(facts.map(fact => fact.year))].sort((a, b) => a - b);
  return { entities, years, facts: facts.map(fact => [indices.get(fact.entityId)!, fact.year, fact.indicatorId === "trade.exports" ? 0 : 1, fact.valueUsd === null ? null : Number(fact.valueUsd)]), nationalFacts: nationalFacts.filter(fact => !sourceBlock || years.includes(fact.year)).map(toClientTradeOverviewFact), catalogueFingerprint, ...(sourceBlock ? { sourceBlock } : {}) };
}
