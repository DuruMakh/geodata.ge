import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import {
  CRIME_INDICATORS, CRIME_PUBLIC_SOURCES, CRIME_RESEARCH_DIRECTORY, CRIME_SOURCES, crimeFactKey, type CrimeFact, type CrimeSeriesBreak,
} from "./types";
import { validateCrimeFacts } from "./validation";

export const REVIEWED_AT = "2026-10-16";
export const CRIME_CSV_HEADERS = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
const BREAK_HEADERS = ["break_id", "applies_to", "reference_date", "reason", "source_note"];
const BREAK_IDS = ["registration_2018", "drunk_driving_coverage_2025"];
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

const collapse = (text: string) => text.replace(/​/g, "").split(/\s+/).filter(Boolean).join(" ");
/** A whole number printed as text with a space for thousands, such as "49 976". */
const GROUPED = /^\d{1,3}( \d{3})+$/;

/** The exact whole count of a served cell: a number, or a number printed as text with a space. A placeholder or a fraction is none. */
function cellCount(cell: XLSX.CellObject | undefined): string | undefined {
  if (cell?.t === "n") return typeof cell.v === "number" && Number.isInteger(cell.v) && cell.v >= 0 ? String(cell.v) : undefined;
  const text = cell?.t === "s" ? collapse(String(cell.v)) : "";
  return GROUPED.test(text) ? text.replace(/ /g, "") : undefined;
}

const TOTAL_LABEL = "Total number of convicts";
/**
 * The three convictions workbooks print one total of convicts: the age-and-sex workbook twice, once above its age block and once
 * above its sex block. Each printed total row is read under its own year heading and must equal the served total in every year.
 */
function assertConvictTotalsAgree(sheets: Map<string, XLSX.WorkSheet>, facts: readonly CrimeFact[]) {
  const served = new Map(facts.filter(f => f.indicatorId === "crime.convicted.total").map(f => [f.year, f.value]));
  for (const sourceId of ["geostat_crime_convicts_types", "geostat_crime_convicts_age_sex", "geostat_crime_convicts_penalties"]) {
    const sheet = sheets.get(sourceId)!;
    const cells = Object.keys(sheet).filter(address => /^[A-Z]+\d+$/.test(address)).map(address => ({ ...XLSX.utils.decode_cell(address), address }));
    const rowCells = (row: number) => cells.filter(cell => cell.r === row && cell.c > 0);
    // A heading row has at least three numbers right of column A, all whole years in increasing order.
    const headings = [...new Set(cells.map(cell => cell.r))].filter(row => {
      const numbers = rowCells(row).filter(cell => sheet[cell.address].t === "n").sort((a, b) => a.c - b.c).map(cell => sheet[cell.address].v as number);
      return numbers.length >= 3 && numbers.every((n, i) => Number.isInteger(n) && n >= 1900 && n <= 2100 && (i === 0 || n > numbers[i - 1]));
    }).sort((a, b) => a - b);
    const totals = cells.filter(cell => cell.c === 0 && sheet[cell.address].t === "s" && collapse(String(sheet[cell.address].v)) === TOTAL_LABEL);
    if (totals.length === 0 || (sourceId === "geostat_crime_convicts_age_sex") !== (totals.length === 2)) throw new Error(`Crime convict total row not found as expected: ${sourceId}`);
    for (const total of totals) {
      const heading = Math.max(...headings.filter(row => row < total.r));
      if (!Number.isFinite(heading)) throw new Error(`Crime convict total has no year heading: ${sourceId}`);
      const printed = new Map<number, string | undefined>(
        rowCells(heading).filter(cell => sheet[cell.address].t === "n").map(cell => [sheet[cell.address].v as number, cellCount(sheet[XLSX.utils.encode_cell({ r: total.r, c: cell.c })])]),
      );
      for (const [year, value] of served) {
        if (printed.get(year) !== value) throw new Error(`Crime convict totals differ between workbooks: ${sourceId} ${year}`);
      }
    }
  }
}

/**
 * Promotes the research package's 1,262 primary observations into the canonical serving CSV.
 * Every value is re-read from its archived workbook cell (SheetJS reads both the .xlsx and the old .xls files).
 */
export async function prepareCrimeData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, CRIME_RESEARCH_DIRECTORY);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== CRIME_PUBLIC_SOURCES.length || CRIME_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Crime source inventory mismatch");
  const books = new Map<string, XLSX.WorkBook>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Crime source capture mismatch: ${source.local_file}`);
    // The other workbooks and the page captures are archived only; none of their cells is served.
    if (CRIME_SOURCES.includes(source.source_id)) books.set(source.source_id, XLSX.read(bytes, { type: "buffer" }));
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as {
    status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number; calculated_values: number; placeholder_cells_in_served_values: number;
  };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string };
  if (
    report.status !== "passed" || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || report.calculated_values !== 0 ||
    report.placeholder_cells_in_served_values !== 0 || independent.status !== "passed"
  ) throw new Error("Crime research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "crime-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  if (rows.length !== report.primary_observation_count) throw new Error("Crime observation count differs from the research report");
  const facts: CrimeFact[] = rows.map(row => {
    const book = books.get(row.source_id);
    if (!book || cellCount(book.Sheets[row.source_sheet]?.[row.source_cell]) !== row.value) {
      throw new Error(`Crime source cell mismatch: ${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    }
    return {
      year: Number(row.year), indicatorId: row.indicator_id as CrimeFact["indicatorId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as CrimeFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateCrimeFacts(facts, repositoryRoot);
  assertConvictTotalsAgree(new Map([...books].map(([id, book]) => [id, book.Sheets[book.SheetNames[0]]])), facts);
  const order = new Map<string, number>(CRIME_INDICATORS.map((id, index) => [id, index]));
  facts.sort((a, b) => order.get(a.indicatorId)! - order.get(b.indicatorId)! || a.year - b.year);
  const csv = serializeBomCsvRows([CRIME_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  // The breaks file is copied as it is; it must parse as break rows whose indicator IDs are all served.
  const breaks = await fs.readFile(path.join(directory, "crime-series-breaks.csv"), "utf8");
  const breakRows = (parse(breaks, { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[]).map((row): CrimeSeriesBreak => ({
    breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note,
  }));
  const served = new Set<string>(facts.map(f => f.indicatorId));
  if (
    breaks.split("\n")[0].replace(/^﻿/, "") !== BREAK_HEADERS.join(",") || breakRows.map(row => row.breakId).join() !== BREAK_IDS.join() ||
    breakRows.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.referenceDate) || !row.reason || !row.sourceNote || row.appliesTo.some(id => !(CRIME_INDICATORS as readonly string[]).includes(id) || !served.has(id)))
  ) throw new Error("Crime series break register is invalid");
  const years = facts.map(f => f.year);
  const acceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  if (new Set(facts.map(crimeFactKey)).size !== facts.length) throw new Error("Duplicate crime observation");
  for (const [relative, content] of [["data/imports/crime-annual.csv", csv], ["data/imports/crime-series-breaks.csv", breaks], ["data/reports/crime-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("crime", target, content);
  }
}
