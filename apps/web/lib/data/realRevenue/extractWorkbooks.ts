import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import { REVENUE_YEARS } from "../coverage";
import { readWorkbookMatrix } from "../parsing/workbookMatrix";
import { parseTavi1Rows } from "./parseTavi1Rows";
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

export const realRevenuePdfSources: RealRevenuePdfSource[] = REVENUE_YEARS.map((year) => ({
  year,
  sourceId: `source.mof_${year}_revenue_form1_pdf`,
  pdfPath: `../../docs/Raw Data/Revenue/${year}-jan-dec-consolidated-revenue.pdf`,
  ...([2005, 2006, 2007, 2015].includes(year) ? { textPath: `../../docs/Raw Data/Revenue/text/${year}-jan-dec-consolidated-revenue.txt` } : {}),
}));

export function extractOfficialWorkbookRevenueRows(warnings?: string[]): OfficialRevenueRow[] {
  return realRevenueSources.flatMap((source) => {
    const workbookFile = path.resolve(process.cwd(), source.workbookPath);
    if (!existsSync(workbookFile)) return [];

    // No fallback pattern here: revenue extraction must only use explicitly reviewed sheets.
    const { sheetName, matrix } = readWorkbookMatrix(workbookFile, {
      preferredNames: source.preferredSheetNames,
      sheetDescription: "revenue sheet",
    });

    return parseTavi1Rows({
      year: source.year,
      sourceId: source.sourceId,
      workbookPath: source.workbookPath.replace("../../", ""),
      sheetName,
      matrix,
      warnings,
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

async function extractRevenueSourceText(source: RealRevenuePdfSource, pdfFile: string): Promise<string> {
  if (source.textPath) {
    return readFile(path.resolve(process.cwd(), source.textPath), "utf8");
  }

  return extractPdfText(pdfFile);
}

export async function extractOfficialRevenueRows(): Promise<OfficialRevenueRow[]> {
  const rows: OfficialRevenueRow[] = [];

  for (const source of realRevenuePdfSources) {
    const pdfFile = path.resolve(process.cwd(), source.pdfPath);
    const text = await extractRevenueSourceText(source, pdfFile);
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
