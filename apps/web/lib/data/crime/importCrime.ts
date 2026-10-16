import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { crimeFactKey, type ClientCrimeFact, type CrimeFact, type CrimeSeriesBreak } from "./types";
import { validateCrimeFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
const BREAK_REQUIRED = ["break_id", "applies_to", "reference_date", "reason", "source_note"];

/** `repositoryRoot` defaults to the repository the web app runs in; tests point it at a temporary copy. */
export async function loadCrimeFacts(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<CrimeFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/crime-annual.csv")),
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/reports/crime-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as { status: string; observations: number; canonicalSha256: string };
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Crime acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Crime canonical fields missing");
  const facts: CrimeFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as CrimeFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as CrimeFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateCrimeFacts(facts, repositoryRoot);
  if (facts.length !== report.observations) throw new Error("Crime acceptance count mismatch");
  return facts;
}

/** The counting-change register. It is read from the CSV only: the database holds no copy. */
export async function loadCrimeBreaks(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<CrimeSeriesBreak[]> {
  const csv = await readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/crime-series-breaks.csv"));
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || BREAK_REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Crime series break fields missing");
  return rows.map(row => ({ breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note }));
}

export function assertCrimeParity(csv: readonly CrimeFact[], mirror: readonly CrimeFact[]): void {
  // The database stores decimals, so a whole count may come back as "22767.0"; compare and validate the same figure written one way.
  const normalized = (facts: readonly CrimeFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  const [csvRows, mirrorRows] = [normalized(csv), normalized(mirror)];
  validateCrimeFacts(csvRows);
  validateCrimeFacts(mirrorRows);
  assertSameServedRows("Crime", csvRows, mirrorRows, crimeFactKey);
}

let servedPromise: Promise<{ facts: CrimeFact[]; breaks: CrimeSeriesBreak[] }> | null = null;
export function loadServedCrimeData(): Promise<{ facts: CrimeFact[]; breaks: CrimeSeriesBreak[] }> {
  servedPromise ??= (async () => {
    let facts = await loadCrimeFacts();
    if (resolveServedDataSource() === "db") {
      const { loadCrimeFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadCrimeFactsFromDb();
      assertCrimeParity(facts, mirror);
      facts = mirror;
    }
    return { facts, breaks: await loadCrimeBreaks() };
  })();
  return servedPromise;
}

/** Every served value is a whole count, so the client gets the published number as is. */
export function toClientCrimeFact(fact: CrimeFact): ClientCrimeFact {
  const { year, indicatorId, sourceId, unit } = fact;
  return { year, indicatorId, sourceId, unit, value: Number(fact.publishedValue) };
}
