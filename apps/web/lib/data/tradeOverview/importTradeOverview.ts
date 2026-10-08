import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { tradeOverviewFactKey, type ClientTradeOverviewFact, type TradeOverviewAcceptance, type TradeOverviewFact } from "./types";
import { validateTradeOverviewFacts } from "./validation";

export async function loadTradeOverviewFacts(): Promise<TradeOverviewFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/trade-overview-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/trade-overview-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as TradeOverviewAcceptance;
  if (report.status !== "passed" || report.scope !== "national_goods_overview" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) {
    throw new Error("Trade Overview acceptance or canonical fingerprint mismatch");
  }
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const required = ["year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "last_reviewed_at"];
  if (!rows.length || required.some(field => rows.some(row => !(field in row)))) throw new Error("Trade Overview canonical fields missing");
  const facts: TradeOverviewFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as TradeOverviewFact["indicatorId"], valueUsd: new Decimal(row.value_usd).toFixed(),
    unit: row.unit as "usd", basis: row.basis as "actual", valueStatus: row.value_status as "numeric", publicationStatus: row.publication_status as "unspecified", role: row.role as TradeOverviewFact["role"],
    sourceId: row.source_id, sourceRefs: row.source_refs, sourceValue: row.source_value || null, sourceUnit: row.source_unit || null, sourceLabel: row.source_label || null, sourceNumberFormat: row.source_number_format || null, lastReviewedAt: row.last_reviewed_at,
  }));
  validateTradeOverviewFacts(facts, report.years);
  if (facts.filter(f => f.role === "total").length !== report.primaryObservations || facts.filter(f => f.role === "derived").length !== report.derivedObservations) throw new Error("Trade Overview acceptance count mismatch");
  return facts;
}

export function assertTradeOverviewParity(csv: readonly TradeOverviewFact[], mirror: readonly TradeOverviewFact[]): void {
  const years = [...new Set(csv.map(f => f.year))].sort((a, b) => a - b);
  validateTradeOverviewFacts(csv, years);
  validateTradeOverviewFacts(mirror, years);
  const normalized = (facts: readonly TradeOverviewFact[]) => facts.map(f => ({ ...f, valueUsd: new Decimal(f.valueUsd).toFixed() }));
  assertSameServedRows("Trade Overview", normalized(csv), normalized(mirror), tradeOverviewFactKey);
}

let servedPromise: Promise<{ facts: TradeOverviewFact[] }> | null = null;
export function loadServedTradeOverviewData(): Promise<{ facts: TradeOverviewFact[] }> {
  servedPromise ??= (async () => {
    const mode = resolveServedDataSource();
    let facts = await loadTradeOverviewFacts();
    if (mode === "db") {
      const { loadTradeOverviewFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadTradeOverviewFactsFromDb();
      assertTradeOverviewParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

export function toClientTradeOverviewFact(fact: TradeOverviewFact): ClientTradeOverviewFact {
  const { year, indicatorId, sourceId, publicationStatus, role, lastReviewedAt } = fact;
  return { year, indicatorId, sourceId, publicationStatus, role, lastReviewedAt, valueUsd: Number(fact.valueUsd) };
}
