import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { cellText, numericCell, type MatrixCell } from "../parsing/cellUtils";
import { contextFor } from "../parsing/hierarchyContext";
import { sheetToMatrix } from "../parsing/workbookMatrix";
import { codeDepth, findLeafCodes, normalizeOfficialCode, parentCodeFor } from "../realExpenditure/hierarchy";
import type { OfficialExpenditureRow } from "../realExpenditure/types";
import type { ExpenditurePdfPageText } from "../realExpenditurePdf/phase1Pilot";
import { transliterateAcadNusx } from "./transliterateAcadNusx";

/**
 * Extractors for the pre-2017 ministries-expenditure years that do NOT fit the generic
 * "<year>-fact.xlsx, tavi 6, leaf aggregation" path:
 *
 *  - 2004: the complete state-budget annex is a 317-page PDF. Its 47 institution totals are
 *    parsed and human-reviewed into a narrow CSV handoff for synchronous regeneration.
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

// ---------------------------------------------------------------------------
// 2004 — reviewed ministry totals from the complete state-budget annex
// ---------------------------------------------------------------------------

const Y2004_SOURCE_ID = "source.mof_2004_programmatic_fact_actual";
const Y2004_SOURCE_PATH =
  "docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-annex.pdf";
const Y2004_REVIEW_PATH = "../../data/mappings/review/admin-spending-institution-review-2004.csv";
const Y2004_PRINTED_TOTAL_THOUSAND_GEL = 1930210.3;
const Y2004_FINANCE_CODE = "22 00";
const Y2004_CULTURE_CODE = "30 00";
const Y2004_DEBT_SERVICE_THOUSAND_GEL = 291350.1;
const Y2004_INTERGOVERNMENTAL_TRANSFERS_THOUSAND_GEL = 128234.0;
const Y2004_SPORT_THOUSAND_GEL = 6866.0;
const Y2004_STATE_WIDE_DEBT_LABEL =
  "საერთო-სახელმწიფოებრივი მნიშვნელობის გადასახდელები – სახელმწიფო ვალდებულებების მომსახურება და დაფარვა";
const Y2004_STATE_WIDE_OTHER_LABEL =
  "საერთო-სახელმწიფოებრივი მნიშვნელობის გადასახდელები – ტრანსფერები და სხვა გადასახდელები";

export type AdminSpending2004Institution = {
  code: string;
  labelKa: string;
  approvedPlanThousandGel: number;
  actualThousandGel: number;
  pageNumber: number;
};

type AdminSpending2004ReviewRow = {
  year: string;
  source_id: string;
  official_code: string;
  official_label_ka: string;
  approved_plan_thousand_gel: string;
  actual_thousand_gel: string;
  source_page: string;
  admin_spending_category_id: string;
  mapping_confidence: string;
  mapping_notes: string;
};

function parseThousandGel(value: string): number {
  return Number(value.replaceAll(" ", "").replace(",", "."));
}

/**
 * Parse the 47 top-level organizational rows from annex pages 2-231. This pure parser is used to
 * verify the reviewed CSV handoff against the immutable PDF; the synchronous admin generator reads
 * that reviewed handoff so it does not need to parse a 317-page PDF on every regeneration.
 */
export function parseAdminSpending2004Pages(pages: ExpenditurePdfPageText[]): AdminSpending2004Institution[] {
  const institutions: AdminSpending2004Institution[] = [];

  for (const page of pages.filter((candidate) => candidate.pageNumber >= 2 && candidate.pageNumber <= 231)) {
    const pattern = /^(\d{2}) 00\s+([\s\S]*?) ([\d ]+,\d) ([\d ]+,\d)$/gm;
    for (const match of page.text.matchAll(pattern)) {
      institutions.push({
        code: `${match[1]} 00`,
        labelKa: transliterateAcadNusx(match[2].replace(/\s+/g, " ").trim()),
        approvedPlanThousandGel: parseThousandGel(match[3]),
        actualThousandGel: parseThousandGel(match[4]),
        pageNumber: page.pageNumber,
      });
    }
  }

  const codes = institutions.map((row) => row.code);
  if (institutions.length !== 47 || new Set(codes).size !== 47) {
    throw new Error(`2004 annex: expected 47 unique top-level institutions, found ${institutions.length}`);
  }
  for (let code = 1; code <= 47; code += 1) {
    const expected = `${String(code).padStart(2, "0")} 00`;
    if (!codes.includes(expected)) throw new Error(`2004 annex: missing top-level institution ${expected}`);
  }

  return institutions;
}

