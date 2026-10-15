import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { healthFactKey, type ClientHealthFact, type HealthAcceptance, type HealthFact, type HealthSeriesBreak } from "./types";
import { healthDisplayDecimals, validateHealthFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "area_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];
const BREAK_REQUIRED = ["break_id", "applies_to", "reference_date", "reason", "source_note"];

/** `repositoryRoot` defaults to the repository the web app runs in; tests point it at a temporary copy. */
export async function loadHealthFacts(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<HealthFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/health-annual.csv")),
    readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/reports/health-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as HealthAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Health acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Health canonical fields missing");
  const facts: HealthFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as HealthFact["indicatorId"], areaId: row.area_id as HealthFact["areaId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as HealthFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "published",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: row.last_reviewed_at,
  }));
  validateHealthFacts(facts);
  if (facts.length !== report.observations) throw new Error("Health acceptance count mismatch");
  return facts;
}

/** The counting-change register. It is read from the CSV only: the database holds no copy. */
export async function loadHealthBreaks(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<HealthSeriesBreak[]> {
  const csv = await readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/health-series-breaks.csv"));
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || BREAK_REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Health series break fields missing");
  return rows.map(row => ({ breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note }));
}

export function assertHealthParity(csv: readonly HealthFact[], mirror: readonly HealthFact[]): void {
  validateHealthFacts(csv);
  validateHealthFacts(mirror);
  const normalized = (facts: readonly HealthFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Health", normalized(csv), normalized(mirror), healthFactKey);
}

let servedPromise: Promise<{ facts: HealthFact[]; breaks: HealthSeriesBreak[] }> | null = null;
export function loadServedHealthData(): Promise<{ facts: HealthFact[]; breaks: HealthSeriesBreak[] }> {
  servedPromise ??= (async () => {
    let facts = await loadHealthFacts();
    if (resolveServedDataSource() === "db") {
      const { loadHealthFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadHealthFactsFromDb();
      assertHealthParity(facts, mirror);
      facts = mirror;
    }
    return { facts, breaks: await loadHealthBreaks() };
  })();
  return servedPromise;
}

/** Client values are the figures Geostat prints (published precision); exact stored values stay server-side. */
export function toClientHealthFact(fact: HealthFact): ClientHealthFact {
  const { year, indicatorId, areaId, sourceId, unit } = fact;
  return { year, indicatorId, areaId, sourceId, unit, value: Number(fact.publishedValue), decimals: healthDisplayDecimals(fact.sourceNumberFormat, fact.value, fact.unit) };
}
