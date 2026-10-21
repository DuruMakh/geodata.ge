import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { housingFactKey, type ClientHousingFact, type HousingAcceptance, type HousingFact } from "./types";
import { housingDisplayDecimals, validateHousingFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

export async function loadHousingFacts(): Promise<HousingFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/housing-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/housing-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as HousingAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Housing acceptance or canonical fingerprint mismatch");
  // Sheet names are never trimmed: Geostat's 2012 sheet is named "2012 " with a trailing space.
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Housing canonical fields missing");
  const facts: HousingFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as HousingFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as HousingFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateHousingFacts(facts);
  if (facts.length !== report.observations) throw new Error("Housing acceptance count mismatch");
  return facts;
}

export function assertHousingParity(csv: readonly HousingFact[], mirror: readonly HousingFact[]): void {
  validateHousingFacts(csv);
  validateHousingFacts(mirror);
  const normalized = (facts: readonly HousingFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Housing", normalized(csv), normalized(mirror), housingFactKey);
}

let servedPromise: Promise<{ facts: HousingFact[] }> | null = null;
export function loadServedHousingData(): Promise<{ facts: HousingFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadHousingFacts();
    if (resolveServedDataSource() === "db") {
      const { loadHousingFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadHousingFactsFromDb();
      assertHousingParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

const CLIENT_UNITS = { count: "count", square_metres: "area", index_2020: "index", gel_per_square_metre: "price" } as const;

/** Client values are the figures Geostat prints (published precision). Exact stored values stay server-side. */
export function toClientHousingFact(fact: HousingFact): ClientHousingFact {
  const { year, indicatorId, sourceId } = fact;
  return { year, indicatorId, sourceId, value: Number(fact.publishedValue), unit: CLIENT_UNITS[fact.unit], decimals: housingDisplayDecimals(indicatorId) };
}
