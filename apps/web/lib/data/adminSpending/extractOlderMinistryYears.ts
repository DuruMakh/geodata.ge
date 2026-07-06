import path from "node:path";
import * as XLSX from "xlsx";
import { cellText, numericCell, type MatrixCell } from "../parsing/cellUtils";
import { contextFor } from "../parsing/hierarchyContext";
import { codeDepth, findLeafCodes, normalizeOfficialCode, parentCodeFor } from "../realExpenditure/hierarchy";
import type { OfficialExpenditureRow } from "../realExpenditure/types";
import { transliterateAcadNusx } from "./transliterateAcadNusx";

/**
 * Extractors for the two pre-2017 ministries-expenditure years that do NOT fit the generic
 * "<year>-fact.xlsx, tavi 6, leaf aggregation" path:
 *
 *  - 2005: the workbook stores AcadNusx-transliterated labels and only ministry TOTALS
 *    (sub-program detail is incomplete), so we transliterate and aggregate at the institution
 *    level. It has no grand-total row (synthesized here) and no debt/reserves breakdown: the
 *    Finance line (25 00) bundles debt service + transfers + finance-ministry-proper, which we
 *    split using magnitudes from the 2005 functional-classification report (see constants).
 *
 *  - 2014: the repo's 2014-fact.xlsx is the budget LAW (plan), not actuals. The 2014 ACTUALS
 *    live in 2015-fact.xlsx column col_4 (00 00 = 9,009,812.2k = the official 2014 payments
 *    total), with full leaf detail — so 2014 aggregates at leaf level like 2017-2025.
 */

const WORKBOOK_DIR = "../../docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025";

