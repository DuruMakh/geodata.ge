import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { toClientTradeOverviewFact } from "../tradeOverview/importTradeOverview";
import type { ClientTradeOverviewFact, TradeOverviewFact } from "../tradeOverview/types";
import { tradePartnerFactKey, type TradePartnerEntity, type TradePartnerFact, type TradePartnersData, type TradePartnersAcceptance } from "./types";
import { tradePartnersEnglishLabels, validateTradePartnersData } from "./validation";

export type ClientTradePartnerFact = Pick<TradePartnerFact, "entityId" | "year" | "indicatorId" | "sourceId" | "basis" | "publicationStatus" | "lastReviewedAt"> & { valueUsd: number | null };
export type ClientTradePartnersData = { entities: TradePartnerEntity[]; facts: ClientTradePartnerFact[]; nationalFacts: ClientTradeOverviewFact[] };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function loadTradePartnersData(): Promise<TradePartnersData> {
  const [csv, catalogue, reportText, labelsText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/trade-partners-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/taxonomy/trade-partners.json")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/trade-partners-validation.json"), "utf8"),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/localization/en/labels.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as TradePartnersAcceptance, entities = JSON.parse(catalogue.toString("utf8")) as TradePartnerEntity[];
  if (report.status !== "passed" || report.scope !== "annual_goods_partners" || report.canonicalSha256 !== hash(csv) || report.catalogueSha256 !== hash(catalogue) || report.englishLabelsSha256 !== hash(tradePartnersEnglishLabels(entities, JSON.parse(labelsText)))) throw new Error("Trade partners acceptance/catalogue/canonical fingerprint mismatch");
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  const required = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];
  if (!rows.length || rows.some(row => required.some(field => !(field in row)))) throw new Error("Trade partner canonical fields missing");
  const facts: TradePartnerFact[] = rows.map(row => ({
    entityId: row.entity_id, year: Number(row.year), indicatorId: row.indicator_id as TradePartnerFact["indicatorId"], valueUsd: row.value_usd === "" ? null : new Decimal(row.value_usd).toFixed(),
    unit: row.unit as "usd", basis: row.basis as "actual", valueStatus: row.value_status as TradePartnerFact["valueStatus"], publicationStatus: row.publication_status as "unspecified", role: row.role as TradePartnerFact["role"], sourceId: row.source_id, sourceRefs: row.source_refs,
    sourceValue: row.source_value || null, sourceUnit: row.source_unit || null, sourceLabel: row.source_label || null, sourceNumberFormat: row.source_number_format || null, sourceBlock: row.source_block, lastReviewedAt: row.last_reviewed_at,
  }));
  validateTradePartnersData({ entities, facts }, report);
  return { entities, facts };
}

export function assertTradePartnersParity(csv: TradePartnersData, mirror: TradePartnersData): void {
  assertSameServedRows("Trade partner catalogue", csv.entities, mirror.entities, entity => entity.id);
  const normalize = (facts: readonly TradePartnerFact[]) => facts.map(fact => ({ ...fact, valueUsd: fact.valueUsd === null ? null : new Decimal(fact.valueUsd).toFixed() }));
  assertSameServedRows("Trade partner facts", normalize(csv.facts), normalize(mirror.facts), tradePartnerFactKey);
}

let servedPromise: Promise<TradePartnersData> | null = null;
export function loadServedTradePartnersData(): Promise<TradePartnersData> {
  servedPromise ??= (async () => {
    const csv = await loadTradePartnersData();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadTradePartnersDataFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadTradePartnersDataFromDb();
    assertTradePartnersParity(csv, mirror);
    return mirror;
  })();
  return servedPromise;
}

export function toClientTradePartnersData(data: TradePartnersData, nationalFacts: readonly TradeOverviewFact[]): ClientTradePartnersData {
  return { entities: data.entities, facts: data.facts.map(({ entityId, year, indicatorId, sourceId, basis, publicationStatus, lastReviewedAt, valueUsd }) => ({ entityId, year, indicatorId, sourceId, basis, publicationStatus, lastReviewedAt, valueUsd: valueUsd === null ? null : Number(valueUsd) })), nationalFacts: nationalFacts.map(toClientTradeOverviewFact) };
}
