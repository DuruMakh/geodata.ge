import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import { parseTavi1Rows, type MatrixCell } from "./parseTavi1Rows";
import { parseTreasuryPdfRows } from "./parseTreasuryPdfRows";
import type { OfficialRevenueRow, RealRevenuePdfSource, RealRevenueSource } from "./types";

export const realRevenueSources: RealRevenueSource[] = [
  {
    year: 2023,
    sourceId: "source.mof_2023_tavi1_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/2023 12 tve saitistvis.xls",
    preferredSheetNames: ["ბალანსი"],
  },
  {
    year: 2024,
    sourceId: "source.mof_2024_tavi1_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/2024 12 თვე საიტისთვის.xlsx",
    preferredSheetNames: ["I თავი"],
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi1_actual",
    workbookPath: "../../docs/Raw Data/Expenditure/mof.ge/2025.xlsx",
    preferredSheetNames: ["tavi I", "I თავი"],
  },
];

export const realRevenuePdfSources: RealRevenuePdfSource[] = [
  {
    year: 2023,
    sourceId: "source.mof_2023_revenue_form1_pdf",
    pdfPath: "../../docs/Raw Data/Revenue/2023-jan-dec-consolidated-revenue.pdf",
  },
  {
    year: 2024,
    sourceId: "source.mof_2024_revenue_form1_pdf",
    pdfPath: "../../docs/Raw Data/Revenue/2024-jan-dec-consolidated-revenue.pdf",
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    pdfPath: "../../docs/Raw Data/Revenue/2025-jan-dec-consolidated-revenue.pdf",
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

export function extractOfficialWorkbookRevenueRows(): OfficialRevenueRow[] {
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

async function extractPdfText(pdfFile: string): Promise<string> {
  const data = await readFile(pdfFile);
  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function extractOfficialRevenueRows(): Promise<OfficialRevenueRow[]> {
  const rows: OfficialRevenueRow[] = [];

  for (const source of realRevenuePdfSources) {
    const pdfFile = path.resolve(process.cwd(), source.pdfPath);
    const text = await extractPdfText(pdfFile);
    rows.push(
      ...parseTreasuryPdfRows({
        year: source.year,
        sourceId: source.sourceId,
        pdfPath: source.pdfPath.replace("../../", ""),
        text,
      }),
    );
  }

  return rows;
}
