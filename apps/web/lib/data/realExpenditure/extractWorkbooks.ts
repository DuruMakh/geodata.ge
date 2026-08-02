import { existsSync } from "node:fs";
import path from "node:path";
import { readWorkbookMatrix } from "../parsing/workbookMatrix";
import { parseTavi6Rows } from "./parseTavi6Rows";
import type { OfficialExpenditureRow, RealExpenditureSource } from "./types";

export const realExpenditureSources: RealExpenditureSource[] = [
  {
    year: 2023,
    sourceId: "source.mof_2023_tavi6_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2023-fact.xlsx",
    preferredSheetNames: ["VI თავი", "tavi 6"],
  },
  {
    year: 2024,
    sourceId: "source.mof_2024_tavi6_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2024-fact.xlsx",
    preferredSheetNames: ["VI თავი", "tavi 6"],
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/2025-fact.xlsx",
    preferredSheetNames: ["tavi 6", "VI თავი"],
  },
];

export function extractOfficialExpenditureRows(warnings?: string[]): OfficialExpenditureRow[] {
  return realExpenditureSources.flatMap((source) => {
    const workbookFile = path.resolve(process.cwd(), source.workbookPath);
    // The revenue twin guards this; this one did not, so a moved or renamed
    // workbook surfaced as a bare ENOENT from deep inside the xlsx reader.
    if (!existsSync(workbookFile)) {
      throw new Error(
        `Missing ${source.year} expenditure workbook: ${source.workbookPath}. ` +
          "Update realExpenditureSources in lib/data/realExpenditure/extractWorkbooks.ts " +
          "if the raw file moved.",
      );
    }

    const { sheetName, matrix } = readWorkbookMatrix(workbookFile, {
      preferredNames: source.preferredSheetNames,
      fallbackPattern: (normalized) => normalized.includes("tavi 6") || normalized.includes("vi თავი"),
      sheetDescription: "tavi 6 sheet",
    });

    return parseTavi6Rows({
      year: source.year,
      sourceId: source.sourceId,
      workbookPath: source.workbookPath.replace("../../", ""),
      sheetName,
      matrix,
      warnings,
    });
  });
}
