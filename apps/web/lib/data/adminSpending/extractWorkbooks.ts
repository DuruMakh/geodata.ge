import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { ADMIN_SPENDING_YEARS } from "../coverage";
import { cellText, numericCell, pickSheetName } from "../parsing/cellUtils";
import { contextFor } from "../parsing/hierarchyContext";
import { codeDepth, findLeafCodes, normalizeOfficialCode, parentCodeFor } from "../realExpenditure/hierarchy";
import { parseTavi6Rows } from "../realExpenditure/parseTavi6Rows";
import type { MatrixCell } from "../realExpenditure/parseTavi6Rows";
import type { OfficialExpenditureRow } from "../realExpenditure/types";
import { ANNUAL_REPORT_YEAR_EXTRACTORS } from "./extractAnnualReportYears";
import { OLDER_MINISTRY_YEAR_EXTRACTORS } from "./extractOlderMinistryYears";

const WORKBOOK_DIR = "../../docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025";
const SOURCE_ID_BY_YEAR: Record<number, string> = Object.fromEntries(
  ADMIN_SPENDING_YEARS.map((year) => [year, `source.mof_${year}_programmatic_fact_actual`]),
) as Record<number, string>;

function adminNumericCell(value: MatrixCell): number | null {
  return numericCell(value, { stripWhitespace: true });
}

type ParseSheetInput = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
  /** Optional collector for human-readable warnings about dropped content-bearing rows. */
  warnings?: string[];
};

