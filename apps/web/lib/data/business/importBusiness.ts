import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { businessFactKey, type BusinessAcceptance, type BusinessFact, type ClientBusinessFact } from "./types";
import { businessDisplayDecimals, validateBusinessFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

export async function loadBusinessFacts(): Promise<BusinessFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/business-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/business-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as BusinessAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Business acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Business canonical fields missing");
  const facts: BusinessFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as BusinessFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as BusinessFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateBusinessFacts(facts);
  if (facts.length !== report.observations) throw new Error("Business acceptance count mismatch");
  return facts;
}

export function assertBusinessParity(csv: readonly BusinessFact[], mirror: readonly BusinessFact[]): void {
  validateBusinessFacts(csv);
  validateBusinessFacts(mirror);
  const normalized = (facts: readonly BusinessFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Business", normalized(csv), normalized(mirror), businessFactKey);
}

let servedPromise: Promise<{ facts: BusinessFact[] }> | null = null;
export function loadServedBusinessData(): Promise<{ facts: BusinessFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadBusinessFacts();
    if (resolveServedDataSource() === "db") {
      const { loadBusinessFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadBusinessFactsFromDb();
      assertBusinessParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are the figures Geostat prints (published precision): amounts in lari, firms and persons as counts, rates in percent. Exact stored values stay server-side. */
export function toClientBusinessFact(fact: BusinessFact): ClientBusinessFact {
  const { year, indicatorId, sourceId } = fact;
  const published = Number(fact.publishedValue);
  const decimals = businessDisplayDecimals(indicatorId);
  return fact.unit === "gel_million"
    ? { year, indicatorId, sourceId, value: published * 1_000_000, unit: "gel", decimals }
    : { year, indicatorId, sourceId, value: published, unit: fact.unit, decimals };
}
