import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { educationFactKey, type ClientEducationFact, type EducationAcceptance, type EducationFact } from "./types";
import { educationDisplayDecimals, validateEducationFacts } from "./validation";

const REQUIRED = ["year", "period_label", "indicator_id", "geography_id", "value", "published_value", "unit", "basis", "value_status", "shown", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];

export async function loadEducationFacts(): Promise<EducationFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/education-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/education-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as EducationAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Education acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Education canonical fields missing");
  if (rows.some(row => row.shown !== "true" && row.shown !== "false")) throw new Error("Education shown flag is not true or false");
  const facts: EducationFact[] = rows.map(row => ({
    year: Number(row.year), periodLabel: row.period_label, indicatorId: row.indicator_id as EducationFact["indicatorId"], geographyId: row.geography_id,
    value: row.value, publishedValue: row.published_value, unit: row.unit as EducationFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    shown: row.shown === "true", sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  // Prepare also cross-checks Georgia's rows against table 11 and the sums of regions; those read the archived workbook, so here only the facts themselves are checked.
  validateEducationFacts(facts);
  if (facts.length !== report.observations) throw new Error("Education acceptance count mismatch");
  return facts;
}

export function assertEducationParity(csv: readonly EducationFact[], mirror: readonly EducationFact[]): void {
  validateEducationFacts(csv);
  validateEducationFacts(mirror);
  const normalized = (facts: readonly EducationFact[]) => facts.map(f => ({ ...f, value: new Decimal(f.value).toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed() }));
  assertSameServedRows("Education", normalized(csv), normalized(mirror), educationFactKey);
}

let servedPromise: Promise<{ facts: EducationFact[] }> | null = null;
/** Every row, shown and hidden: pages go through `shownEducationFacts`. */
export function loadServedEducationData(): Promise<{ facts: EducationFact[] }> {
  servedPromise ??= (async () => {
    let facts = await loadEducationFacts();
    if (resolveServedDataSource() === "db") {
      const { loadEducationFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadEducationFactsFromDb();
      assertEducationParity(facts, mirror);
      facts = mirror;
    }
    return { facts };
  })();
  return servedPromise;
}

/** The old vocational fields stay in the file for the sums and never reach a page, the client or Excel. */
export function shownEducationFacts(facts: readonly EducationFact[]): EducationFact[] {
  return facts.filter(fact => fact.shown);
}

/** Client values are the figures Geostat prints (published precision): Georgia's pupils, printed in thousands, as persons; everything else as printed. Exact stored values stay server-side. */
export function toClientEducationFact(fact: EducationFact): ClientEducationFact {
  const { year, indicatorId, geographyId, sourceId } = fact;
  const published = Number(fact.publishedValue);
  const decimals = educationDisplayDecimals(indicatorId);
  return fact.unit === "persons_thousand"
    ? { year, indicatorId, geographyId, sourceId, value: published * 1000, unit: "persons", decimals }
    : { year, indicatorId, geographyId, sourceId, value: published, unit: fact.unit, decimals };
}
