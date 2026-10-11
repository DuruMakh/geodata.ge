import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import type { CsvRecord } from "../csv";
import { ENERGY_FOOD_PUBLIC_SOURCES, ENERGY_FOOD_SOURCES, energyFoodFactKey, type EnergyFoodAcceptance, type EnergyFoodFact } from "./types";
import { validateEnergyFoodFacts } from "./validation";

const RESEARCH = "docs/Raw Data/EnergyFood/geostat-energy-food-annual";
export const REVIEWED_AT = "2026-10-11";
export const ENERGY_FOOD_CSV_HEADERS = ["year", "indicator_id", "value", "published_value", "unit", "basis", "value_status", "source_id", "source_sheet", "source_cell", "source_number_format", "last_reviewed_at"];
type Source = { source_id: string; local_file: string; sha256: string; bytes: number };
export type WorkbookCell = { token?: string; text?: string };

const decodeXml = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
  if (entity[0] !== "#") return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity.toLowerCase()]!;
  return String.fromCodePoint(entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
});
const attribute = (attributes: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)?.[1];
const textOf = (xml: string) => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(match => decodeXml(match[1])).join("");

/**
 * Reads every non-empty cell of every sheet of an .xlsx, keyed `${sheetName}:${address}`.
 * A numeric cell carries its exact stored token; a text cell carries its text, with
 * shared strings resolved. Sheets are found through the workbook's own relationship
 * file, because the order of the sheets need not match the order of the parts.
 */
export function readWorkbookCells(bytes: Uint8Array): Map<string, WorkbookCell> {
  const files = unzipSync(bytes);
  const read = (name: string) => {
    if (!files[name]) throw new Error(`Workbook part is missing: ${name}`);
    return strFromU8(files[name]);
  };
  const targets = new Map<string, string>();
  for (const match of read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = attribute(match[1], "Id"), target = attribute(match[1], "Target");
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const strings = files["xl/sharedStrings.xml"] ? [...read("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => textOf(match[1])) : [];
  const cells = new Map<string, WorkbookCell>();
  for (const sheet of read("xl/workbook.xml").matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const name = attribute(sheet[1], "name"), id = attribute(sheet[1], "r:id");
    const target = id && targets.get(id);
    if (!name || !target) throw new Error(`Workbook sheet has no part: ${name}`);
    for (const match of read(target).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const address = attribute(match[1], "r");
      if (!address || match[2] === undefined) continue; // a self-closing cell is empty
      const type = attribute(match[1], "t"), raw = /<v>([^<]*)<\/v>/.exec(match[2])?.[1];
      let cell: WorkbookCell | undefined;
      if (type === "s" && raw !== undefined) cell = { text: strings[Number(raw)] };
      else if (type === "inlineStr") cell = { text: textOf(match[2]) };
      else if (type === "str" && raw !== undefined) cell = { text: decodeXml(raw) };
      else if ((type === undefined || type === "n") && raw) cell = { token: raw };
      if (cell) cells.set(`${decodeXml(name)}:${address}`, cell);
    }
  }
  return cells;
}

/** A dash, with or without the non-breaking space the 2013-2015 workbooks add. */
const isDash = (cell: WorkbookCell | undefined) => cell?.text?.replace(/[\s ]/g, "") === "-";

/**
 * Promotes the research package's 681 primary observations into the canonical
 * serving CSV. Every value is re-read from its archived workbook cell.
 */
export async function prepareEnergyFoodData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, RESEARCH);
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  if (manifest.length !== ENERGY_FOOD_PUBLIC_SOURCES.length || ENERGY_FOOD_PUBLIC_SOURCES.some(id => manifest.filter(source => source.source_id === id).length !== 1)) throw new Error("Energy and food source inventory mismatch");
  const workbooks = new Map<string, Map<string, WorkbookCell>>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Energy and food source capture mismatch: ${source.local_file}`);
    // The efficiency workbook is an .xls that only cross-checks totals; none of its cells is served.
    if (ENERGY_FOOD_SOURCES.includes(source.source_id) && source.local_file.endsWith(".xlsx")) workbooks.set(source.source_id, readWorkbookCells(bytes));
  }
  const report = JSON.parse(await fs.readFile(path.join(directory, "validation-report.json"), "utf8")) as { status: string; reconciliation_failed_count: number; imputed_values: number };
  const independent = JSON.parse(await fs.readFile(path.join(directory, "independent-validation.json"), "utf8")) as { status: string };
  if (report.status !== "passed" || report.reconciliation_failed_count !== 0 || report.imputed_values !== 0 || independent.status !== "passed") throw new Error("Energy and food research package validation has not passed");
  const rows = parse(await fs.readFile(path.join(directory, "energy-food-annual.csv")), { columns: true, bom: true, skip_empty_lines: true }) as CsvRecord[];
  const facts: EnergyFoodFact[] = rows.map(row => {
    const where = `${row.source_id}:${row.source_sheet}:${row.source_cell}`;
    const cell = workbooks.get(row.source_id)?.get(`${row.source_sheet}:${row.source_cell}`);
    if (row.value_status === "no_flow" ? !isDash(cell) || row.value !== "0" : cell?.token !== row.value) throw new Error(`Energy and food source cell mismatch: ${where}`);
    return {
      year: Number(row.year), indicatorId: row.indicator_id as EnergyFoodFact["indicatorId"], value: row.value, publishedValue: row.published_value,
      unit: row.unit as EnergyFoodFact["unit"], basis: row.basis as "actual", valueStatus: row.value_status as EnergyFoodFact["valueStatus"],
      sourceId: row.source_id, sourceSheet: row.source_sheet, sourceCell: row.source_cell, sourceNumberFormat: row.source_number_format, lastReviewedAt: REVIEWED_AT,
    };
  });
  validateEnergyFoodFacts(facts);
  facts.sort((a, b) => energyFoodFactKey(a).localeCompare(energyFoodFactKey(b)));
  const csv = serializeBomCsvRows([ENERGY_FOOD_CSV_HEADERS, ...facts.map(f => [f.year, f.indicatorId, f.value, f.publishedValue, f.unit, f.basis, f.valueStatus, f.sourceId, f.sourceSheet, f.sourceCell, f.sourceNumberFormat, f.lastReviewedAt])]);
  const years = facts.map(f => f.year);
  const acceptance: EnergyFoodAcceptance = {
    status: "passed", years: { min: Math.min(...years), max: Math.max(...years) }, observations: facts.length,
    researchStatus: report.status, canonicalSha256: createHash("sha256").update(csv).digest("hex"), reviewedAt: REVIEWED_AT,
  };
  for (const [relative, content] of [["data/imports/energy-food-annual.csv", csv], ["data/reports/energy-food-validation.json", `${JSON.stringify(acceptance, null, 2)}\n`]]) {
    const target = path.join(repositoryRoot, relative);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, "utf8"); }
    else await assertGeneratedArtifactMatches("energy and food", target, content);
  }
}
