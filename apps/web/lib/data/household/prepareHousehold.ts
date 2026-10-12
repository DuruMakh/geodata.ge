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
import { HOUSEHOLD_PUBLIC_SOURCES, HOUSEHOLD_SOURCES, householdFactKey, type HouseholdAcceptance, type HouseholdFact } from "./types";
import { validateHouseholdFacts } from "./validation";

const RESEARCH = "docs/Raw Data/Households/geostat-household-income-spending-annual";
export const REVIEWED_AT = "2026-10-11";
export const HOUSEHOLD_CSV_HEADERS = ["year", "indicator_id", "area_id", "measure", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

/**
 * Reads each valued cell's exact `<v>` token from a worksheet's XML, keyed by
 * address. A self-closing empty cell (`<c r="B5" s="3"/>`) has no body, so it
 * must not be allowed to pair with the next cell's value.
 */
export function readSheetCellTokens(sheetXml: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of sheetXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
    const token = match[2] === undefined ? undefined : /<v>([^<]+)<\/v>/.exec(match[2])?.[1];
    if (address && token) tokens.set(address, token);
  }
  return tokens;
}

/**
 * Promotes the research package's 10,638 primary observations into the
 * canonical serving CSV. Every value is re-read from its archived workbook cell.
 */
export async function prepareHouseholdData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== HOUSEHOLD_PUBLIC_SOURCES.length || HOUSEHOLD_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Household source inventory mismatch");
  const numeric = new Map<string, string>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Household source capture mismatch: ${source.local_file}`);
    if (!HOUSEHOLD_SOURCES.includes(source.source_id)) continue;
    const book = XLSX.read(bytes, { type: "buffer" });
    const xml = unzipSync(bytes);
    book.SheetNames.forEach((name, i) => {
      for (const [address, token] of readSheetCellTokens(strFromU8(xml[`xl/worksheets/sheet${i + 1}.xml`]))) {
        if (book.Sheets[name][address]?.t === "n") numeric.set(`${source.source_id}:${name}:${address}`, token);
      }
    });
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; reconciliation_failed_count: number; imputed_values: number };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string };
  if (report.status !== "passed" || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || independent.status !== "passed") throw new Error("Household research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "household-income-spending-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  const facts: HouseholdFact[] = rows.map(row => {
    // The package writes small values positionally (9.9463930749176005E-2 as 0.099463930749176005), so compare the numbers, not the text.
    const token = numeric.get(`${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    if (token === undefined || !new Decimal(token).eq(row.value)) throw new Error(`Household source cell mismatch: ${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    return {
      year: Number(row.year), indicatorId: row.indicator_id as HouseholdFact["indicatorId"], areaId: row.area_id as HouseholdFact["areaId"], measure: row.measure as HouseholdFact["measure"],
      value: row.value, publishedValue: row.published_value, unit: row.unit as "gel_month", basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateHouseholdFacts(facts);
  facts.sort((a, b) => householdFactKey(a).localeCompare(householdFactKey(b)));
  const csv = serializeBomCsvRows([HOUSEHOLD_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.areaId, f.measure, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.sourceNumberFormat, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance: HouseholdAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/household-income-spending-annual.csv", csv], ["data/reports/household-income-spending-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("household-income", target, content);
  }
}
