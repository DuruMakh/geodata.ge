import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { environmentFactKey, type ClientEnvironmentFact, type EnvironmentFact } from "./types";
import { validateEnvironmentFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

/** `repositoryRoot` defaults to the repository the web app runs in; tests point it at a temporary copy. */
export async function loadEnvironmentFacts(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<EnvironmentFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/environment-annual.csv")),
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/reports/environment-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as { status: string; observations: number; canonicalSha256: string };
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Environment acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Environment canonical fields missing");
  const facts: EnvironmentFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id, value: row.value, publishedValue: row.published_value,
    unit: row.unit as EnvironmentFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateEnvironmentFacts(facts, repositoryRoot);
  if (facts.length !== report.observations) throw new Error("Environment acceptance count mismatch");
  return facts;
}

export function assertEnvironmentParity(csv: readonly EnvironmentFact[], mirror: readonly EnvironmentFact[]): void {
  // The database stores decimals, so 31 may come back as "31.000"; compare and validate the same figure written one way.
  const normalized = (facts: readonly EnvironmentFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  const [csvRows, mirrorRows] = [normalized(csv), normalized(mirror)];
  validateEnvironmentFacts(csvRows);
  validateEnvironmentFacts(mirrorRows);
  assertSameServedRows("Environment", csvRows, mirrorRows, environmentFactKey);
}

let servedPromise: Promise<EnvironmentFact[]> | null = null;
export function loadServedEnvironmentData(): Promise<EnvironmentFact[]> {
  servedPromise ??= (async () => {
    const facts = await loadEnvironmentFacts();
    if (resolveServedDataSource() !== "db") return facts;
    const { loadEnvironmentFactsFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadEnvironmentFactsFromDb();
    assertEnvironmentParity(facts, mirror);
    return mirror;
  })();
  return servedPromise;
}

/** The client gets the published number and how many decimals Geostat printed it with (none for "31", one for "10.3"). */
export function toClientEnvironmentFact(fact: EnvironmentFact): ClientEnvironmentFact {
  const { year, indicatorId, sourceId, unit } = fact;
  const published = new Decimal(fact.publishedValue);
  return { year, indicatorId, sourceId, unit, value: published.toNumber(), decimals: published.decimalPlaces() };
}
