import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { ADMIN_SPENDING_YEARS } from "../coverage";
import { codeDepth, findLeafCodes, normalizeOfficialCode, parentCodeFor } from "../realExpenditure/hierarchy";
import { parseTavi6Rows } from "../realExpenditure/parseTavi6Rows";
import type { MatrixCell } from "../realExpenditure/parseTavi6Rows";
import type { OfficialExpenditureRow } from "../realExpenditure/types";

const WORKBOOK_DIR = "../../docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025";
const SOURCE_ID_BY_YEAR: Record<number, string> = Object.fromEntries(
  ADMIN_SPENDING_YEARS.map((year) => [year, `source.mof_${year}_programmatic_fact_actual`]),
) as Record<number, string>;

function yearFromFileName(fileName: string): number | null {
  const match = fileName.match(/^(20\d{2})/);
  return match ? Number(match[1]) : null;
}

function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellText(value: MatrixCell): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numericCell(value: MatrixCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replaceAll(",", "").replace(/\s+/g, "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function pickSheetName(workbook: XLSX.WorkBook): string {
  const available = workbook.SheetNames;
  const preferred = available.find((name) => {
    const normalized = normalizeSheetName(name);
    return normalized.includes("tavi 6") || /(^|\s)vi(\s|$)/.test(normalized);
  });

  return preferred ?? available[0];
}

function contextFor(code: string | null, rowsByCode: Map<string, { labelKa: string }>) {
  if (!code) {
    return {
      institutionCode: null,
      institutionLabelKa: null,
      programCode: null,
      programLabelKa: null,
      subprogramCode: null,
      subprogramLabelKa: null,
    };
  }

  const parts = code.split(" ");
  const institutionCode = parts.length >= 2 ? `${parts[0]} 00` : null;
  const programCode = parts.length >= 2 && parts[1] !== "00" ? `${parts[0]} ${parts[1]}` : null;
  const subprogramCode = parts.length >= 3 ? `${parts[0]} ${parts[1]} ${parts[2]}` : null;

  return {
    institutionCode,
    institutionLabelKa: institutionCode ? rowsByCode.get(institutionCode)?.labelKa ?? null : null,
    programCode,
    programLabelKa: programCode ? rowsByCode.get(programCode)?.labelKa ?? null : null,
    subprogramCode,
    subprogramLabelKa: subprogramCode ? rowsByCode.get(subprogramCode)?.labelKa ?? null : null,
  };
}

function finalizeRows(rows: Array<Omit<OfficialExpenditureRow, "isLeafCode">>): OfficialExpenditureRow[] {
  const leafCodes = new Set(findLeafCodes(rows.map((row) => row.code).filter((code): code is string => Boolean(code))));
  const rowsByCode = new Map(rows.filter((row) => row.code).map((row) => [row.code as string, { labelKa: row.labelKa }]));

  return rows.map((row) => ({
    ...row,
    ...contextFor(row.code, rowsByCode),
    isLeafCode: row.code ? leafCodes.has(row.code) : false,
  }));
}

function rowFromParts(input: {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  rowNumber: number;
  code: string | null;
  labelKa: string;
  approvedPlanThousandGel: number | null;
  revisedPlanThousandGel: number | null;
  actualThousandGel: number;
  executionPercent: number | null;
}): Omit<OfficialExpenditureRow, "isLeafCode"> {
  return {
    ...input,
    parentCode: input.code ? parentCodeFor(input.code) : null,
    depth: input.code ? codeDepth(input.code) : null,
    institutionCode: null,
    institutionLabelKa: null,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: input.code === "00 00",
    isCodedRow: Boolean(input.code),
  };
}

function parseNormalizedRowsSheet(input: {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
}): OfficialExpenditureRow[] {
  const headers = (input.matrix[0] ?? []).map(cellText);
  const codeIndex = headers.indexOf("code");
  const labelIndex = headers.indexOf("label");
  const actualIndex = headers.includes(`fact_${input.year}`)
    ? headers.indexOf(`fact_${input.year}`)
    : headers.indexOf("total_actual");

  if (codeIndex < 0 || labelIndex < 0 || actualIndex < 0) return [];

  const rows = input.matrix
    .slice(1)
    .map((row, index) => {
      const code = normalizeOfficialCode(row[codeIndex]);
      const labelKa = cellText(row[labelIndex]);
      const actualThousandGel = numericCell(row[actualIndex]);

      if (!labelKa || actualThousandGel === null) return null;

      return rowFromParts({
        year: input.year,
        sourceId: input.sourceId,
        workbookPath: input.workbookPath,
        sheetName: input.sheetName,
        rowNumber: index + 2,
        code,
        labelKa,
        approvedPlanThousandGel: null,
        revisedPlanThousandGel: null,
        actualThousandGel,
        executionPercent: null,
      });
    })
    .filter((row): row is Omit<OfficialExpenditureRow, "isLeafCode"> => Boolean(row));

  return finalizeRows(rows);
}

function parseExtractedTablesSheet(input: {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
}): OfficialExpenditureRow[] {
  const headers = (input.matrix[0] ?? []).map(cellText);
  const codeIndex = headers.indexOf("col_1");
  const labelIndex = headers.indexOf("col_2");
  const actualIndex = headers.indexOf("col_5");
  const revisedPlanIndex = headers.indexOf("col_4");
  const approvedPlanIndex = headers.indexOf("col_3");

  if (codeIndex < 0 || labelIndex < 0 || actualIndex < 0) return [];

  const rows = input.matrix
    .slice(1)
    .map((row, index) => {
      const code = normalizeOfficialCode(row[codeIndex]);
      const labelKa = cellText(row[labelIndex]).replace(/\s+/g, " ");
      const actualThousandGel = numericCell(row[actualIndex]);

      if (!labelKa || actualThousandGel === null) return null;

      return rowFromParts({
        year: input.year,
        sourceId: input.sourceId,
        workbookPath: input.workbookPath,
        sheetName: input.sheetName,
        rowNumber: index + 2,
        code,
        labelKa,
        approvedPlanThousandGel: approvedPlanIndex >= 0 ? numericCell(row[approvedPlanIndex]) : null,
        revisedPlanThousandGel: revisedPlanIndex >= 0 ? numericCell(row[revisedPlanIndex]) : null,
        actualThousandGel,
        executionPercent: null,
      });
    })
    .filter((row): row is Omit<OfficialExpenditureRow, "isLeafCode"> => Boolean(row));

  return finalizeRows(rows);
}

function parseFallbackRows(input: {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
}): OfficialExpenditureRow[] {
  const headers = (input.matrix[0] ?? []).map(cellText);

  if (headers.includes("code") && headers.includes("label")) {
    return parseNormalizedRowsSheet(input);
  }

  if (headers.includes("col_1") && headers.includes("col_2")) {
    return parseExtractedTablesSheet(input);
  }

  return [];
}

export function parseAdminWorkbookRows(input: {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
}): OfficialExpenditureRow[] {
  const fallbackRows = parseFallbackRows(input);
  if (fallbackRows.length > 0) return fallbackRows;

  return parseTavi6Rows(input);
}

export function extractAdminSpendingOfficialRows(): OfficialExpenditureRow[] {
  const workbookDir = path.resolve(process.cwd(), WORKBOOK_DIR);
  const adminYears = new Set(ADMIN_SPENDING_YEARS);
  const workbookFiles = fs
    .readdirSync(workbookDir)
    .map((fileName) => ({ fileName, year: yearFromFileName(fileName) }))
    .filter((source): source is { fileName: string; year: number } => {
      return Boolean(source.year && adminYears.has(source.year) && /\.xlsx$/i.test(source.fileName));
    })
    .sort((a, b) => a.year - b.year);

  return workbookFiles.flatMap(({ fileName, year }) => {
    const workbookPath = path.join(WORKBOOK_DIR, fileName);
    const workbookFile = path.resolve(process.cwd(), workbookPath);
    const workbook = XLSX.readFile(workbookFile, { cellDates: false });
    const sheetName = pickSheetName(workbook);
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) throw new Error(`Missing sheet after selection: ${sheetName}`);

    const matrix = XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true,
    });

    return parseAdminWorkbookRows({
      year,
      sourceId: SOURCE_ID_BY_YEAR[year],
      workbookPath: workbookPath.replace("../../", ""),
      sheetName,
      matrix,
    });
  });
}
