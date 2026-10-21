import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import { readWorkbookCells, type WorkbookCell } from "../energyFood/prepareEnergyFood";
import {
  HEALTH_INDICATORS, HEALTH_PUBLIC_SOURCES, HEALTH_RESEARCH_DIRECTORY, HEALTH_SOURCES, healthFactKey, type HealthAcceptance, type HealthFact, type HealthSeriesBreak,
} from "./types";
import { validateHealthFacts } from "./validation";

export const REVIEWED_AT = "2026-10-15";
export const HEALTH_CSV_HEADERS = ["year", "indicator_id", "area_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];
const BREAK_HEADERS = ["break_id", "applies_to", "reference_date", "reason", "source_note"];
const BREAK_IDS = ["staff_definitions_2012", "staff_register_2020", "icd10_groups_2006", "new_cases_electronic_2020"];
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

const collapse = (text: string) => text.replace(/​/g, "").split(/\s+/).filter(Boolean).join(" ");
/** A number printed as text with footnote asterisks, such as "34***". */
const MARKED = /^(\d+)(\*+)$/;
/** The exact stored decimal of a served cell: its numeric token, or the digits of the one asterisk-marked number whose footnote the sheet prints. */
function cellToken(cell: WorkbookCell | undefined, sheetCells: Map<string, WorkbookCell>, sheet: string): string | undefined {
  if (cell?.token !== undefined) return cell.token;
  const marked = MARKED.exec(collapse(cell?.text ?? ""));
  if (!marked) return undefined;
  const printed = [...sheetCells].some(([key, other]) => key.startsWith(`${sheet}:`) && collapse(other.text ?? "").startsWith(`${marked[2]} `));
  return printed ? marked[1] : undefined;
}

/**
 * Doctors and nurses equal the main characteristics table's thousands x 1,000 in every year 2002-2025, once that
 * product is rounded to whole persons (the stored thousands carry double-precision noise). The table's two staff
 * rows are read only for this check; none of their cells is served.
 */
function assertStaffTotalsMatchMain(facts: readonly HealthFact[], cells: Map<string, WorkbookCell>) {
  const sheet = facts.find(f => f.sourceId === "geostat_health_main")!.sourceSheet;
  const at = (address: string) => cells.get(`${sheet}:${address}`);
  const rowOf = (address: string) => Number(/\d+$/.exec(address)![0]);
  const addresses = [...cells.keys()].filter(key => key.startsWith(`${sheet}:`)).map(key => key.slice(sheet.length + 1));
  const yearOf = (address: string) => {
    const cell = at(address);
    const text = cell?.token ?? collapse(cell?.text ?? "");
    return !/^A\d+$/.test(address) && /^(19|20)\d\d$/.test(text) ? Number(text) : undefined;
  };
  // The heading row is the first row whose cells right of column A are mostly years.
  const headerRow = Math.min(...[...new Set(addresses.map(rowOf))].filter(row => addresses.filter(a => rowOf(a) === row && yearOf(a) !== undefined).length >= 3));
  if (!Number.isFinite(headerRow)) throw new Error("Health main characteristics year heading not found");
  const yearColumns = new Map(addresses.filter(a => rowOf(a) === headerRow && yearOf(a) !== undefined).map(a => [a.replace(/\d+$/, ""), yearOf(a)!]));
  for (const [label, indicatorId] of [["Number of physicians of all specialties total, thsd.*", "health.staff.doctors"], ["Number of nurses total, thsd.*", "health.staff.nurses"]] as const) {
    const rows = addresses.filter(a => /^A\d+$/.test(a) && collapse(at(a)?.text ?? "") === label);
    if (rows.length !== 1) throw new Error(`Health main characteristics row not found exactly once: ${label}`);
    for (const [column, year] of yearColumns) {
      if (year < 2002 || year > 2025) continue;
      const token = at(`${column}${rowOf(rows[0])}`)?.token;
      const fact = facts.find(f => f.indicatorId === indicatorId && f.areaId === "georgia" && f.year === year);
      if (token === undefined || !fact || !new Decimal(token).times(1000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).eq(fact.value)) {
        throw new Error(`Health staff total differs from the main characteristics table (thousands x 1,000): ${indicatorId} ${year}`);
      }
    }
  }
}

/**
 * Promotes the research package's 4,204 primary observations into the canonical serving CSV.
 * Every value is re-read from its archived workbook cell.
 */
export async function prepareHealthData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, HEALTH_RESEARCH_DIRECTORY);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== HEALTH_PUBLIC_SOURCES.length || HEALTH_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Health source inventory mismatch");
  const workbooks = new Map<string, Map<string, WorkbookCell>>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Health source capture mismatch: ${source.local_file}`);
    // The other workbooks and the page captures are archived only; none of their cells is served.
    if (HEALTH_SOURCES.includes(source.source_id)) workbooks.set(source.source_id, readWorkbookCells(bytes));
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as {
    status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number; calculated_values: number; placeholder_cells_in_served_values: number;
  };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string };
  if (
    report.status !== "passed" || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || report.calculated_values !== 0 ||
    report.placeholder_cells_in_served_values !== 0 || independent.status !== "passed"
  ) throw new Error("Health research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "health-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  if (rows.length !== report.primary_observation_count) throw new Error("Health observation count differs from the research report");
  const facts: HealthFact[] = rows.map(row => {
    const sheetCells = workbooks.get(row.source_id);
    if (!sheetCells || cellToken(sheetCells.get(`${row.source_sheet}:${row.source_cell}`), sheetCells, row.source_sheet) !== row.value) {
      throw new Error(`Health source cell mismatch: ${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    }
    return {
      year: Number(row.year), indicatorId: row.indicator_id as HealthFact["indicatorId"], areaId: row.area_id as HealthFact["areaId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as HealthFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "published",
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateHealthFacts(facts);
  assertStaffTotalsMatchMain(facts, workbooks.get("geostat_health_main")!);
  facts.sort((a, b) => (a.indicatorId < b.indicatorId ? -1 : a.indicatorId > b.indicatorId ? 1 : a.areaId < b.areaId ? -1 : a.areaId > b.areaId ? 1 : a.year - b.year));
  const csv = serializeBomCsvRows([HEALTH_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.areaId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.sourceNumberFormat, f.lastReviewedAt])]);
  // The breaks file is copied as it is; it must parse as break rows whose indicator IDs are all served.
  const breaks = await fs.readFile(path.join(directory, "health-series-breaks.csv"), "utf8");
  const breakRows = (parse(breaks, { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[]).map((row): HealthSeriesBreak => ({
    breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note,
  }));
  const served = new Set<string>(facts.map(f => f.indicatorId));
  if (
    breaks.split("\n")[0].replace(/^﻿/, "") !== BREAK_HEADERS.join(",") || breakRows.map(row => row.breakId).join() !== BREAK_IDS.join() ||
    breakRows.some(row => !/^\d{4}-\d{2}-\d{2}$/.test(row.referenceDate) || !row.reason || !row.sourceNote || row.appliesTo.some(id => !(HEALTH_INDICATORS as readonly string[]).includes(id) || !served.has(id)))
  ) throw new Error("Health series break register is invalid");
  const years = facts.map(f => f.year);
  const acceptance: HealthAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  if (new Set(facts.map(healthFactKey)).size !== facts.length) throw new Error("Duplicate health observation");
  for (const [relative, content] of [["data/imports/health-annual.csv", csv], ["data/imports/health-series-breaks.csv", breaks], ["data/reports/health-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("health", target, content);
  }
}