function readMatrix(fileName: string, sheetName: string): MatrixCell[][] {
  const file = path.resolve(process.cwd(), path.join(WORKBOOK_DIR, fileName));
  const workbook = XLSX.readFile(file, { cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing sheet "${sheetName}" in ${fileName}. Available: ${workbook.SheetNames.join(", ")}`);
  return XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, { header: 1, blankrows: false, defval: null, raw: true });
}

function repoWorkbookPath(fileName: string): string {
  return path.join(WORKBOOK_DIR, fileName).replace("../../", "");
}

// ---------------------------------------------------------------------------
// 2005 — AcadNusx, ministry totals only, Finance line split from functional report
// ---------------------------------------------------------------------------

const Y2005_SOURCE_ID = "source.mof_2005_programmatic_fact_actual";
const Y2005_FINANCE_CODE = "25 00";
// From the 2005 treasury functional-classification report, block 14 ("expenses not attributable
// to main divisions"): 14 01 01 operations on state debt obligations = 282,040.4k;
// 14 02 02 subventions to local governments = 176,742.9k; 14 03 other = 2,057.9k. These were
// all disbursed administratively under the Ministry of Finance (org line 25 00) in 2005, which
// had no separate state-wide-payments institution.
const Y2005_DEBT_SERVICE_THOUSAND_GEL = 282040.4;
const Y2005_TRANSFERS_AND_OTHER_THOUSAND_GEL = 176742.9 + 2057.9;
const Y2005_STATE_WIDE_DEBT_LABEL =
  "საერთო-სახელმწიფოებრივი მნიშვნელობის გადასახდელები – სახელმწიფო ვალდებულებების მომსახურება და დაფარვა";
const Y2005_STATE_WIDE_OTHER_LABEL =
  "საერთო-სახელმწიფოებრივი მნიშვნელობის გადასახდელები – ტრანსფერები და სხვა გადასახდელები";

// The 2005 Ministry of Culture, Monuments Protection & Sport (workbook line 33 00 = 34,433.2k) is a
// combined ministry. The 2005 annual execution report
// (docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2005-annual-execution-report.pdf,
// SHA-256 3cde917addd4cf2f689639e386ab706bc2f4a9bae9f01f21aab1994273fd5de8) breaks it into departments
// whose actuals sum to that exact total: a Sport Department (6,915.1k) and a Youth Affairs Department
// (2,887.9k), the remainder (24,630.2k) being culture/monuments. Owner decisions: sport -> sport,
// youth -> education/science/youth, remainder -> culture. The labels below are chosen so
// classifyAdminSpendingCategory routes each split part to the intended category.
const Y2005_CULTURE_CODE = "33 00";
const Y2005_SPORT_THOUSAND_GEL = 6915.1;
const Y2005_YOUTH_THOUSAND_GEL = 2887.9;
const Y2005_CULTURE_LABEL = "საქართველოს კულტურის და ძეგლთა დაცვის სამინისტრო";
const Y2005_SPORT_LABEL = "სპორტის დეპარტამენტი";
const Y2005_YOUTH_LABEL = "ახალგაზრდობის საქმეთა დეპარტამენტი";

// The 2005 organizational workbook is a preliminary ministry-total annex whose itemised rows sum
// to 2,609,022.9k, but the official 2005 payments grand total is 2,626,507.3k — the figure the
// treasury functional E11 report carries and the functional-expenditure pipeline reconciles to
// (and the same org==official identity that holds for 2006: 3,822,512.6k). The ~17.5M the 2005
// workbook does not itemise by ministry is booked to Other costs as an explicit undistributed
// residual, so 2005 reconciles to the official total and agrees with the functional dataset
// (see tests/data/pipelineIntegration.test.ts) instead of understating the budget by 0.67%.
const Y2005_OFFICIAL_TOTAL_THOUSAND_GEL = 2626507.3;
const Y2005_RESIDUAL_CODE = "90 00";
const Y2005_RESIDUAL_LABEL = "გაუნაწილებელი გადასახდელები (2005 ორგანიზაციული ნაშთი)";

function make2005Row(input: {
  code: string;
  label: string;
  actual: number;
  rowNumber: number;
  isTotal?: boolean;
}): OfficialExpenditureRow {
  const { code, label, actual, rowNumber, isTotal = false } = input;
  return {
    year: 2005,
    sourceId: Y2005_SOURCE_ID,
    workbookPath: repoWorkbookPath("2005-fact.xlsx"),
    sheetName: "rows",
    rowNumber,
    code,
    parentCode: isTotal ? null : "00 00",
    // Every kept 2005 row is a ministry-level owner (institution total), so treat it as depth-1.
    depth: isTotal ? 0 : 1,
    institutionCode: isTotal ? null : code,
    institutionLabelKa: isTotal ? null : label,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal,
    isCodedRow: true,
    // Institution rows are the leaves for this ministry-total year; the synthetic total is not.
    isLeafCode: !isTotal,
    labelKa: label,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: actual,
    executionPercent: null,
  };
}

export function extractAdminSpending2005Rows(): OfficialExpenditureRow[] {
  const matrix = readMatrix("2005-fact.xlsx", "rows");
  const headers = (matrix[0] ?? []).map(cellText);
  const codeIndex = headers.indexOf("code");
  const labelIndex = headers.indexOf("label");
  const actualIndex = headers.indexOf("fact_2005");
  if (codeIndex < 0 || labelIndex < 0 || actualIndex < 0) {
    throw new Error('2005 workbook: expected "code", "label" and "fact_2005" columns in sheet "rows".');
  }

  const codesPresent = new Set(
    matrix
      .slice(1)
      .map((row) => normalizeOfficialCode(row[codeIndex]))
      .filter((code): code is string => Boolean(code)),
  );

  // Keep only subtree-root rows — coded rows whose parent code is absent from the file. That is
  // the 34 "NN 00" institutions plus the orphan Patriarchate subtree-top "43 03" (its "43 00"
  // parent is not printed). Their children are dropped because 2005 sub-detail is incomplete.
  const roots: Array<{ code: string; label: string; actual: number; rowNumber: number }> = [];
  matrix.slice(1).forEach((row, index) => {
    const code = normalizeOfficialCode(row[codeIndex]);
    if (!code) return;
    const parent = parentCodeFor(code);
    if (parent && codesPresent.has(parent)) return;
    const actual = numericCell(row[actualIndex], { stripWhitespace: true });
    const label = transliterateAcadNusx(cellText(row[labelIndex]));
    if (actual === null || !label) return;
    roots.push({ code, label, actual, rowNumber: index + 2 });
  });

  const rootsSum = roots.reduce((sum, root) => sum + root.actual, 0);
  // Reconcile to the official 2005 payments total, not the incomplete workbook sum (see constants).
  const grandTotal = Y2005_OFFICIAL_TOTAL_THOUSAND_GEL;

  const rows: OfficialExpenditureRow[] = [
    make2005Row({ code: "00 00", label: "სულ ჯამი", actual: grandTotal, rowNumber: 1, isTotal: true }),
  ];

  for (const root of roots) {
    if (root.code === Y2005_FINANCE_CODE) {
      const financeProper =
        root.actual - Y2005_DEBT_SERVICE_THOUSAND_GEL - Y2005_TRANSFERS_AND_OTHER_THOUSAND_GEL;
      rows.push(make2005Row({ code: root.code, label: root.label, actual: financeProper, rowNumber: root.rowNumber }));
      rows.push(
        make2005Row({
          code: root.code,
          label: Y2005_STATE_WIDE_DEBT_LABEL,
          actual: Y2005_DEBT_SERVICE_THOUSAND_GEL,
          rowNumber: root.rowNumber,
        }),
      );
      rows.push(
        make2005Row({
          code: root.code,
          label: Y2005_STATE_WIDE_OTHER_LABEL,
          actual: Y2005_TRANSFERS_AND_OTHER_THOUSAND_GEL,
          rowNumber: root.rowNumber,
        }),
      );
    } else if (root.code === Y2005_CULTURE_CODE) {
      const culture = root.actual - Y2005_SPORT_THOUSAND_GEL - Y2005_YOUTH_THOUSAND_GEL;
      rows.push(make2005Row({ code: root.code, label: Y2005_CULTURE_LABEL, actual: culture, rowNumber: root.rowNumber }));
      rows.push(
        make2005Row({ code: root.code, label: Y2005_SPORT_LABEL, actual: Y2005_SPORT_THOUSAND_GEL, rowNumber: root.rowNumber }),
      );
      rows.push(
        make2005Row({ code: root.code, label: Y2005_YOUTH_LABEL, actual: Y2005_YOUTH_THOUSAND_GEL, rowNumber: root.rowNumber }),
      );
    } else {
      rows.push(make2005Row(root));
    }
  }

  // Undistributed residual (official total minus the itemised ministry rows) -> Other costs, so the
  // category sum reconciles to the official 2005 payments total.
  const residual = Math.round((grandTotal - rootsSum) * 10) / 10;
  if (residual > 0.05) {
    rows.push(
      make2005Row({ code: Y2005_RESIDUAL_CODE, label: Y2005_RESIDUAL_LABEL, actual: residual, rowNumber: roots.length + 2 }),
    );
  }

  return rows;
}

// ---------------------------------------------------------------------------
// 2014 — actuals from 2015-fact.xlsx col_4, full leaf detail
// ---------------------------------------------------------------------------

const Y2014_SOURCE_ID = "source.mof_2014_programmatic_fact_actual";

export function extractAdminSpending2014Rows(): OfficialExpenditureRow[] {
  const matrix = readMatrix("2015-fact.xlsx", "extracted_tables");
  const headers = (matrix[0] ?? []).map(cellText);
  const codeIndex = headers.indexOf("col_1");
  const labelIndex = headers.indexOf("col_2");
  const actualIndex = headers.indexOf("col_4"); // 2014 actual (col_3 = 2013 fact, col_5 = 2015 plan)
  if (codeIndex < 0 || labelIndex < 0 || actualIndex < 0) {
    throw new Error("2014 (2015 workbook): expected col_1/col_2/col_4 in sheet extracted_tables.");
  }

  // The first embedded-table row echoes the Georgian headers; confirm col_4 really is the 2014
  // actual before mapping numbers out of it.
  const headerTextRow = matrix[1] ?? [];
  const actualHeaderText = cellText(headerTextRow[actualIndex]).replace(/\s+/g, " ");
  if (actualHeaderText && !actualHeaderText.includes("2014")) {
    throw new Error(
      `2014 extraction: expected col_4 to be the 2014 actual column, but its header reads "${actualHeaderText}".`,
    );
  }

  const preliminary = matrix
    .slice(1)
    .map((row, index): Omit<OfficialExpenditureRow, "isLeafCode"> | null => {
      const code = normalizeOfficialCode(row[codeIndex]);
      const labelKa = cellText(row[labelIndex]).replace(/\s+/g, " ");
      const actualThousandGel = numericCell(row[actualIndex], { stripWhitespace: true });
      if (!labelKa || actualThousandGel === null) return null;

      return {
        year: 2014,
        sourceId: Y2014_SOURCE_ID,
        workbookPath: repoWorkbookPath("2015-fact.xlsx"),
        sheetName: "extracted_tables (col_4 = 2014 actual)",
        rowNumber: index + 2,
        code,
        parentCode: code ? parentCodeFor(code) : null,
        depth: code ? codeDepth(code) : null,
        institutionCode: null,
        institutionLabelKa: null,
        programCode: null,
        programLabelKa: null,
        subprogramCode: null,
        subprogramLabelKa: null,
        isTotal: code === "00 00",
        isCodedRow: Boolean(code),
        labelKa,
        approvedPlanThousandGel: null,
        revisedPlanThousandGel: null,
        actualThousandGel,
        executionPercent: null,
      };
    })
    .filter((row): row is Omit<OfficialExpenditureRow, "isLeafCode"> => Boolean(row));

  const leafCodes = new Set(
    findLeafCodes(preliminary.map((row) => row.code).filter((code): code is string => Boolean(code))),
  );
  const rowsByCode = new Map(
    preliminary.filter((row) => row.code).map((row) => [row.code as string, { labelKa: row.labelKa }]),
  );

  return preliminary.map((row) => ({
    ...row,
    ...contextFor(row.code, rowsByCode),
    isLeafCode: row.code ? leafCodes.has(row.code) : false,
  }));
}

export const OLDER_MINISTRY_YEAR_EXTRACTORS: Record<number, () => OfficialExpenditureRow[]> = {
  2005: extractAdminSpending2005Rows,
  2014: extractAdminSpending2014Rows,
};
