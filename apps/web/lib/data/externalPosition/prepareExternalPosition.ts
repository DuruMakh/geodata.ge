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
import { EXTERNAL_POSITION_INDICATORS, EXTERNAL_POSITION_PUBLIC_SOURCES, EXTERNAL_POSITION_SOURCES, type ExternalPositionAcceptance, type ExternalPositionFact } from "./types";
import { validateExternalPositionFacts } from "./validation";

const RESEARCH = "docs/Raw Data/External/nbg-external-position";
export const REVIEWED_AT = "2026-10-15";
export const EXTERNAL_POSITION_CSV_HEADERS = ["year", "indicator_id", "value", "published_value", "unit", "period_end", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

/**
 * Promotes the research package's 254 observations into the canonical serving CSV. Every value is
 * re-read from its archived workbook cell: a debt value is the stored number token, a reserves value
 * is the stored token (thousand USD) divided by 1000, exactly.
 */
export async function prepareExternalPositionData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== EXTERNAL_POSITION_PUBLIC_SOURCES.length || EXTERNAL_POSITION_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("External position source inventory mismatch");
  const numeric = new Map<string, string>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `External position source capture mismatch: ${source.local_file}`);
    if (!EXTERNAL_POSITION_SOURCES.includes(source.source_id)) continue;
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
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number; calculated_values: number };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string };
  if (report.status !== "passed" || report.primary_observation_count !== 254 || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || report.calculated_values !== 0 || independent.status !== "passed") throw new Error("External position research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "external-position-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  const facts: ExternalPositionFact[] = rows.map(row => {
    const key = `${row.indicator_id}:${row.year}`;
    const token = numeric.get(`${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    const matches = token !== undefined && (row.indicator_id.startsWith("reserves.") ? new Decimal(token).div(1000).eq(row.value) : token === row.value);
    if (!matches) throw new Error(`External position source cell mismatch: ${key}`);
    return {
      year: Number(row.year), indicatorId: row.indicator_id as ExternalPositionFact["indicatorId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as "usd_million", periodEnd: row.period_end, basis: row.basis as "actual", valueStatus: row.value_status as "official",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateExternalPositionFacts(facts);
  facts.sort((a, b) => EXTERNAL_POSITION_INDICATORS.indexOf(a.indicatorId) - EXTERNAL_POSITION_INDICATORS.indexOf(b.indicatorId) || a.year - b.year);
  const csv = serializeBomCsvRows([EXTERNAL_POSITION_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.periodEnd, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance: ExternalPositionAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/external-position-annual.csv", csv], ["data/reports/external-position-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("external-position", target, content);
  }
}
