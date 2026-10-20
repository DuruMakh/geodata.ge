import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import { HOUSING_CSV_HEADERS } from "../housing/prepareHousing";
import { INTERNET_INDICATORS, INTERNET_PUBLIC_SOURCES, INTERNET_SOURCES, type InternetAcceptance, type InternetFact } from "./types";
import { validateInternetFacts } from "./validation";

const RESEARCH = "docs/Raw Data/Internet/geostat-ict-households-annual";
export const REVIEWED_AT = "2026-10-20";
export const INTERNET_CSV_HEADERS = HOUSING_CSV_HEADERS;
const OBSERVATIONS = 1055;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

/** The stored number of a cell as text: the shortest round-trip form, which is also the research package's `value`. */
function cellText(sheet: XLSX.WorkSheet | undefined, address: string): string | undefined {
  const cell = sheet?.[address];
  return cell?.t === "n" && typeof cell.v === "number" ? String(cell.v) : undefined;
}

/**
 * Promotes the research package's 1,055 observations into the canonical serving CSV. Every value is
 * re-read from its archived workbook cell; nothing is calculated.
 */
export async function prepareInternetData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== INTERNET_PUBLIC_SOURCES.length || INTERNET_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Internet source inventory mismatch");
  const workbooks = new Map<string, XLSX.WorkBook>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Internet source capture mismatch: ${source.local_file}`);
    if (INTERNET_SOURCES.includes(source.source_id)) workbooks.set(source.source_id, XLSX.read(bytes, { type: "buffer" }));
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number; calculated_values: number };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string; observations: number };
  if (report.status !== "passed" || report.primary_observation_count !== OBSERVATIONS || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || report.calculated_values !== 0
    || independent.status !== "passed" || independent.observations !== OBSERVATIONS) throw new Error("Internet research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "internet-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  const facts: InternetFact[] = rows.map(row => {
    const workbook = workbooks.get(row.source_id);
    if (!workbook || cellText(workbook.Sheets[row.source_sheet], row.source_cell) !== row.value) throw new Error(`Internet source cell mismatch: ${row.indicator_id}:${row.year}`);
    return {
      year: Number(row.year), indicatorId: row.indicator_id as InternetFact["indicatorId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as "percent", basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateInternetFacts(facts);
  facts.sort((a, b) => INTERNET_INDICATORS.indexOf(a.indicatorId) - INTERNET_INDICATORS.indexOf(b.indicatorId) || a.year - b.year);
  const csv = serializeBomCsvRows([INTERNET_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance: InternetAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/internet-annual.csv", csv], ["data/reports/internet-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("internet", target, content);
  }
}
