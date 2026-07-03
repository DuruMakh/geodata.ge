import path from "node:path";
import * as XLSX from "xlsx";
import { pickSheetName } from "../parsing/cellUtils";
import { parseTavi6Rows } from "./parseTavi6Rows";
import type { MatrixCell } from "./parseTavi6Rows";
import type { OfficialExpenditureRow, RealExpenditureSource } from "./types";

export const realExpenditureSources: RealExpenditureSource[] = [
  {
    year: 2023,
    sourceId: "source.mof_2023_tavi6_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/2023 12 tve saitistvis.xls",
    preferredSheetNames: ["VI თავი", "tavi 6"],
  },
  {
    year: 2024,
    sourceId: "source.mof_2024_tavi6_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/2024 12 თვე საიტისთვის.xlsx",
    preferredSheetNames: ["VI თავი", "tavi 6"],
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/2025.xlsx",
    preferredSheetNames: ["tavi 6", "VI თავი"],
  },
];

export function extractOfficialExpenditureRows(warnings?: string[]): OfficialExpenditureRow[] {
  return realExpenditureSources.flatMap((source) => {
    const workbookFile = path.resolve(process.cwd(), source.workbookPath);
    const workbook = XLSX.readFile(workbookFile, { cellDates: false });
    const sheetName = pickSheetName(workbook, {
      preferredNames: source.preferredSheetNames,
      fallbackPattern: (normalized) => normalized.includes("tavi 6") || normalized.includes("vi თავი"),
      sheetDescription: "tavi 6 sheet",
    });
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) throw new Error(`Missing sheet after selection: ${sheetName}`);

    const matrix = XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true,
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
