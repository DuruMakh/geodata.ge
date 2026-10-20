import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { transportFactKey, type ClientTransportFact, type TransportAcceptance, type TransportFact } from "./types";
import { transportDisplayDecimals, validateTransportFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

export async function loadTransportFacts(): Promise<TransportFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/transport-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/transport-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as TransportAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Transport acceptance or canonical fingerprint mismatch");
  // Sheet names are never trimmed: Geostat's owner sheet is named " type of owner ", with spaces.
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Transport canonical fields missing");
  const facts: TransportFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as TransportFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as TransportFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateTransportFacts(facts);
  if (facts.length !== report.observations) throw new Error("Transport acceptance count mismatch");
  return facts;
}

export function assertTransportParity(csv: readonly TransportFact[], mirror: readonly TransportFact[]): void {
  validateTransportFacts(csv);
  validateTransportFacts(mirror);
  const normalized = (facts: readonly TransportFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Transport", normalized(csv), normalized(mirror), transportFactKey);
}

let servedPromise: Promise<{ facts: TransportFact[] }> | null = null;
export function loadServedTransportData(): Promise<{ facts: TransportFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadTransportFacts();
    if (resolveServedDataSource() === "db") {
      const { loadTransportFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadTransportFactsFromDb();
      assertTransportParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

const CLIENT_UNITS = {
  thousand_units: "vehicles", million_passenger_km: "pkm", passenger_km_per_person: "pkmPerPerson", thousand_passengers: "passengers",
  million_tonne_km: "tkm", thousand_tonnes: "tonnes", km: "km",
} as const;

/** Client values are the figures Geostat prints (published precision). Exact stored values stay server-side. */
export function toClientTransportFact(fact: TransportFact): ClientTransportFact {
  const { year, indicatorId, sourceId } = fact;
  return { year, indicatorId, sourceId, value: Number(fact.publishedValue), unit: CLIENT_UNITS[fact.unit], decimals: transportDisplayDecimals(indicatorId) };
}
