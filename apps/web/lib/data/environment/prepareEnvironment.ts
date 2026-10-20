import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import { CRIME_CSV_HEADERS } from "../crime/prepareCrime";
import { ENVIRONMENT_INDICATORS, ENVIRONMENT_PUBLIC_SOURCES, ENVIRONMENT_RESEARCH_DIRECTORY, ENVIRONMENT_SOURCES, environmentFactKey, type EnvironmentFact } from "./types";
import { validateEnvironmentFacts } from "./validation";

export const REVIEWED_AT = "2026-10-20";
/** The canonical file has Crime's columns: a value's decimals are read from the published value, so the package's `decimals` column is not copied. */
export const ENVIRONMENT_CSV_HEADERS = CRIME_CSV_HEADERS;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

const collapse = (text: string) => text.replace(/​/g, "").split(/\s+/).filter(Boolean).join(" ");
/** A number printed as text with a footnote mark, such as "47*". */
const STARRED = /^(\d+(?:\.\d+)?)\*$/;

/**
 * The published number of a served cell as plain text, as the research package writes it: a number rounded to 12 significant
 * digits (dropping floating noise such as -6.699999999999999), or a footnoted number printed as text. A "-" is zero only in
 * the illegal-logging table, whose legend says "magnitude nil"; any other placeholder is no value.
 */
export function environmentCellValue(cell: XLSX.CellObject | undefined, sourceId: string): string | undefined {
  if (cell?.t === "n" && typeof cell.v === "number") return String(Number(cell.v.toPrecision(12)));
  const text = cell?.t === "s" ? collapse(String(cell.v)) : "";
  if (text === "-" && sourceId === "geostat_env_illegal_logging") return "0";
  const starred = STARRED.exec(text);
  return starred ? String(Number(starred[1])) : undefined;
}

/**
 * Promotes the research package's 2,125 observations into the canonical serving CSV. Every value is re-read from its
 * archived workbook cell (SheetJS reads both the .xlsx and the old .xls files); nothing is calculated.
 */
export async function prepareEnvironmentData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, ENVIRONMENT_RESEARCH_DIRECTORY);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== ENVIRONMENT_PUBLIC_SOURCES.length || ENVIRONMENT_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) {
    throw new Error("Environment source inventory mismatch");
  }
  const books = new Map<string, XLSX.WorkBook>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Environment source capture mismatch: ${source.local_file}`);
    // The Georgian versions, the other workbooks and the page captures are archived only; none of their cells is served.
    if (ENVIRONMENT_SOURCES.includes(source.source_id)) books.set(source.source_id, XLSX.read(bytes, { type: "buffer" }));
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as {
    status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number; calculated_values: number; placeholder_cells_in_served_values: number;
  };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string; observations: number };
  if (
    report.status !== "passed" || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || report.calculated_values !== 0 ||
    report.placeholder_cells_in_served_values !== 0 || independent.status !== "passed" || independent.observations !== report.primary_observation_count
  ) throw new Error("Environment research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "environment-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  if (rows.length !== report.primary_observation_count) throw new Error("Environment observation count differs from the research report");
  const facts: EnvironmentFact[] = rows.map(row => {
    const book = books.get(row.source_id);
    if (!book || environmentCellValue(book.Sheets[row.source_sheet]?.[row.source_cell], row.source_id) !== row.value) {
      throw new Error(`Environment source cell mismatch: ${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    }
    return {
      year: Number(row.year), indicatorId: row.indicator_id, value: row.value, publishedValue: row.published_value,
      unit: row.unit as EnvironmentFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateEnvironmentFacts(facts, repositoryRoot);
  const order = new Map<string, number>(ENVIRONMENT_INDICATORS.map((id, index) => [id, index]));
  facts.sort((a, b) => order.get(a.indicatorId)! - order.get(b.indicatorId)! || a.year - b.year);
  if (new Set(facts.map(environmentFactKey)).size !== facts.length) throw new Error("Duplicate environment observation");
  const csv = serializeBomCsvRows([ENVIRONMENT_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/environment-annual.csv", csv], ["data/reports/environment-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("environment", target, content);
  }
}
