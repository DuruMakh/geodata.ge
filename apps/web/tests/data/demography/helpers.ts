import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import * as XLSX from "xlsx";
import type { DemographySources } from "../../../lib/data/demography/types";

export const repositoryRoot = path.resolve(process.cwd(), "../..");
export const VINTAGE_DIR = "docs/Raw Data/Demography/geostat-demography/2026-10";
const MUNICIPAL_TABLE_01 =
  "docs/Raw Data/Municipalities/geostat-population-regional-gdp/official/01-population-by-self-governed-unit.xlsx";

const created: string[] = [];

/** Removes every throwaway repository root a test created. Call once at the top of a describe. */
export function cleanUpTempRoots() {
  afterEach(async () => {
    await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });
}

/** A throwaway repository root holding only the demography package and the reused table 01. */
export async function copyDemographyPackage(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "demography-"));
  created.push(root);
  await cp(path.join(repositoryRoot, "docs/Raw Data/Demography"), path.join(root, "docs/Raw Data/Demography"), {
    recursive: true,
  });
  await mkdir(path.dirname(path.join(root, MUNICIPAL_TABLE_01)), { recursive: true });
  await cp(path.join(repositoryRoot, MUNICIPAL_TABLE_01), path.join(root, MUNICIPAL_TABLE_01));
  return root;
}

/** The same package with one table's workbook edited in memory: nothing on disk changes. */
export function editSource(
  sources: DemographySources,
  sourceId: string,
  edit: (sheet: XLSX.WorkSheet) => void,
): DemographySources {
  const original = sources.get(sourceId);
  const workbook = XLSX.read(original.bytes, { type: "buffer" });
  edit(workbook.Sheets[workbook.SheetNames[0]!]!);
  const bytes = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  return {
    vintage: sources.vintage,
    rows: sources.rows,
    get: (id) => (id === sourceId ? { row: original.row, bytes } : sources.get(id)),
  };
}

export function setCell(sheet: XLSX.WorkSheet, ref: string, value: string | number) {
  sheet[ref] = typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value };
}

/** The A1 reference under a year header, in the row holding `label`, for a table with one column per year. */
export function unitCell(sheet: XLSX.WorkSheet, label: string, year: number, firstYear = 1994): string {
  const range = XLSX.utils.decode_range(sheet["!ref"]!);
  for (let r = 0; r <= range.e.r; r += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (cell && String(cell.v).trim() === label) return XLSX.utils.encode_cell({ r, c: 1 + year - firstYear });
  }
  throw new Error(`No row labelled ${label}`);
}
