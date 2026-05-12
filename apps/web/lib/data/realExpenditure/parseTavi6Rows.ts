import { codeDepth, findLeafCodes, normalizeOfficialCode, parentCodeFor } from "./hierarchy";
import type { OfficialExpenditureRow } from "./types";

export type MatrixCell = string | number | boolean | null | undefined;

export type ParseTavi6Input = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
};

function cellText(value: MatrixCell): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numericCell(value: MatrixCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findHeaderIndexes(matrix: MatrixCell[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 20); rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const codeIndex = row.findIndex((cell) => cellText(cell) === "კოდი");
    const labelIndex = row.findIndex((cell) => cellText(cell).replace(/\s+/g, " ") === "დასახელება");
    const actualIndex = row.findIndex((cell) => cellText(cell).includes("ფაქტი"));

    if (codeIndex >= 0 && labelIndex >= 0 && actualIndex >= 0) {
      return {
        headerRowIndex: rowIndex,
        codeIndex,
        labelIndex,
        approvedPlanIndex: actualIndex - 2,
        revisedPlanIndex: actualIndex - 1,
        actualIndex,
        executionPercentIndex: actualIndex + 1,
      };
    }
  }

  throw new Error("Could not find tavi 6 header row with კოდი, დასახელება, and ფაქტი columns");
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

export function parseTavi6Rows(input: ParseTavi6Input): OfficialExpenditureRow[] {
  const indexes = findHeaderIndexes(input.matrix);
  const preliminary = input.matrix
    .slice(indexes.headerRowIndex + 1)
    .map((row, offset): Omit<OfficialExpenditureRow, "isLeafCode"> | null => {
      const code = normalizeOfficialCode(row[indexes.codeIndex]);
      const labelKa = cellText(row[indexes.labelIndex]);
      const actualThousandGel = numericCell(row[indexes.actualIndex]);

      if (!labelKa || actualThousandGel === null) return null;

      const depth = code ? codeDepth(code) : null;

      return {
        year: input.year,
        sourceId: input.sourceId,
        workbookPath: input.workbookPath,
        sheetName: input.sheetName,
        rowNumber: indexes.headerRowIndex + offset + 2,
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
