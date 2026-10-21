import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { readWorkbookCells, type WorkbookCell } from "../energyFood/prepareEnergyFood";
import type { CsvRecord } from "../csv";
import {
  EDUCATION_GEORGIA, EDUCATION_INDICATORS, EDUCATION_MUNICIPALITIES, EDUCATION_PUBLIC_SOURCES, EDUCATION_REGIONS, EDUCATION_SOURCES, EDUCATION_UNITS,
  type EducationAcceptance, type EducationFact, type EducationSeriesBreak,
} from "./types";
import { EDUCATION_KNOWN_DIFFERENCES, validateEducationFacts, type EducationMunicipalGeorgia } from "./validation";

const RESEARCH = "docs/Raw Data/Education/geostat-education-annual";
export const REVIEWED_AT = "2026-10-16";
export const EDUCATION_CSV_HEADERS = ["year", "period_label", "indicator_id", "geography_id", "value", "published_value", "unit", "basis", "value_status", "shown", "source_id", "source_sheet", "source_cell", "last_reviewed_at"];
const BREAK_HEADERS = ["break_id", "applies_to", "reference_date", "reason", "source_note"];
const OBSERVATIONS = 8815;
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };

const readCsv = async (file: string) => parse(await fs.readFile(file), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];

/** The exact stored number: a numeric cell's own XML token, or a text cell such as `2 294` with its spaces removed. */
function cellToken(cell: WorkbookCell | undefined): string | undefined {
  if (cell?.token !== undefined) return cell.token;
  const compact = cell?.text?.replace(/\s/g, "");
  return compact !== undefined && /^-?\d+(\.\d+)?$/.test(compact) ? compact : undefined;
}

/** units.csv must map exactly the places the validator knows, and each municipality to the region municipalities.csv gives it. */
async function readUnitLabels(repositoryRoot: string): Promise<{ georgiaLabel: string }> {
  const units = await readCsv(path.join(repositoryRoot, "data/mappings/education/units.csv"));
  const ids = units.map(row => row.geography_id);
  const known = [EDUCATION_GEORGIA, ...EDUCATION_REGIONS, ...Object.values(EDUCATION_MUNICIPALITIES).flat(), ...Object.keys(EDUCATION_UNITS)];
  if (new Set(units.map(row => row.source_label.trim())).size !== units.length || new Set(ids).size !== ids.length || ids.length !== known.length || known.some(id => !ids.includes(id))) {
    throw new Error("Education units mapping does not match the approved places");
  }
  const regionOf = new Map((await readCsv(path.join(repositoryRoot, "data/imports/municipalities.csv"))).map(row => [row.municipality_code, row.region_id]));
  for (const [region, codes] of Object.entries(EDUCATION_MUNICIPALITIES)) {
    if (codes.some(code => regionOf.get(code) !== region)) throw new Error(`Education municipalities of ${region} disagree with municipalities.csv`);
  }
  return { georgiaLabel: units.find(row => row.geography_id === EDUCATION_GEORGIA)!.source_label.trim() };
}

/** The reviewed known-differences file must list exactly the mismatches the validator accepts. */
async function checkKnownDifferences(repositoryRoot: string): Promise<void> {
  const rows = await readCsv(path.join(repositoryRoot, "data/mappings/education/known-differences.csv"));
  const listed = rows.map(row => `${row.check}|${row.year}|${row.difference}`).sort();
  const accepted = EDUCATION_KNOWN_DIFFERENCES.map(k => `${k.check}|${k.year}|${k.difference}`).sort();
  if (listed.length !== accepted.length || listed.some((entry, i) => entry !== accepted[i]) || rows.some(row => !row.mapping_note)) throw new Error("Education known differences do not match the reviewed file");
}

/** Table 11's own GEORGIA row, read from the column of Tbilisi's fact for the same year. */
function readMunicipalGeorgia(cells: ReadonlyMap<string, WorkbookCell>, facts: readonly EducationFact[], georgiaLabel: string): EducationMunicipalGeorgia {
  const row = (measure: "schools" | "pupils" | "teachers") => {
    const rows = [...cells].flatMap(([key, cell]) => (key.startsWith(`${measure}:A`) && cell.text?.trim() === georgiaLabel ? [Number(key.slice(`${measure}:A`.length))] : []));
    if (rows.length !== 1) throw new Error(`Education table 11 sheet ${measure} does not print the Georgia row exactly once`);
    const georgia = new Map<number, string>();
    for (const fact of facts.filter(f => f.indicatorId === `education.${measure}.total` && f.geographyId === "region.tbilisi" && f.sourceId === "geostat_education_municipal")) {
      if (fact.sourceSheet !== measure) throw new Error(`Education Tbilisi ${measure} fact is not from sheet ${measure}`);
      const token = cellToken(cells.get(`${measure}:${/^[A-Z]+/.exec(fact.sourceCell)![0]}${rows[0]}`));
      if (token === undefined) throw new Error(`Education table 11 Georgia ${measure} ${fact.year} is not a number`);
      georgia.set(fact.year, token);
    }
    return georgia;
  };
  return { schools: row("schools"), pupils: row("pupils"), teachers: row("teachers") };
}

