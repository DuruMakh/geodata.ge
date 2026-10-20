import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { socialFactKey, type ClientSocialFact, type SocialAcceptance, type SocialFact, type SocialSeriesBreak } from "./types";
import { isMoney, socialValueText, validateSocialFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "geography_id", "value", "unit", "months", "basis", "value_status", "source_id", "source_workbook", "source_sheet", "source_cell", "last_reviewed_at"];
const BREAK_REQUIRED = ["break_id", "applies_to", "reference_date", "reason", "source_note"];

export async function loadSocialFacts(): Promise<SocialFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/social-protection-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/social-protection-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as SocialAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Social acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Social canonical fields missing");
  const facts: SocialFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as SocialFact["indicatorId"], geographyId: row.geography_id, value: row.value, unit: row.unit as SocialFact["unit"],
    months: Number(row.months), basis: row.basis as "actual", valueStatus: row.value_status as SocialFact["valueStatus"], sourceId: row.source_id,
    sourceWorkbook: row.source_workbook, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  // Prepare also recalculates every average from the research package's month-count sums; those are not in the repository's served files, so here only the facts themselves are checked.
  validateSocialFacts(facts);
  if (facts.length !== report.observations) throw new Error("Social acceptance count mismatch");
  return facts;
}

/** The counting-change register. It is read from the CSV only: the database holds no copy. */
export async function loadSocialBreaks(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<SocialSeriesBreak[]> {
  const csv = await readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/social-protection-series-breaks.csv"));
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || BREAK_REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Social series break fields missing");
  return rows.map(row => ({ breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note }));
}

export function assertSocialParity(csv: readonly SocialFact[], mirror: readonly SocialFact[]): void {
  // The same decimal may be written with trailing zeros ("405.130"); compare and validate it in the file's own form.
  const normalized = (facts: readonly SocialFact[]) => facts.map(f => ({ ...f, value: socialValueText(f.indicatorId, f.value) }));
  validateSocialFacts(normalized(csv));
  validateSocialFacts(normalized(mirror));
  assertSameServedRows("Social", normalized(csv), normalized(mirror), socialFactKey);
}

let servedPromise: Promise<{ facts: SocialFact[]; breaks: SocialSeriesBreak[] }> | null = null;
export function loadServedSocialData(): Promise<{ facts: SocialFact[]; breaks: SocialSeriesBreak[] }> {
  servedPromise ??= (async () => {
    let facts = await loadSocialFacts();
    if (resolveServedDataSource() === "db") {
      const { loadSocialFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadSocialFactsFromDb();
      assertSocialParity(facts, mirror);
      facts = mirror;
    }
    return { facts, breaks: await loadSocialBreaks() };
  })();
  return servedPromise;
}

/** Amounts are stored in GEL and shown in million GEL; averages (GEL a month) and counts stay as stored. Keyed on the measure, not the unit, because averages are in GEL too. */
export function toClientSocialFact(fact: SocialFact): ClientSocialFact {
  const { year, indicatorId, geographyId, sourceId, months, valueStatus } = fact;
  const value = isMoney(indicatorId) ? new Decimal(fact.value).div(1e6).toFixed() : fact.value;
  return { year, indicatorId, geographyId, sourceId, months, valueStatus, value: Number(value) };
}
