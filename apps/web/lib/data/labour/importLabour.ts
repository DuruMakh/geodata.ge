import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { labourFactKey, type ClientLabourFact, type LabourFact } from "./types";
import { validateLabourFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

/** `repositoryRoot` defaults to the repository the web app runs in; tests point it at a temporary copy. */
export async function loadLabourFacts(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<LabourFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/labour-annual.csv")),
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/reports/labour-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as { status: string; observations: number; canonicalSha256: string };
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Labour acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Labour canonical fields missing");
  const facts: LabourFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as LabourFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as LabourFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateLabourFacts(facts, repositoryRoot);
  if (facts.length !== report.observations) throw new Error("Labour acceptance count mismatch");
  return facts;
}

export function assertLabourParity(csv: readonly LabourFact[], mirror: readonly LabourFact[]): void {
  // The database stores decimals, so "1.6567258500672373E-2" may come back as "0.016567258500672373" and "0.0" as "0"; compare and validate the same figure written one way.
  const normalized = (facts: readonly LabourFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  const [csvRows, mirrorRows] = [normalized(csv), normalized(mirror)];
  validateLabourFacts(csvRows);
  validateLabourFacts(mirrorRows);
  assertSameServedRows("Labour", csvRows, mirrorRows, labourFactKey);
}

let servedPromise: Promise<{ facts: LabourFact[] }> | null = null;
export function loadServedLabourData(): Promise<{ facts: LabourFact[] }> {
  servedPromise ??= loadLabourFacts().then(facts => ({ facts }));
  return servedPromise;
}

/** The pages show the published one-decimal figure, so the client gets that number and not the stored one. */
export function toClientLabourFact(fact: LabourFact): ClientLabourFact {
  const { year, indicatorId, sourceId, unit } = fact;
  return { year, indicatorId, sourceId, unit, value: Number(fact.publishedValue) };
}