function warnDroppedRow(
  input: ParseSheetInput,
  row: {
    rowNumber: number;
    code: string | null;
    labelKa: string;
    approved: number | null;
    revised: number | null;
    actual: number | null;
  },
) {
  // Only warn about rows that carry numeric content (or a code without a label).
  // Label-only rows are normal sheet structure in these workbooks: repeated page
  // headers and merged multi-line economic-detail labels.
  const hasAmount = row.approved !== null || row.revised !== null || row.actual !== null;
  if (!hasAmount && !(row.code && !row.labelKa)) return;

  const why = !row.labelKa ? "row has content but no label" : "row has a label and plan amounts but no actual amount";
  input.warnings?.push(
    `year ${input.year}, sheet "${input.sheetName}", row ${row.rowNumber} (${input.workbookPath}): ` +
      `dropped row — ${why}; code=${row.code ?? "-"}, label="${row.labelKa}", ` +
      `approved=${row.approved ?? "-"}, revised=${row.revised ?? "-"}, actual=${row.actual ?? "-"}`,
  );
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

function parseNormalizedRowsSheet(input: ParseSheetInput): OfficialExpenditureRow[] {
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
      const actualThousandGel = adminNumericCell(row[actualIndex]);

      if (!labelKa || actualThousandGel === null) {
        warnDroppedRow(input, {
          rowNumber: index + 2,
          code,
          labelKa,
          approved: null,
          revised: null,
          actual: actualThousandGel,
        });
        return null;
      }

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

/**
 * The extracted-tables sheets carry positional headers (col_1..col_5), so the parser
 * assumes: col_1 = code, col_2 = label, col_3/col_4 = plan figures, col_5 = actual.
 * When the first table row repeats the original Georgian header text, use it to verify
 * that the code/label columns are where the parser assumes them to be. The plan/actual
 * year columns intentionally stay unvalidated beyond "not a code/label header": their
 * wording varies per year (gegma, saka­so shesruleba, fact of a previous year, typos).
 */
function validateExtractedTablesHeader(
  input: ParseSheetInput,
  indexes: { codeIndex: number; labelIndex: number; amountIndexes: Array<{ name: string; index: number }> },
) {
  const headerRow = input.matrix[1] ?? [];
  const hasHeaderText = headerRow.some((cell) => {
    const text = cellText(cell);
    return text.includes("კოდი") || text.includes("დასახელება");
  });
  if (!hasHeaderText) return;

  const codeText = cellText(headerRow[indexes.codeIndex]).replace(/\s+/g, " ");
  const labelText = cellText(headerRow[indexes.labelIndex]).replace(/\s+/g, " ");

  const describe = `${input.workbookPath} sheet "${input.sheetName}"`;

  if (codeText.includes("დასახელება")) {
    throw new Error(
      `Extracted-tables header mismatch in ${describe}: expected the code column (col_1) to contain "კოდი" ` +
        `but found "${codeText}". The sheet's column order differs from the assumed col_1..col_5 layout.`,
    );
  }
  if (labelText.includes("კოდი")) {
    throw new Error(
      `Extracted-tables header mismatch in ${describe}: expected the label column (col_2) to contain "დასახელება" ` +
        `but found "${labelText}". The sheet's column order differs from the assumed col_1..col_5 layout.`,
    );
  }
  if (!codeText.includes("კოდი") && !labelText.includes("დასახელება")) {
    throw new Error(
      `Extracted-tables header mismatch in ${describe}: header text is present in the first table row, ` +
        `but neither col_1 ("${codeText}") contains "კოდი" nor col_2 ("${labelText}") contains "დასახელება". ` +
        "The sheet's column order differs from the assumed col_1..col_5 layout.",
    );
  }

  for (const { name, index } of indexes.amountIndexes) {
    if (index < 0) continue;
    const text = cellText(headerRow[index]).replace(/\s+/g, " ");
    if (text.includes("კოდი") || text.includes("დასახელება")) {
      throw new Error(
        `Extracted-tables header mismatch in ${describe}: expected the ${name} column to be a numeric column ` +
          `but its header reads "${text}". The sheet's column order differs from the assumed col_1..col_5 layout.`,
      );
    }
  }
}

function parseExtractedTablesSheet(input: ParseSheetInput): OfficialExpenditureRow[] {
  const headers = (input.matrix[0] ?? []).map(cellText);
  const codeIndex = headers.indexOf("col_1");
  const labelIndex = headers.indexOf("col_2");
  const actualIndex = headers.indexOf("col_5");
  const revisedPlanIndex = headers.indexOf("col_4");
  const approvedPlanIndex = headers.indexOf("col_3");

  if (codeIndex < 0 || labelIndex < 0 || actualIndex < 0) return [];

  validateExtractedTablesHeader(input, {
    codeIndex,
    labelIndex,
    amountIndexes: [
      { name: "approved plan (col_3)", index: approvedPlanIndex },
      { name: "revised plan (col_4)", index: revisedPlanIndex },
      { name: "actual (col_5)", index: actualIndex },
    ],
  });

  const rows = input.matrix
    .slice(1)
    .map((row, index) => {
      const code = normalizeOfficialCode(row[codeIndex]);
      const labelKa = cellText(row[labelIndex]).replace(/\s+/g, " ");
      const actualThousandGel = adminNumericCell(row[actualIndex]);

      if (!labelKa || actualThousandGel === null) {
        warnDroppedRow(input, {
          rowNumber: index + 2,
          code,
          labelKa,
          approved: approvedPlanIndex >= 0 ? adminNumericCell(row[approvedPlanIndex]) : null,
          revised: revisedPlanIndex >= 0 ? adminNumericCell(row[revisedPlanIndex]) : null,
          actual: actualThousandGel,
        });
        return null;
      }

      return rowFromParts({
        year: input.year,
        sourceId: input.sourceId,
        workbookPath: input.workbookPath,
        sheetName: input.sheetName,
        rowNumber: index + 2,
        code,
        labelKa,
        approvedPlanThousandGel: approvedPlanIndex >= 0 ? adminNumericCell(row[approvedPlanIndex]) : null,
        revisedPlanThousandGel: revisedPlanIndex >= 0 ? adminNumericCell(row[revisedPlanIndex]) : null,
        actualThousandGel,
        executionPercent: null,
      });
    })
    .filter((row): row is Omit<OfficialExpenditureRow, "isLeafCode"> => Boolean(row));

  return finalizeRows(rows);
}

function parseFallbackRows(input: ParseSheetInput): OfficialExpenditureRow[] {
  const headers = (input.matrix[0] ?? []).map(cellText);

  if (headers.includes("code") && headers.includes("label")) {
    return parseNormalizedRowsSheet(input);
  }

  if (headers.includes("col_1") && headers.includes("col_2")) {
    return parseExtractedTablesSheet(input);
  }

  return [];
}

export function parseAdminWorkbookRows(input: ParseSheetInput): OfficialExpenditureRow[] {
  const fallbackRows = parseFallbackRows(input);
  if (fallbackRows.length > 0) return fallbackRows;

  return parseTavi6Rows(input);
}

export function extractAdminSpendingOfficialRows(warnings?: string[]): OfficialExpenditureRow[] {
  return [...ADMIN_SPENDING_YEARS].sort((a, b) => a - b).flatMap((year) => {
    // 2005 and 2014 do not follow the generic "<year>-fact.xlsx, tavi 6" shape (2005 is
    // AcadNusx ministry-totals with a bundled Finance line; 2014's actuals live in the 2015
    // workbook). They have dedicated extractors.
    // Group C years come from the official annual-execution-report PDFs (pre-parsed to a
    // staging CSV), not from a <year>-fact.xlsx workbook.
    const annualReportExtractor = ANNUAL_REPORT_YEAR_EXTRACTORS[year];
    if (annualReportExtractor) return annualReportExtractor();

    const olderExtractor = OLDER_MINISTRY_YEAR_EXTRACTORS[year];
    if (olderExtractor) return olderExtractor();

    const fileName = `${year}-fact.xlsx`;
    const workbookPath = path.join(WORKBOOK_DIR, fileName);
    const workbookFile = path.resolve(process.cwd(), workbookPath);
    if (!fs.existsSync(workbookFile)) {
      throw new Error(`Missing admin spending workbook for ${year}: ${fileName}`);
    }
    const workbook = XLSX.readFile(workbookFile, { cellDates: false });
    const sheetName = pickSheetName(workbook, {
      fallbackPattern: (normalized) => normalized.includes("tavi 6") || /(^|\s)vi(\s|$)/.test(normalized),
      defaultToFirstSheet: true,
    });
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
      warnings,
    });
  });
}
