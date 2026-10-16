import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readWorkbookCells, type WorkbookCell } from "../energyFood/prepareEnergyFood";
import type { CsvRecord } from "../csv";
import { BUSINESS_INDICATORS, BUSINESS_PUBLIC_SOURCES, BUSINESS_SOURCES, type BusinessAcceptance, type BusinessFact, type BusinessSeriesBreak } from "./types";
import { validateBusinessFacts } from "./validation";

const RESEARCH = "docs/Raw Data/Business/geostat-business-annual";
export const REVIEWED_AT = "2026-10-15";
export const BUSINESS_CSV_HEADERS = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
const BREAK_HEADERS = ["break_id", "applies_to", "reference_date", "reason", "source_note"];
const OBSERVATIONS = 4643;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

/**
 * Promotes the research package's 4,643 observations into the canonical serving CSV. Every value is
 * re-read from its archived workbook cell; nothing is calculated.
 */
export async function prepareBusinessData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== BUSINESS_PUBLIC_SOURCES.length || BUSINESS_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Business source inventory mismatch");
  const workbooks = new Map<string, Map<string, WorkbookCell>>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Business source capture mismatch: ${source.local_file}`);
    if (BUSINESS_SOURCES.includes(source.source_id)) workbooks.set(source.source_id, readWorkbookCells(bytes));
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number; calculated_values: number };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string; observations: number };
  if (report.status !== "passed" || report.primary_observation_count !== OBSERVATIONS || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || report.calculated_values !== 0
    || independent.status !== "passed" || independent.observations !== OBSERVATIONS) throw new Error("Business research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "business-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  const facts: BusinessFact[] = rows.map(row => {
    if (workbooks.get(row.source_id)?.get(`${row.source_sheet}:${row.source_cell}`)?.token !== row.value) throw new Error(`Business source cell mismatch: ${row.indicator_id}:${row.year}`);
    return {
      year: Number(row.year), indicatorId: row.indicator_id as BusinessFact["indicatorId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as BusinessFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateBusinessFacts(facts);
  facts.sort((a, b) => BUSINESS_INDICATORS.indexOf(a.indicatorId) - BUSINESS_INDICATORS.indexOf(b.indicatorId) || a.year - b.year);
  const csv = serializeBomCsvRows([BUSINESS_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const breakRows = (parse(await fs.readFile(path.join(directory, "business-series-breaks.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[]).map((row): BusinessSeriesBreak => ({
    breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note,
  }));
  // Sales and jobs are the only measures that run before 2006, so the survey-scope break covers exactly their series.
  const salesAndJobs = BUSINESS_INDICATORS.filter(id => /^business\.(turnover|employed)\./.test(id));
  if (breakRows.length !== 1 || breakRows[0].breakId !== "survey_scope_2006" || breakRows[0].referenceDate !== "2006-01-01" || !breakRows[0].reason || !breakRows[0].sourceNote
    || breakRows[0].appliesTo.length !== salesAndJobs.length || salesAndJobs.some(id => !breakRows[0].appliesTo.includes(id))) throw new Error("Business series break register is invalid");
  const breaks = serializeBomCsvRows([BREAK_HEADERS, ...breakRows.map(row => [row.breakId, row.appliesTo.join(";"), row.referenceDate, row.reason, row.sourceNote])]);
  const years = facts.map(f => f.year);
  const acceptance: BusinessAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/business-annual.csv", csv], ["data/imports/business-series-breaks.csv", breaks], ["data/reports/business-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("business", target, content);
  }
}