function reviewed2004Institutions(): AdminSpending2004Institution[] {
  const file = path.resolve(process.cwd(), Y2004_REVIEW_PATH);
  const reviewRows = parse(readFileSync(file, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as AdminSpending2004ReviewRow[];

  if (reviewRows.length !== 47 || new Set(reviewRows.map((row) => row.official_code)).size !== 47) {
    throw new Error(`2004 institution review: expected 47 unique official rows, found ${reviewRows.length}`);
  }

  return reviewRows.map((row) => {
    if (row.year !== "2004" || row.source_id !== Y2004_SOURCE_ID) {
      throw new Error(`2004 institution review: unexpected provenance for ${row.official_code}`);
    }
    return {
      code: row.official_code,
      labelKa: row.official_label_ka,
      approvedPlanThousandGel: Number(row.approved_plan_thousand_gel),
      actualThousandGel: Number(row.actual_thousand_gel),
      pageNumber: Number(row.source_page),
    };
  });
}

function make2004Row(input: {
  code: string;
  label: string;
  actual: number;
  approved: number | null;
  pageNumber: number;
  parentCode: string | null;
  isTotal?: boolean;
  isCodedRow?: boolean;
  isLeafCode?: boolean;
}): OfficialExpenditureRow {
  return {
    year: 2004,
    sourceId: Y2004_SOURCE_ID,
    workbookPath: Y2004_SOURCE_PATH,
    sheetName: "annex pages 2-231",
    rowNumber: input.pageNumber,
    code: input.code,
    parentCode: input.parentCode,
    depth: input.isTotal ? 0 : 1,
    institutionCode: input.isTotal ? null : input.parentCode ?? input.code,
    institutionLabelKa: input.isTotal ? null : input.label,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: input.isTotal ?? false,
    isCodedRow: input.isCodedRow ?? true,
    isLeafCode: input.isLeafCode ?? !input.isTotal,
    labelKa: input.label,
    approvedPlanThousandGel: input.approved,
    revisedPlanThousandGel: null,
    actualThousandGel: input.actual,
    executionPercent: null,
  };
}

function make2004SyntheticSplit(input: {
  key: string;
  parentCode: string;
  label: string;
  actual: number;
  pageNumber: number;
}): OfficialExpenditureRow {
  return make2004Row({
    code: `synthetic:${input.parentCode.replace(" ", "_")}:${input.key}`,
    label: input.label,
    actual: input.actual,
    approved: null,
    pageNumber: input.pageNumber,
    parentCode: input.parentCode,
    isCodedRow: false,
    isLeafCode: true,
  });
}

export function extractAdminSpending2004Rows(): OfficialExpenditureRow[] {
  const institutions = reviewed2004Institutions();
  const rows: OfficialExpenditureRow[] = [
    make2004Row({
      code: "00 00",
      label: "საქართველოს სახელმწიფო ბიუჯეტის გადასახდელები და ხარჯები",
      actual: Y2004_PRINTED_TOTAL_THOUSAND_GEL,
      approved: 1926355.6,
      pageNumber: 231,
      parentCode: null,
      isTotal: true,
      isLeafCode: false,
    }),
  ];

  for (const institution of institutions) {
    rows.push(
      make2004Row({
        code: institution.code,
        label: institution.labelKa,
        actual: institution.actualThousandGel,
        approved: institution.approvedPlanThousandGel,
        pageNumber: institution.pageNumber,
        parentCode: "00 00",
        isLeafCode: true,
      }),
    );

    if (institution.code === Y2004_FINANCE_CODE) {
      const financeProper =
        institution.actualThousandGel -
        Y2004_DEBT_SERVICE_THOUSAND_GEL -
        Y2004_INTERGOVERNMENTAL_TRANSFERS_THOUSAND_GEL;
      rows.push(
        make2004SyntheticSplit({
          key: "finance",
          parentCode: institution.code,
          label: institution.labelKa,
          actual: financeProper,
          pageNumber: institution.pageNumber,
        }),
        make2004SyntheticSplit({
          key: "debt",
          parentCode: institution.code,
          label: Y2004_STATE_WIDE_DEBT_LABEL,
          actual: Y2004_DEBT_SERVICE_THOUSAND_GEL,
          pageNumber: institution.pageNumber,
        }),
        make2004SyntheticSplit({
          key: "transfers",
          parentCode: institution.code,
          label: Y2004_STATE_WIDE_OTHER_LABEL,
          actual: Y2004_INTERGOVERNMENTAL_TRANSFERS_THOUSAND_GEL,
          pageNumber: institution.pageNumber,
        }),
      );
    }

    if (institution.code === Y2004_CULTURE_CODE) {
      rows.push(
        make2004SyntheticSplit({
          key: "culture",
          parentCode: institution.code,
          label: "საქართველოს კულტურისა და ძეგლთა დაცვის სამინისტრო",
          actual: institution.actualThousandGel - Y2004_SPORT_THOUSAND_GEL,
          pageNumber: institution.pageNumber,
        }),
        make2004SyntheticSplit({
          key: "sport",
          parentCode: institution.code,
          label: "სპორტის დეპარტამენტი",
          actual: Y2004_SPORT_THOUSAND_GEL,
          pageNumber: institution.pageNumber,
        }),
      );
    }
  }

  return rows;
}

function readMatrix(fileName: string, sheetName: string): MatrixCell[][] {
  const file = path.resolve(process.cwd(), path.join(WORKBOOK_DIR, fileName));
  const workbook = XLSX.readFile(file, { cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing sheet "${sheetName}" in ${fileName}. Available: ${workbook.SheetNames.join(", ")}`);
  return sheetToMatrix(sheet);
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
  2004: extractAdminSpending2004Rows,
  2005: extractAdminSpending2005Rows,
  2014: extractAdminSpending2014Rows,
};
