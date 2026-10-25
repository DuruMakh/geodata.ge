import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseAdminWorkbookRows } from "../adminSpending/extractWorkbooks";
import type { MatrixCell } from "../realExpenditure/parseTavi6Rows";
import type { OfficialExpenditureRow } from "../realExpenditure/types";
import { buildRowId, parentFunctionalCode, type ExpenditurePdfOfficialRow } from "../realExpenditurePdf/phase1Pilot";
import { parseThousandGel, readDocxTables } from "./readDocxTables";
import { BUDGET_LAW_2026 } from "./sources";

/** Both law tables print code, label, 2024 fact, 2025 plan, 2026 plan (then the 2026 funding split). */
const LAW_AMOUNT_COLUMNS = { fact2024: 2, plan2026: 4 } as const;
const LAW_COLUMN_YEARS = { fact2024: 2024, plan2026: 2026 } as const;

export type LawAmountColumn = keyof typeof LAW_AMOUNT_COLUMNS;

const FUNCTIONAL_CODE = /^7(\.\d+)*$/;

/**
 * Turns the Article 9 functional table (Tavi III) into the official-row shape the Treasury E11
 * parser produces, so the unchanged COFOG mapping rules read one column of the law as "actual".
 */
export function lawFunctionalRows(table: string[][], column: LawAmountColumn): ExpenditurePdfOfficialRow[] {
  const year = LAW_COLUMN_YEARS[column];
  const formId = "budget-law-article-9";
  const functionalPaths = new Map<string, string>();

  return table
    .filter((row) => FUNCTIONAL_CODE.test(row[0] ?? ""))
    .map((row, index): ExpenditurePdfOfficialRow => {
      const [code, labelKa] = row;
      const isGrandTotal = code === "7";
      const functionalCode = isGrandTotal ? null : code;
      let hierarchyPath = labelKa;
      if (functionalCode) {
        const parentCode = parentFunctionalCode(functionalCode);
        hierarchyPath = parentCode ? [functionalPaths.get(parentCode), labelKa].filter(Boolean).join(" > ") : labelKa;
        functionalPaths.set(functionalCode, hierarchyPath);
      }
      const actualRaw = row[LAW_AMOUNT_COLUMNS[column]] ?? "";
      const actualThousandGel = parseThousandGel(actualRaw);

      return {
        sourceId: BUDGET_LAW_2026.sourceId,
        sourceFile: "docs/Raw Data/Expenditure/mof.ge/budget-law-2026/2026-tavi-III.doc",
        year,
        formId,
        tableTitle: `2026 state budget law Article 9, functional classification (${column})`,
        pageNumber: 0,
        tableIndex: 1,
        rowIndex: index + 1,
        rowId: buildRowId({ year, formId, functionalCode, economicCode: "00", hierarchyPath }),
        rowType: isGrandTotal ? "grand_total" : "functional_total",
        includeInPublicMapping: !isGrandTotal,
        identityConfidence: "official_code",
        functionalCode,
        economicCode: "00",
        hierarchyPath,
        labelKa,
        approvedPlanRaw: null,
        approvedPlanThousandGel: null,
        approvedPlanGel: null,
        revisedPlanRaw: null,
        revisedPlanThousandGel: null,
        revisedPlanGel: null,
        actualRaw,
        actualThousandGel,
        actualGel: Math.round(actualThousandGel * 1000),
        annualObligationRaw: null,
        annualObligationThousandGel: null,
        annualObligationGel: null,
        yearResourceRaw: null,
        yearResourceThousandGel: null,
        yearResourceGel: null,
        sourceUnit: "gel",
        rawRowText: row.join(" | "),
      };
    });
}

/**
 * Turns the Article 16 table (Tavi VI) into a header-less matrix of `[code, label, null, null, 2026 plan]`
 * rows: parseTavi6Rows then finds the "00 00" row and reads the amount three cells after the label.
 */
export function lawTavi6Matrix(table: string[][]): MatrixCell[][] {
  return table
    .filter((row) => row[1] && row[1] !== "დასახელება")
    .map((row) => [row[0] || null, row[1], null, null, parseThousandGel(row[LAW_AMOUNT_COLUMNS.plan2026] ?? "")]);
}

/**
 * The 2026 law's Tavi VI (Article 16) rows in the tavi-6 official-row shape, with the 2026 plan
 * read as the amount. Checks the archived file's hash first. The uncoded headcount and economic
 * breakdown rows come back with no code, so the admin generator never counts them.
 */
export function lawTavi6OfficialRows(): OfficialExpenditureRow[] {
  const sha256 = createHash("sha256").update(readFileSync(BUDGET_LAW_2026.tavi6DocxPath)).digest("hex");
  if (sha256 !== BUDGET_LAW_2026.tavi6Sha256) {
    throw new Error(`Hash mismatch for ${BUDGET_LAW_2026.tavi6DocxPath}: expected ${BUDGET_LAW_2026.tavi6Sha256}, got ${sha256}`);
  }
  const [table] = readDocxTables(BUDGET_LAW_2026.tavi6DocxPath);
  if (!table) throw new Error("Tavi VI has no table.");
  return parseAdminWorkbookRows({
    year: 2026,
    sourceId: BUDGET_LAW_2026.sourceId,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/budget-law-2026/2026-tavi-VI.docx",
    sheetName: "Tavi VI",
    matrix: lawTavi6Matrix(table),
  });
}