/**
 * Promotes the research package's 8,815 observations into the canonical serving CSV. Every value is
 * re-read from its archived workbook cell; nothing is calculated.
 */
export async function prepareEducationData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== EDUCATION_PUBLIC_SOURCES.length || EDUCATION_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Education source inventory mismatch");
  const workbooks = new Map<string, Map<string, WorkbookCell>>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Education source capture mismatch: ${source.local_file}`);
    if (EDUCATION_SOURCES.includes(source.source_id)) workbooks.set(source.source_id, readWorkbookCells(bytes));
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; primary_observation_count: number; reconciliation_failed_count: number; imputed_values: number; calculated_values: number };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string; observations: number };
  if (report.status !== "passed" || report.primary_observation_count !== OBSERVATIONS || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || report.calculated_values !== 0
    || independent.status !== "passed" || independent.observations !== OBSERVATIONS) throw new Error("Education research package validation has not passed");
  const { georgiaLabel } = await readUnitLabels(repositoryRoot);
  await checkKnownDifferences(repositoryRoot);
  const facts: EducationFact[] = (await readCsv(path.join(directory, "education-annual.csv"))).map(row => {
    if (cellToken(workbooks.get(row.source_id)?.get(`${row.source_sheet}:${row.source_cell}`)) !== row.value) throw new Error(`Education source cell mismatch: ${row.indicator_id}:${row.geography_id}:${row.year}`);
    if (row.shown !== "true" && row.shown !== "false") throw new Error(`Education shown flag is not true or false: ${row.indicator_id}:${row.geography_id}:${row.year}`);
    return {
      year: Number(row.year), periodLabel: row.period_label, indicatorId: row.indicator_id as EducationFact["indicatorId"], geographyId: row.geography_id,
      value: row.value, publishedValue: row.published_value, unit: row.unit as EducationFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as "official",
      shown: row.shown === "true", sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateEducationFacts(facts, readMunicipalGeorgia(workbooks.get("geostat_education_municipal")!, facts, georgiaLabel));
  const order = new Map(EDUCATION_INDICATORS.map((id, i) => [id, i]));
  facts.sort((a, b) => order.get(a.indicatorId)! - order.get(b.indicatorId)! || (a.geographyId < b.geographyId ? -1 : a.geographyId > b.geographyId ? 1 : 0) || a.year - b.year);
  const csv = serializeBomCsvRows([EDUCATION_CSV_HEADERS, ...facts.map(f => [f.year, f.periodLabel, f.indicatorId, f.geographyId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, String(f.shown), f.sourceId, f.sourceSheet, f.sourceCell, f.lastReviewedAt])]);
  const breakRows = (await readCsv(path.join(directory, "education-series-breaks.csv"))).map((row): EducationSeriesBreak => ({
    breakId: row.break_id, appliesTo: row.applies_to.split(";"), referenceDate: row.reference_date, reason: row.reason, sourceNote: row.source_note,
  }));
  // Staff counts widen in 2020/21; the three higher-education measures re-define master's level in 2015/16 (graduates are stored a year back, so their break is dated 2014-09-01).
  const expectedBreaks: Record<string, { date: string; appliesTo: string[] }> = {
    kindergarten_staff_2020: { date: "2020-09-01", appliesTo: ["education.kg_staff.total"] },
    he_levels_2015: { date: "2015-09-01", appliesTo: ["he_students", "he_admitted"].flatMap(measure => ["level_bachelor", "level_master"].map(group => `education.${measure}.${group}`)) },
    he_levels_2015_graduates: { date: "2014-09-01", appliesTo: ["education.he_graduates.level_bachelor", "education.he_graduates.level_master"] },
  };
  if (breakRows.length !== 3 || breakRows.some(row => {
    const want = expectedBreaks[row.breakId];
    return !want || row.referenceDate !== want.date || !row.reason || !row.sourceNote || row.appliesTo.length !== want.appliesTo.length || want.appliesTo.some(id => !row.appliesTo.includes(id));
  })) throw new Error("Education series break register is invalid");
  const breaks = serializeBomCsvRows([BREAK_HEADERS, ...breakRows.map(row => [row.breakId, row.appliesTo.join(";"), row.referenceDate, row.reason, row.sourceNote])]);
  const years = facts.map(f => f.year);
  const acceptance: EducationAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/education-annual.csv", csv], ["data/imports/education-series-breaks.csv", breaks], ["data/reports/education-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("education", target, content);
  }
}
