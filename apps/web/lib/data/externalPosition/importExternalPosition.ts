import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { externalPositionFactKey, type ClientExternalPositionFact, type ExternalPositionAcceptance, type ExternalPositionFact } from "./types";
import { validateExternalPositionFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "period_end", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

export async function loadExternalPositionFacts(): Promise<ExternalPositionFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/external-position-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/external-position-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as ExternalPositionAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("External position acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("External position canonical fields missing");
  const facts: ExternalPositionFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as ExternalPositionFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as "usd_million", periodEnd: row.period_end, basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateExternalPositionFacts(facts);
  if (facts.length !== report.observations) throw new Error("External position acceptance count mismatch");
  return facts;
}

export function assertExternalPositionParity(csv: readonly ExternalPositionFact[], mirror: readonly ExternalPositionFact[]): void {
  validateExternalPositionFacts(csv);
  validateExternalPositionFacts(mirror);
  const normalized = (facts: readonly ExternalPositionFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("External position", normalized(csv), normalized(mirror), externalPositionFactKey);
}

let servedPromise: Promise<{ facts: ExternalPositionFact[] }> | null = null;
export function loadServedExternalPositionData(): Promise<{ facts: ExternalPositionFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadExternalPositionFacts();
    if (resolveServedDataSource() === "db") {
      const { loadExternalPositionFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadExternalPositionFactsFromDb();
      assertExternalPositionParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are the figures NBG prints (one decimal), in US dollars. Exact stored values stay server-side. */
export function toClientExternalPositionFact(fact: ExternalPositionFact): ClientExternalPositionFact {
  const { year, indicatorId, periodEnd, sourceId } = fact;
  return { year, indicatorId, sourceId, periodEnd, value: Number(fact.publishedValue) * 1_000_000, latestPeriod: !periodEnd.endsWith("-12-31") };
}
