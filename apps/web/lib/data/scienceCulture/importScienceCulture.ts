import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { scienceCultureFactKey, type ClientScienceCultureFact, type ScienceCultureAcceptance, type ScienceCultureFact, type ScienceCultureSeriesBreak } from "./types";
import { scienceCultureDisplayDecimals, validateScienceCultureFacts } from "./validation";

const REQUIRED = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
const BREAK_REQUIRED = ["break_id", "applies_to", "reference_date", "reason", "source_note"];

export async function loadScienceCultureFacts(): Promise<ScienceCultureFact[]> {
  const [csv, reportText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/science-culture-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/science-culture-validation.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as ScienceCultureAcceptance;
  if (report.status !== "passed" || createHash("sha256").update(csv).digest("hex") !== report.canonicalSha256) throw new Error("Science and culture acceptance or canonical fingerprint mismatch");
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Science and culture canonical fields missing");
  const facts: ScienceCultureFact[] = rows.map(row => ({
    year: Number(row.year), indicatorId: row.indicator_id as ScienceCultureFact["indicatorId"], value: row.value, publishedValue: row.published_value,
    unit: row.unit as ScienceCultureFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
    sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: row.last_reviewed_at,
  }));
  validateScienceCultureFacts(facts);
  if (facts.length !== report.observations) throw new Error("Science and culture acceptance count mismatch");
  return facts;
}

/** The counting-change register. It is read from the CSV only: the database holds no copy. */
export async function loadScienceCultureBreaks(repositoryRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..")): Promise<ScienceCultureSeriesBreak[]> {
  const csv = await readFile(path.join(/* turbopackIgnore: true */ repositoryRoot, "data/imports/science-culture-series-breaks.csv"));
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || BREAK_REQUIRED.some(field => rows.some(row => !(field in row)))) throw new Error("Science and culture series break fields missing");
  return rows.map(row => ({ breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note }));
}

export function assertScienceCultureParity(csv: readonly ScienceCultureFact[], mirror: readonly ScienceCultureFact[]): void {
  // The database stores decimals, so a figure may come back as "261.0" or lose its trailing zero ("171" for "171.0"); write each figure one way,
  // with the published value at the larger of the display precision and the stored decimals, then validate and compare.
  const canonical = (facts: readonly ScienceCultureFact[]) => facts.map(f => {
    const value = new Decimal(f.value);
    const places = Math.max(scienceCultureDisplayDecimals(f.indicatorId), value.decimalPlaces());
    return { ...f, value: value.toFixed(), publishedValue: new Decimal(f.publishedValue).toFixed(places) };
  });
  const [csvRows, mirrorRows] = [canonical(csv), canonical(mirror)];
  validateScienceCultureFacts(csvRows);
  validateScienceCultureFacts(mirrorRows);
  assertSameServedRows("Science and culture", csvRows, mirrorRows, scienceCultureFactKey);
}

let servedPromise: Promise<{ facts: ScienceCultureFact[]; breaks: ScienceCultureSeriesBreak[] }> | null = null;
export function loadServedScienceCultureData(): Promise<{ facts: ScienceCultureFact[]; breaks: ScienceCultureSeriesBreak[] }> {
  servedPromise ??= (async () => {
    let facts = await loadScienceCultureFacts();
    if (resolveServedDataSource() === "db") {
      const { loadScienceCultureFactsFromDb } = await import("../../db/servedDataDb");
      const mirror = await loadScienceCultureFactsFromDb();
      assertScienceCultureParity(facts, mirror);
      facts = mirror;
    }
    return { facts, breaks: await loadScienceCultureBreaks() };
  })();
  return servedPromise;
}

const CLIENT_UNITS = { persons: "persons", persons_thousand: "thousand", count_thousand: "thousand", count: "count", gel_million: "gel" } as const;

/** Client values are the figures Geostat prints (published precision). Exact stored values stay server-side. */
export function toClientScienceCultureFact(fact: ScienceCultureFact): ClientScienceCultureFact {
  const { year, indicatorId, sourceId } = fact;
  return { year, indicatorId, sourceId, value: Number(fact.publishedValue), unit: CLIENT_UNITS[fact.unit], decimals: scienceCultureDisplayDecimals(indicatorId) };
}
