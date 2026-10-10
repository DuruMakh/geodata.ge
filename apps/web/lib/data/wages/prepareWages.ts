import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import { WAGES_PUBLIC_SOURCES, WAGES_SOURCES, wagesFactKey, type WagesAcceptance, type WagesFact } from "./types";
import { expectedWagesKeys, validateWagesFacts } from "./validation";

const RESEARCH = "docs/Raw Data/Wages/geostat-earnings-annual";
const REVIEWED_AT = "2026-10-10";
export const WAGES_CSV_HEADERS = ["year", "indicator_id", "dimension", "group_id", "sector_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

/**
 * Promotes the research package's primary observations, plus the unavailable
 * markers inside the served coverage, into the canonical serving CSV. Every
 * numeric value is re-read from its archived workbook cell; every unavailable
 * marker is confirmed in its cell.
 */
export async function prepareWagesData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const readCsv = async (name: string): Promise<CsvRecord[]> => parse(await fs.readFile(path.join(directory, name)), { columns: true, bom: true, skip_empty_lines: true });
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== WAGES_PUBLIC_SOURCES.length || WAGES_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Wages source inventory mismatch");
  const numeric = new Map<string, string>();
  const text = new Map<string, string>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Wages source capture mismatch: ${source.local_file}`);
    if (!WAGES_SOURCES.includes(source.source_id)) continue;
    const book = XLSX.read(bytes, { type: "buffer" });
    const xml = unzipSync(bytes);
    book.SheetNames.forEach((name, i) => {
      const sheet = book.Sheets[name];
      for (const match of strFromU8(xml[`xl/worksheets/sheet${i + 1}.xml`]).matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
        const token = /<v>([^<]+)<\/v>/.exec(match[2])?.[1];
        if (address && token && sheet[address]?.t === "n") numeric.set(`${source.source_id}:${name}:${address}`, token);
        else if (address && sheet[address]?.t === "s") text.set(`${source.source_id}:${name}:${address}`, String(sheet[address].v).trim());
      }
    });
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; reconciliation_failed_count: number; imputed_values: number };
  if (report.status !== "passed" || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0) throw new Error("Wages research package validation has not passed");
  const common = { unit: "gel" as const, basis: "actual" as const, lastReviewedAt: REVIEWED_AT };
  const facts: WagesFact[] = [];
  for (const row of await readCsv("earnings-annual.csv")) {
    if (row.role !== "primary" || row.frequency !== "annual" || row.unit !== "gel" || row.basis !== "actual" || !["none", "nace_rev2"].includes(row.classification) || (row.classification === "none" && row.sector_id !== "total")) throw new Error(`Wages primary row contract mismatch: ${row.source_id}:${row.source_cell}`);
    if (numeric.get(`${row.source_id}:${row.source_sheet}:${row.source_cell}`) !== row.value) throw new Error(`Wages source cell mismatch: ${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    facts.push({ ...common, year: Number(row.year), indicatorId: row.indicator_id as WagesFact["indicatorId"], dimension: row.dimension as WagesFact["dimension"], groupId: row.group_id, sectorId: row.sector_id as WagesFact["sectorId"], value: row.value, publishedValue: row.published_value, valueStatus: row.value_status as WagesFact["valueStatus"], sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format });
  }
  const expected = expectedWagesKeys();
  for (const row of await readCsv("unavailable-cells.csv")) {
    const fact: WagesFact = { ...common, year: Number(row.year), indicatorId: row.indicator_id as WagesFact["indicatorId"], dimension: row.dimension as WagesFact["dimension"], groupId: row.group_id, sectorId: row.sector_id as WagesFact["sectorId"], value: null, publishedValue: null, valueStatus: "unavailable", sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: null };
    if (!expected.has(wagesFactKey(fact))) continue;
    if (!["…", "..."].includes(text.get(`${row.source_id}:${row.source_sheet}:${row.source_cell}`) ?? "")) throw new Error(`Wages unavailable marker missing from its cell: ${row.source_id}:${row.source_cell}`);
    facts.push(fact);
  }
  validateWagesFacts(facts);
  facts.sort((a, b) => wagesFactKey(a).localeCompare(wagesFactKey(b)) || a.year - b.year);
  const csv = serializeBomCsvRows([WAGES_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.dimension, f.groupId, f.sectorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.sourceNumberFormat, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance: WagesAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) },
    numericObservations: facts.filter(f => f.value !== null).length, unavailableObservations: facts.filter(f => f.value === null).length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/wages-annual.csv", csv], ["data/reports/wages-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("wages", target, content);
  }
}
