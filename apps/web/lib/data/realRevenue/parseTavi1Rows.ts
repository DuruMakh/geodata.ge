import { cellText, numericCell, type MatrixCell } from "../parsing/cellUtils";
import type { OfficialRevenueRow, RevenueMatrixSection } from "./types";

export type { MatrixCell };

export type ParseTavi1Input = {
  year: number;
  sourceId: string;
  workbookPath: string;
  sheetName: string;
  matrix: MatrixCell[][];
  /** Optional collector for human-readable warnings about dropped or unclassifiable rows. */
  warnings?: string[];
};

function normalizedText(value: MatrixCell): string {
  return cellText(value).replace(/\s+/g, " ").toLowerCase();
}

function amountCell(value: MatrixCell): number | null {
  return numericCell(value, { stripWhitespace: true, percentMode: "fraction" });
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

  return "other";
}

export function parseTavi1Rows(input: ParseTavi1Input): OfficialRevenueRow[] {
  const indexes = findHeaderIndexes(input.matrix);
  let currentSection: RevenueMatrixSection | null = null;
  let financingContext: RevenueMatrixSection | null = null;
  const parsedRows: OfficialRevenueRow[] = [];

  for (const [offset, row] of input.matrix.slice(indexes.headerRowIndex + 1).entries()) {
    const rowNumber = indexes.headerRowIndex + offset + 2;
    const labelKa = cellText(row[indexes.labelIndex]);
    if (normalizedText(labelKa) === normalizedText("დასახელება")) break;

    const actualThousandGel = amountCell(row[indexes.actualIndex]);
    if (!labelKa || actualThousandGel === null) {
      // Only warn about rows that carry numeric amounts; label-only rows (section
      // headings without figures) and blank separator rows are normal structure.
      const approved = amountCell(row[indexes.approvedPlanIndex]);
      const revised = amountCell(row[indexes.revisedPlanIndex]);

      if (approved !== null || revised !== null || actualThousandGel !== null) {
        const why = !labelKa ? "row has amounts but no label" : "row has a label and plan amounts but no actual amount";
        input.warnings?.push(
          `year ${input.year}, sheet "${input.sheetName}", row ${rowNumber} (${input.workbookPath}): ` +
            `dropped row — ${why}; label="${labelKa}", ` +
            `approved=${approved ?? "-"}, revised=${revised ?? "-"}, actual=${actualThousandGel ?? "-"}`,
        );
      }

      continue;
    }

    const section = classifySection(labelKa, currentSection, financingContext);
    if (section === "other") {
      input.warnings?.push(
        `year ${input.year}, sheet "${input.sheetName}", row ${rowNumber} (${input.workbookPath}): ` +
          `label "${labelKa}" with amounts could not be classified into a known section (kept as "other")`,
      );
    }
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
      rowNumber,
      labelKa,
      section,
      approvedPlanThousandGel: amountCell(row[indexes.approvedPlanIndex]),
      revisedPlanThousandGel: amountCell(row[indexes.revisedPlanIndex]),
      actualThousandGel,
      executionPercent: amountCell(row[indexes.executionPercentIndex]),
    });
  }

  return parsedRows;
}
