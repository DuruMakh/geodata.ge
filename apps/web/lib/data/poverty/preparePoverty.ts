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
import { POVERTY_PUBLIC_SOURCES, POVERTY_SOURCES, povertyFactKey, type PovertyAcceptance, type PovertyFact } from "./types";
import { validatePovertyFacts } from "./validation";

const RESEARCH = "docs/Raw Data/Poverty/geostat-poverty-annual";
const REVIEWED_AT = "2026-10-10";
export const POVERTY_CSV_HEADERS = ["year", "indicator_id", "group_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

/**
 * Promotes the research package's 491 primary observations into the canonical
 * serving CSV. Every value is re-read from its archived workbook cell.
 */
export async function preparePovertyData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== POVERTY_PUBLIC_SOURCES.length || POVERTY_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Poverty source inventory mismatch");
  const numeric = new Map<string, string>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Poverty source capture mismatch: ${source.local_file}`);
    if (!POVERTY_SOURCES.includes(source.source_id)) continue;
    const book = XLSX.read(bytes, { type: "buffer" });
    const xml = unzipSync(bytes);
    book.SheetNames.forEach((name, i) => {
      for (const match of strFromU8(xml[`xl/worksheets/sheet${i + 1}.xml`]).matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
        const token = /<v>([^<]+)<\/v>/.exec(match[2])?.[1];
        if (address && token && book.Sheets[name][address]?.t === "n") numeric.set(`${source.source_id}:${name}:${address}`, token);
      }
    });
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; reconciliation_failed_count: number; imputed_values: number };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string };
  if (report.status !== "passed" || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || independent.status !== "passed") throw new Error("Poverty research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "poverty-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  const facts: PovertyFact[] = rows.map(row => {
    if (numeric.get(`${row.source_id}:${row.source_sheet}:${row.source_cell}`) !== row.value) throw new Error(`Poverty source cell mismatch: ${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    return {
      year: Number(row.year), indicatorId: row.indicator_id as PovertyFact["indicatorId"], groupId: row.group_id as PovertyFact["groupId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as PovertyFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: REVIEWED_AT,
    };
  });
  validatePovertyFacts(facts);
  facts.sort((a, b) => povertyFactKey(a).localeCompare(povertyFactKey(b)));
  const csv = serializeBomCsvRows([POVERTY_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.groupId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.sourceNumberFormat, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance: PovertyAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/poverty-annual.csv", csv], ["data/reports/poverty-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("poverty", target, content);
  }
}
