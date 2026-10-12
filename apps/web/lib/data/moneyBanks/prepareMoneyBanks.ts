import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import { MONEY_BANKS_INDICATORS, MONEY_BANKS_PUBLIC_SOURCES, MONEY_BANKS_SOURCES, type MoneyBanksAcceptance, type MoneyBanksFact, type MoneyBanksSeriesBreak } from "./types";
import { validateMoneyBanksFacts } from "./validation";

const RESEARCH = "docs/Raw Data/Money/nbg-money-banks-annual";
export const REVIEWED_AT = "2026-10-11";
export const MONEY_BANKS_CSV_HEADERS = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
const BREAK_HEADERS = ["break_id", "applies_to", "reference_date", "reason", "source_note"];
const BREAK_IDS = ["fsi_method_2022", "fsi_ifrs_2023"];
/** The research package computes its derived rows with 28 significant digits, round-half-even. */
const CALC = Decimal.clone({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN });
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

/**
 * Recomputes a calculated row from the workbook cells its `source_cell` names. A deposit total is
 * `a+b`; a share is `a/b` or `a/(b+c)`. `source_sheet` carries the matching sheets in the same order,
 * and a single name stands for every cell. All inputs of a row come from the row's own workbook.
 */
function recompute(row: CsvRecord, numeric: Map<string, string>): Decimal {
  const cell = (sheet: string, address: string) => {
    const token = numeric.get(`${row.source_id}:${sheet}:${address}`);
    if (token === undefined) throw new Error(`Money and banks input cell is not a number: ${row.source_id}:${sheet}:${address}`);
    return new CALC(token);
  };
  const unwrap = (text: string) => text.replace(/^\((.*)\)$/, "$1");
  const sum = (sheets: string[], cells: string[]) => {
    if (cells.length !== 2 || (sheets.length !== 1 && sheets.length !== 2)) throw new Error(`Money and banks calculated row has an unexpected shape: ${row.indicator_id}:${row.year}`);
    return cell(sheets[0], cells[0]).plus(cell(sheets[sheets.length - 1], cells[1]));
  };
  if (!row.source_cell.includes("/")) return sum(row.source_sheet.split("+"), row.source_cell.split("+"));
  const [numeratorSheet, denominatorSheets = numeratorSheet] = row.source_sheet.split("/").map(unwrap);
  const [numeratorCell, denominatorCells] = row.source_cell.split("/").map(unwrap);
  const denominator = denominatorCells.includes("+") ? sum(denominatorSheets.split("+"), denominatorCells.split("+")) : cell(denominatorSheets, denominatorCells);
  return cell(numeratorSheet, numeratorCell).times(100).div(denominator);
}

/**
 * Promotes the research package's 730 observations into the canonical serving CSV. Every official
 * value is re-read from its archived workbook cell and every calculated value is recomputed from its inputs.
 */
export async function prepareMoneyBanksData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== MONEY_BANKS_PUBLIC_SOURCES.length || MONEY_BANKS_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Money and banks source inventory mismatch");
  const numeric = new Map<string, string>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Money and banks source capture mismatch: ${source.local_file}`);
    if (!MONEY_BANKS_SOURCES.includes(source.source_id)) continue;
    const book = XLSX.read(bytes, { type: "buffer" });
    const xml = unzipSync(bytes);
    book.SheetNames.forEach((name, i) => {
      for (const match of strFromU8(xml[`xl/worksheets/sheet${i + 1}.xml`]).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
        const token = /<v>([^<]+)<\/v>/.exec(match[2] ?? "")?.[1];
        if (address && token && book.Sheets[name][address]?.t === "n") numeric.set(`${source.source_id}:${name}:${address}`, token);
      }
    });
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string };
  if (report.status !== "passed" || report.primary_observation_count !== 730 || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || independent.status !== "passed") throw new Error("Money and banks research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "money-banks-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  const facts: MoneyBanksFact[] = rows.map(row => {
    const key = `${row.indicator_id}:${row.year}`;
    if (row.value_status === "official") {
      if (numeric.get(`${row.source_id}:${row.source_sheet}:${row.source_cell}`) !== row.value) throw new Error(`Money and banks source cell mismatch: ${key}`);
    } else if (row.value_status !== "calculated" || !recompute(row, numeric).eq(row.value)) throw new Error(`Money and banks calculated value does not follow its source cells: ${key}`);
    return {
      year: Number(row.year), indicatorId: row.indicator_id as MoneyBanksFact["indicatorId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as MoneyBanksFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as MoneyBanksFact["valueStatus"],
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateMoneyBanksFacts(facts);
  facts.sort((a, b) => MONEY_BANKS_INDICATORS.indexOf(a.indicatorId) - MONEY_BANKS_INDICATORS.indexOf(b.indicatorId) || a.year - b.year);
  const csv = serializeBomCsvRows([MONEY_BANKS_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const breakRows = (parse(await fs.readFile(path.join(directory, "money-banks-series-breaks.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[]).map((row): MoneyBanksSeriesBreak => ({
    breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note,
  }));
  if (breakRows.map(row => row.breakId).join() !== BREAK_IDS.join() || breakRows.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.referenceDate) || !row.reason || !row.sourceNote
    || row.appliesTo.some(id => !id.startsWith("banks.") || !facts.some(f => f.indicatorId === id)))) throw new Error("Money and banks series break register is invalid");
  const breaks = serializeBomCsvRows([BREAK_HEADERS, ...breakRows.map(row => [row.breakId, row.appliesTo.join(";"), row.referenceDate, row.reason, row.sourceNote])]);
  const years = facts.map(f => f.year);
  const acceptance: MoneyBanksAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/money-banks-annual.csv", csv], ["data/imports/money-banks-series-breaks.csv", breaks], ["data/reports/money-banks-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("money-banks", target, content);
  }
}
