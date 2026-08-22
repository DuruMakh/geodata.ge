import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { pickSheetName, type MatrixCell, type PickSheetNameOptions } from "./cellUtils";

/**
 * Canonical sheet-to-matrix conversion for the budget workbook pipelines: one array per
 * non-blank row, empty cells preserved as null, raw (unformatted) cell values.
 */
export function sheetToMatrix(sheet: XLSX.WorkSheet): MatrixCell[][] {
  return XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });
}

/** Read a workbook, resolve its sheet via pickSheetName, and return the sheet's matrix. */
export function readWorkbookMatrix(
  workbookFile: string,
  options: PickSheetNameOptions,
): { sheetName: string; matrix: MatrixCell[][] } {
  // xlsx 0.20's ESM build has no implicit node:fs binding, so XLSX.readFile
  // needs set_fs() first. Reading the bytes here and handing them to
  // XLSX.read instead keeps the parser fs-free — the same form
  // lib/data/nationalGdp/prepareNationalGdp.ts already uses.
  const workbook = XLSX.read(readFileSync(workbookFile), { type: "buffer", cellDates: false });
  const sheetName = pickSheetName(workbook, options);
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) throw new Error(`Missing sheet after selection: ${sheetName}`);

  return { sheetName, matrix: sheetToMatrix(sheet) };
}
