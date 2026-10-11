import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { povertyFactKey, type ClientPovertyFact, type PovertyAcceptance, type PovertyFact } from "./types";
import { povertyDisplayDecimals, validatePovertyFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "group_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];

export async function loadPovertyFacts(): Promise<PovertyFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/poverty-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/poverty-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as PovertyAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Poverty acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Poverty canonical fields missing");
  const facts: PovertyFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as PovertyFact["indicatorId"], groupId: row.group_id as PovertyFact["groupId"],
    value: row.value, publishedValue: row.published_value, unit: row.unit as PovertyFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: row.last_reviewed_at,
  }));
  validatePovertyFacts(facts);
  if (facts.length !== report.observations) throw new Error("Poverty acceptance count mismatch");
  return facts;
}

export function assertPovertyParity(csv: readonly PovertyFact[], mirror: readonly PovertyFact[]): void {
  validatePovertyFacts(csv);
  validatePovertyFacts(mirror);
  const normalized = (facts: readonly PovertyFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Poverty", normalized(csv), normalized(mirror), povertyFactKey);
}

let servedPromise: Promise<{ facts: PovertyFact[] }> | null = null;
export function loadServedPovertyData(): Promise<{ facts: PovertyFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadPovertyFacts();
    if (resolveServedDataSource() === "db") {
      const { loadPovertyFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadPovertyFactsFromDb();
      assertPovertyParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are the figures Geostat prints (published precision); exact stored values stay server-side. */
export function toClientPovertyFact(fact: PovertyFact): ClientPovertyFact {
  const { year, indicatorId, groupId, sourceId } = fact;
  return { year, indicatorId, groupId, sourceId, value: Number(fact.publishedValue), decimals: povertyDisplayDecimals(fact.sourceNumberFormat) };
}
