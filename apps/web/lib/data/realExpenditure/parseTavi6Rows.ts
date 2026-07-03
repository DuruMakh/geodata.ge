import { cellText, numericCell, type MatrixCell } from "../parsing/cellUtils";
import { contextFor } from "../parsing/hierarchyContext";
import { codeDepth, findLeafCodes, normalizeOfficialCode, parentCodeFor } from "./hierarchy";
import type { OfficialExpenditureRow } from "./types";

export type { MatrixCell };

export type ParseTavi6Input = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
  /** Optional collector for human-readable warnings about dropped content-bearing rows. */
  warnings?: string[];
};

type HeaderColumn = "approved plan" | "revised plan" | "actual" | "execution percent";

const HEADER_COLUMN_KEYWORDS: Record<HeaderColumn, { expected: string[]; conflicts: string[] }> = {
  "approved plan": { expected: ["დამტკიცებული"], conflicts: ["დაზუსტებული", "შესრულება"] },
  "revised plan": { expected: ["დაზუსტებული"], conflicts: ["დამტკიცებული", "შესრულება"] },
  actual: { expected: ["ფაქტი"], conflicts: ["დამტკიცებული", "დაზუსტებული"] },
  // The percent column is allowed to contain other text (some sheets have no percent column
  // and the assumed offset lands on an unrelated or empty cell), but a plan keyword there
  // means the assumed column order is wrong.
  "execution percent": { expected: ["შესრულება", "%"], conflicts: ["დამტკიცებული", "დაზუსტებული"] },
};

/**
 * The parser assumes fixed offsets around the "actual" column (approved = actual - 2,
 * revised = actual - 1, percent = actual + 1). When the sheet has a header row, verify
 * the assumption: a cell that carries a *different* known Georgian column keyword than
 * the one assumed for its position means the columns are ordered differently, and we
 * must fail loudly instead of extracting numbers from the wrong columns. Cells without
 * any known keyword (blank, English, or year-only headers) are tolerated because many
 * historical sheets label columns that way.
 */
function validateHeaderOffsets(headerRow: MatrixCell[], indexes: Record<HeaderColumn, number>) {
  for (const [column, index] of Object.entries(indexes) as Array<[HeaderColumn, number]>) {
    if (index < 0) continue;
    const text = cellText(headerRow[index]);
    const { expected, conflicts } = HEADER_COLUMN_KEYWORDS[column];
    if (expected.some((keyword) => text.includes(keyword))) continue;
    const conflict = conflicts.find((keyword) => text.includes(keyword));
    if (conflict) {
      throw new Error(
        `Tavi 6 header column mismatch: expected the ${column} column (index ${index}) to contain ` +
          `"${expected.join('" or "')}", but the header cell reads "${text}" (contains "${conflict}"). ` +
          "The sheet's column order differs from the assumed layout.",
      );
    }
  }
}

function findHeaderIndexes(matrix: MatrixCell[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 20); rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const codeIndex = row.findIndex((cell) => cellText(cell) === "კოდი");
    const labelIndex = row.findIndex((cell) => cellText(cell).replace(/\s+/g, " ") === "დასახელება");
    const actualIndex = row.findIndex((cell) => cellText(cell).includes("ფაქტი"));

    if (codeIndex >= 0 && labelIndex >= 0 && actualIndex >= 0) {
      const indexes = {
        headerRowIndex: rowIndex,
        codeIndex,
        labelIndex,
        approvedPlanIndex: actualIndex - 2,
        revisedPlanIndex: actualIndex - 1,
        actualIndex,
        executionPercentIndex: actualIndex + 1,
      };

      validateHeaderOffsets(row, {
        "approved plan": indexes.approvedPlanIndex,
        "revised plan": indexes.revisedPlanIndex,
        actual: indexes.actualIndex,
        "execution percent": indexes.executionPercentIndex,
      });

      return indexes;
    }
  }

  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 30); rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const codeIndex = row.findIndex((cell) => normalizeOfficialCode(cell) === "00 00");
    if (codeIndex < 0) continue;

    const labelIndex = codeIndex + 1;
    const indexes = {
      headerRowIndex: rowIndex - 1,
      codeIndex,
      labelIndex,
      approvedPlanIndex: labelIndex + 1,
      revisedPlanIndex: labelIndex + 2,
      actualIndex: labelIndex + 3,
      executionPercentIndex: labelIndex + 4,
    };

    if (indexes.headerRowIndex >= 0) {
      validateHeaderOffsets(matrix[indexes.headerRowIndex] ?? [], {
        "approved plan": indexes.approvedPlanIndex,
        "revised plan": indexes.revisedPlanIndex,
        actual: indexes.actualIndex,
        "execution percent": indexes.executionPercentIndex,
      });
    }

    return indexes;
  }

  throw new Error("Could not find tavi 6 header row or 00 00 total row.");
}

export function parseTavi6Rows(input: ParseTavi6Input): OfficialExpenditureRow[] {
  const indexes = findHeaderIndexes(input.matrix);
  const preliminary = input.matrix
    .slice(indexes.headerRowIndex + 1)
    .map((row, offset): Omit<OfficialExpenditureRow, "isLeafCode"> | null => {
      const rowNumber = indexes.headerRowIndex + offset + 2;
      const code = normalizeOfficialCode(row[indexes.codeIndex]);
      const labelKa = cellText(row[indexes.labelIndex]);
      const actualThousandGel = numericCell(row[indexes.actualIndex]);

      if (!labelKa || actualThousandGel === null) {
        // Only warn about rows that carry numeric content (or a code without a label).
        // Label-only rows are normal sheet structure: section notes, merged multi-line
        // detail labels, and repeated page headers.
        const approved = numericCell(row[indexes.approvedPlanIndex]);
        const revised = numericCell(row[indexes.revisedPlanIndex]);
        const hasAmount = approved !== null || revised !== null || actualThousandGel !== null;

        if (hasAmount || (code && !labelKa)) {
          const why = !labelKa ? "row has content but no label" : "row has a label and plan amounts but no actual amount";
          input.warnings?.push(
            `year ${input.year}, sheet "${input.sheetName}", row ${rowNumber} (${input.workbookPath}): ` +
              `dropped row — ${why}; code=${code ?? "-"}, label="${labelKa}", ` +
              `approved=${approved ?? "-"}, revised=${revised ?? "-"}, actual=${actualThousandGel ?? "-"}`,
          );
        }

        return null;
      }

      const depth = code ? codeDepth(code) : null;

      return {
        year: input.year,
        sourceId: input.sourceId,
        workbookPath: input.workbookPath,
        sheetName: input.sheetName,
        rowNumber,
        code,
        parentCode: code ? parentCodeFor(code) : null,
        depth,
        institutionCode: null,
        institutionLabelKa: null,
        programCode: null,
        programLabelKa: null,
        subprogramCode: null,
        subprogramLabelKa: null,
        isTotal: code === "00 00",
        isCodedRow: Boolean(code),
        labelKa,
        approvedPlanThousandGel: numericCell(row[indexes.approvedPlanIndex]),
        revisedPlanThousandGel: numericCell(row[indexes.revisedPlanIndex]),
        actualThousandGel,
        executionPercent: numericCell(row[indexes.executionPercentIndex]),
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
