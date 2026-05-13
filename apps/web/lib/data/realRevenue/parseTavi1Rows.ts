import type { OfficialRevenueRow, RevenueMatrixSection } from "./types";

export type MatrixCell = string | number | boolean | null | undefined;

export type ParseTavi1Input = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
};

function cellText(value: MatrixCell): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizedText(value: MatrixCell): string {
  return cellText(value).replace(/\s+/g, " ").toLowerCase();
}

function numericCell(value: MatrixCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value)
    .trim()
    .replace(/\u00a0/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, "");
  const isPercent = normalized.endsWith("%");
  const parsed = Number(isPercent ? normalized.slice(0, -1) : normalized);
  if (!Number.isFinite(parsed)) return null;
  return isPercent ? parsed / 100 : parsed;
}

function findHeaderIndexes(matrix: MatrixCell[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 20); rowIndex += 1) {
    const row = matrix[rowIndex] ?? [];
    const labelIndex = row.findIndex((cell) => normalizedText(cell) === "დასახელება");
    const actualIndex = row.findIndex((cell) => normalizedText(cell).includes("ფაქტ"));
    const executionPercentIndex = row.findIndex((cell) => normalizedText(cell).includes("შესრულება"));
    const approvedPlanIndex = row.findIndex((cell) => normalizedText(cell).includes("დამტკიცებულ"));
    const revisedPlanIndex = row.findIndex((cell) => normalizedText(cell).includes("დაზუსტებულ"));

    if (
      labelIndex >= 0 &&
      actualIndex >= 0 &&
      executionPercentIndex >= 0 &&
      approvedPlanIndex >= 0 &&
      revisedPlanIndex >= 0
    ) {
      return {
        headerRowIndex: rowIndex,
        labelIndex,
        approvedPlanIndex,
        revisedPlanIndex,
        actualIndex,
        executionPercentIndex,
      };
    }
  }

  throw new Error(
    "Could not find tavi 1 header row with დასახელება, დამტკიცებული, დაზუსტებული, and ფაქტი columns",
  );
}

function classifySection(
  labelKa: string,
  currentSection: RevenueMatrixSection | null,
  financingContext: RevenueMatrixSection | null,
): RevenueMatrixSection {
  const label = labelKa.replace(/\s+/g, " ").trim();
  const revenueLabels = new Set([
    "áƒ¨áƒ”áƒ›áƒáƒ¡áƒáƒ•áƒšáƒ”áƒ‘áƒ˜",
    "áƒ’áƒáƒ“áƒáƒ¡áƒáƒ®áƒáƒ“áƒ”áƒ‘áƒ˜",
    "áƒ’áƒ áƒáƒœáƒ¢áƒ”áƒ‘áƒ˜",
    "áƒ¡áƒ®áƒ•áƒ áƒ¨áƒ”áƒ›áƒáƒ¡áƒáƒ•áƒšáƒ”áƒ‘áƒ˜",
    "შემოსავლები",
    "გადასახადები",
    "გრანტები",
    "სხვა შემოსავლები",
    "დამატებული ღირებულების გადასახადი",
    "საშემოსავლო გადასახადი",
    "მოგების გადასახადი",
    "აქციზის გადასახადი",
    "იმპორტის გადასახადი",
    "ქონების გადასახადი",
    "სხვა გადასახადები",
  ]);

  if (label === "შემოსავლები") return "revenues";
  if (label === "ხარჯები") return "expenditures";
  if (label === "არაფინანსური აქტივების ცვლილება") return "non_financial_assets";
  if (label === "ფინანსური აქტივების ცვლილება") return "financial_assets";
  if (label === "ვალდებულებების ცვლილება") return "liabilities";
  if (label === "არაფინანსური აქტივების კლება") return "non_financial_assets";
  if (label === "ფინანსური აქტივების კლება") return "financial_assets";
  if (label === "ვალდებულებების ზრდა") return "liabilities";
  if ((label === "ზრდა" || label === "კლება") && financingContext) return financingContext;
  if (currentSection === "expenditures") return "expenditures";
  if (revenueLabels.has(label)) return "revenues";

  if (
    label === "შემოსავლები" ||
    label === "გადასახადები" ||
    label === "გრანტები" ||
    label === "სხვა შემოსავლები"
  ) {
    return "revenues";
  }

  if (label === "ხარჯები") return "expenditures";

  return "other";
}

export function parseTavi1Rows(input: ParseTavi1Input): OfficialRevenueRow[] {
  const indexes = findHeaderIndexes(input.matrix);
  let currentSection: RevenueMatrixSection | null = null;
  let financingContext: RevenueMatrixSection | null = null;
  const parsedRows: OfficialRevenueRow[] = [];

  for (const [offset, row] of input.matrix.slice(indexes.headerRowIndex + 1).entries()) {
    const labelKa = cellText(row[indexes.labelIndex]);
    if (normalizedText(labelKa) === normalizedText("დასახელება")) break;

    const actualThousandGel = numericCell(row[indexes.actualIndex]);
    if (!labelKa || actualThousandGel === null) continue;

    const section = classifySection(labelKa, currentSection, financingContext);
    if (section === "revenues" || section === "expenditures") currentSection = section;
    if (
      section === "non_financial_assets" ||
      section === "financial_assets" ||
      section === "liabilities"
    ) {
      financingContext = section;
    } else if (section === "revenues" || section === "expenditures") {
      financingContext = null;
    }

    parsedRows.push({
      year: input.year,
      sourceId: input.sourceId,
      workbookPath: input.workbookPath,
      sheetName: input.sheetName,
      rowNumber: indexes.headerRowIndex + offset + 2,
      labelKa,
      section,
      approvedPlanThousandGel: numericCell(row[indexes.approvedPlanIndex]),
      revisedPlanThousandGel: numericCell(row[indexes.revisedPlanIndex]),
      actualThousandGel,
      executionPercent: numericCell(row[indexes.executionPercentIndex]),
    });
  }

  return parsedRows;
}
