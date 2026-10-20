import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import { LABOUR_INDICATORS, LABOUR_PUBLIC_SOURCES, LABOUR_RESEARCH_DIRECTORY, LABOUR_SOURCES, labourFactKey, type LabourFact } from "./types";
import { validateLabourFacts } from "./validation";

export const REVIEWED_AT = "2026-10-20";
export const LABOUR_CSV_HEADERS = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

/**
 * The stored text of every numeric cell of one workbook, by `sheet name:address`, read from the sheet XML so that an exponent
 * or a trailing digit is compared as Geostat stored it. A self-closing cell has no value; a text, boolean or error cell is no number.
 */
function numericCellText(bytes: Buffer): Map<string, string> {
  const parts = unzipSync(bytes);
  const text = (name: string) => {
    if (!parts[name]) throw new Error(`Labour workbook part missing: ${name}`);
    return strFromU8(parts[name]);
  };
  const targets = new Map<string, string>();
  for (const [element] of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)) {
    const [id, target] = [/\bId="([^"]+)"/.exec(element)?.[1], /\bTarget="([^"]+)"/.exec(element)?.[1]];
    if (id && target) targets.set(id, target);
  }
  const cells = new Map<string, string>();
  for (const [element] of text("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)) {
    const [name, id] = [/\bname="([^"]+)"/.exec(element)?.[1], /\br:id="([^"]+)"/.exec(element)?.[1]];
    const target = id && targets.get(id);
    if (!name || !target) throw new Error("Labour workbook sheet not found");
    const sheetXml = text(`xl/${target.replace(/^\/?(xl\/)?/, "")}`);
    for (const match of sheetXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
      const type = /\bt="([^"]*)"/.exec(match[1])?.[1];
      const value = match[2] === undefined ? undefined : /<v>([^<]+)<\/v>/.exec(match[2])?.[1];
      if (address && value !== undefined && (type === undefined || type === "n")) cells.set(`${name}:${address}`, value);
    }
  }
  return cells;
}

/** The workbook is the served employment counts' own survey, so its totals must equal what the Unemployment pages already show. */
function assertReconciles(facts: readonly LabourFact[], unemployment: readonly CsvRecord[]) {
  const served = (dimension: string, group: string, indicator: string, year: number) => {
    const rows = unemployment.filter(row => row.dimension === dimension && row.group_id === group && row.indicator_id === indicator && Number(row.year) === year);
    if (rows.length !== 1) throw new Error(`Labour reconciliation row missing: ${indicator} ${group} ${year}`);
    return rows[0];
  };
  const fact = (indicator: string, year: number) => facts.find(f => f.indicatorId === indicator && f.year === year)!;
  for (let year = 2020; year <= 2025; year++) {
    for (const [group, dimension, groupId] of [["all", "national", "georgia"], ["women", "sex", "women"], ["men", "sex", "men"]]) {
      if (new Decimal(fact(`labour.jobs.${group}.total`, year).value).minus(served(dimension, groupId, "employed", year).value).abs().gte("0.000001")) {
        throw new Error(`Labour jobs do not reconcile with the served employed count: ${group} ${year}`);
      }
    }
    if (fact("labour.underuse.unemployment_rate", year).publishedValue !== served("national", "georgia", "unemployment_rate", year).published_value) {
      throw new Error(`Labour unemployment rate does not reconcile with the served rate: ${year}`);
    }
  }
}

/**
 * Promotes the research package's 1,014 primary observations into the canonical serving CSV.
 * Every value is re-read as text from its archived workbook cell.
 */
export async function prepareLabourData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, LABOUR_RESEARCH_DIRECTORY);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== LABOUR_PUBLIC_SOURCES.length || LABOUR_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Labour source inventory mismatch");
  const cells = new Map<string, Map<string, string>>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Labour source capture mismatch: ${source.local_file}`);
    // The Georgian versions and the page captures are archived only; none of their cells is served.
    if (LABOUR_SOURCES.includes(source.source_id)) cells.set(source.source_id, numericCellText(bytes));
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as {
    status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number; calculated_values: number; placeholder_cells_in_served_values: number;
  };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string };
  if (
    report.status !== "passed" || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || report.calculated_values !== 0 ||
    report.placeholder_cells_in_served_values !== 0 || independent.status !== "passed"
  ) throw new Error("Labour research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "labour-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  if (rows.length !== report.primary_observation_count) throw new Error("Labour observation count differs from the research report");
  const facts: LabourFact[] = rows.map(row => {
    const stored = cells.get(row.source_id)?.get(`${row.source_sheet}:${row.source_cell}`);
    if (stored === undefined || stored !== row.value) throw new Error(`Labour source cell mismatch: ${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    // One decimal, half up, of the 15 significant digits Excel keeps.
    if (new Decimal(row.value).toSignificantDigits(15).toFixed(1) !== row.published_value) throw new Error(`Labour published value does not match its stored value: ${row.source_cell}`);
    return {
      year: Number(row.year), indicatorId: row.indicator_id as LabourFact["indicatorId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as LabourFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "survey_estimate",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateLabourFacts(facts, repositoryRoot);
  const unemployment = parse(await fs.readFile(path.join(repositoryRoot, "data/imports/unemployment-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  assertReconciles(facts, unemployment);
  if (new Set(facts.map(labourFactKey)).size !== facts.length) throw new Error("Duplicate labour observation");
  const order = new Map<string, number>(LABOUR_INDICATORS.map((id, index) => [id, index]));
  facts.sort((a, b) => order.get(a.indicatorId)! - order.get(b.indicatorId)! || a.year - b.year);
  const csv = serializeBomCsvRows([LABOUR_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/labour-annual.csv", csv], ["data/reports/labour-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("labour", target, content);
  }
}
