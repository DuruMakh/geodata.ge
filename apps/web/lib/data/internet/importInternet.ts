import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { internetFactKey, type ClientInternetFact, type InternetAcceptance, type InternetFact } from "./types";
import { validateInternetFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

export async function loadInternetFacts(): Promise<InternetFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/internet-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/internet-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as InternetAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Internet acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Internet canonical fields missing");
  const facts: InternetFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as InternetFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as "percent", basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateInternetFacts(facts);
  if (facts.length !== report.observations) throw new Error("Internet acceptance count mismatch");
  return facts;
}

export function assertInternetParity(csv: readonly InternetFact[], mirror: readonly InternetFact[]): void {
  const normalized = (facts: readonly InternetFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed(1) }));
  validateInternetFacts(csv);
  validateInternetFacts(normalized(mirror));
  assertSameServedRows("Internet", normalized(csv), normalized(mirror), internetFactKey);
}

let servedPromise: Promise<{ facts: InternetFact[] }> | null = null;
export function loadServedInternetData(): Promise<{ facts: InternetFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadInternetFacts();
    if (resolveServedDataSource() === "db") {
      const { loadInternetFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadInternetFactsFromDb();
      assertInternetParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are the shares Geostat prints (one decimal). Exact stored values stay server-side. */
export function toClientInternetFact(fact: InternetFact): ClientInternetFact {
  const { year, indicatorId, sourceId } = fact;
  return { year, indicatorId, sourceId, value: Number(fact.publishedValue), unit: "percent", decimals: 1 };
}
