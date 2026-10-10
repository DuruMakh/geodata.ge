import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { wagesFactKey, type ClientWagesFact, type WagesAcceptance, type WagesFact } from "./types";
import { validateWagesFacts, wagesDisplayDecimals } from "./validation";

const REQUIRED = ["year", "indicator_id", "dimension", "group_id", "sector_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];

export async function loadWagesFacts(): Promise<WagesFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/wages-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/wages-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as WagesAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Wages acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Wages canonical fields missing");
  const facts: WagesFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as WagesFact["indicatorId"], dimension: row.dimension as WagesFact["dimension"], groupId: row.group_id, sectorId: row.sector_id as WagesFact["sectorId"],
    value: row.value || null, publishedValue: row.published_value || null, unit: row.unit as "gel", basis: row.basis as "actual", valueStatus: row.value_status as WagesFact["valueStatus"],
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format || null, lastReviewedAt: row.last_reviewed_at,
  }));
  validateWagesFacts(facts);
  if (facts.filter(f => f.value !== null).length !== report.numericObservations || facts.filter(f => f.value === null).length !== report.unavailableObservations) throw new Error("Wages acceptance count mismatch");
  return facts;
}

export function assertWagesParity(csv: readonly WagesFact[], mirror: readonly WagesFact[]): void {
  validateWagesFacts(csv);
  validateWagesFacts(mirror);
  const normalized = (facts: readonly WagesFact[]) => facts.map(f => ({ ...f, value: f.value === null ? null : new Decimal(f.value).toFixed(), publishedValue: f.publishedValue === null ? null : new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Wages", normalized(csv), normalized(mirror), wagesFactKey);
}

let servedPromise: Promise<{ facts: WagesFact[] }> | null = null;
export function loadServedWagesData(): Promise<{ facts: WagesFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadWagesFacts();
    if (resolveServedDataSource() === "db") {
      const { loadWagesFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadWagesFactsFromDb();
      assertWagesParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** Client values are the figures Geostat prints (published precision); exact stored values stay server-side. */
export function toClientWagesFact(fact: WagesFact): ClientWagesFact {
  const { year, indicatorId, dimension, groupId, sectorId, valueStatus, sourceId } = fact;
  return { year, indicatorId, dimension, groupId, sectorId, valueStatus, sourceId, value: fact.publishedValue === null ? null : Number(fact.publishedValue), decimals: fact.sourceNumberFormat === null ? 0 : wagesDisplayDecimals(fact.sourceNumberFormat) };
}
