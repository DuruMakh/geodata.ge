import path from "node:path";
import * as XLSX from "xlsx";
import { parseTavi1Rows, type MatrixCell } from "./parseTavi1Rows";
import type { OfficialRevenueRow, RealRevenueSource } from "./types";

export const realRevenueSources: RealRevenueSource[] = [
  {
    year: 2023,
    sourceId: "source.mof_2023_tavi1_actual",
    workbookPath: "../../docs/Raw Data/2023 12 tve saitistvis.xls",
    preferredSheetNames: ["ბალანსი"],
  },
  {
    year: 2024,
    sourceId: "source.mof_2024_tavi1_actual",
    workbookPath: "../../docs/Raw Data/2024 12 თვე საიტისთვის.xlsx",
    preferredSheetNames: ["I თავი"],
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi1_actual",
    workbookPath: "../../docs/Raw Data/2025.xlsx",
    preferredSheetNames: ["tavi I", "I თავი"],
  },
];

function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickSheetName(workbook: XLSX.WorkBook, preferredNames: string[]): string {
  const availableByNormalized = new Map(workbook.SheetNames.map((name) => [normalizeSheetName(name), name]));

  for (const preferred of preferredNames) {
    const matched = availableByNormalized.get(normalizeSheetName(preferred));
    if (matched) return matched;
  }

  throw new Error(`Could not find revenue sheet. Available sheets: ${workbook.SheetNames.join(", ")}`);
}

export function extractOfficialRevenueRows(): OfficialRevenueRow[] {
  return realRevenueSources.flatMap((source) => {
    const workbookFile = path.resolve(process.cwd(), source.workbookPath);
    const workbook = XLSX.readFile(workbookFile, { cellDates: false });
    const sheetName = pickSheetName(workbook, source.preferredSheetNames);
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) throw new Error(`Missing sheet after selection: ${sheetName}`);

    const matrix = XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true,
    });

    return parseTavi1Rows({
      year: source.year,
      sourceId: source.sourceId,
      workbookPath: source.workbookPath.replace("../../", ""),
      sheetName,
      matrix,
    });
  });
}
