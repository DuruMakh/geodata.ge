import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  buildExpenditurePdfExtractionReport,
  buildWorkbookComparisonReport,
  expenditurePdfPhase1OutputFilesForYear,
  expenditurePdfRowsToCsv,
  parseExpenditurePdfText,
  readPdfTextPages,
  sha256File,
} from "../lib/data/realExpenditurePdf/phase1Pilot";
import {
  expenditurePdfCompactMappingOutputFileForYear,
  generateCompactPdfSpendingMappings,
  pdfSpendingMappingsToCsv,
  validateCompactPdfSpendingMappings,
} from "../lib/data/realExpenditurePdf/publicMapping";
import { parseTavi6Rows } from "../lib/data/realExpenditure/parseTavi6Rows";
import type { MatrixCell } from "../lib/data/realExpenditure/parseTavi6Rows";

const sourcesByYear = {
  2017: {
    year: 2017,
    sourceId: "source.mof_2017_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2017-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "45DCDEBBB40647B8D9E4C57E8D52131B908B49D220B6BBF6F21BFFE3D7FFFF03",
    formId: "E11",
    tableTitle: "2017 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2017-tavi-VI.xlsx",
    workbookSourceId: "source.mof_2017_tavi6_actual",
  },
  2018: {
    year: 2018,
    sourceId: "source.mof_2018_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2018-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "F45968C139D9EA89D396BA1B1196D62A97CEBF50FE35201277048E6446F8AA94",
    formId: "E11",
    tableTitle: "2018 state budget expenditure execution by functional classification",
    actualAmountIndex: 3,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2018-tavi-VI.xlsx",
    workbookSourceId: "source.mof_2018_tavi6_actual",
  },
  2019: {
    year: 2019,
    sourceId: "source.mof_2019_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2019-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "F0CBF895AA90510F48AA3DD6C04DC85F75F84736E116DCB81530D0EC5377D192",
    formId: "E11",
    tableTitle: "2019 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2019-tavi-VI.xlsx",
    workbookSourceId: "source.mof_2019_tavi6_actual",
  },
  2020: {
    year: 2020,
    sourceId: "source.mof_2020_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2020-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "01655B1F93B62FC0B7B13FB38EFE4E1D6C0AFA3BBCEC3BE8930295F5E4191916",
    formId: "E11",
    tableTitle: "2020 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2020-tavi-VI.xlsx",
    workbookSourceId: "source.mof_2020_tavi6_actual",
  },
  2021: {
    year: 2021,
    sourceId: "source.mof_2021_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2021-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "1135A9CD12B356D159C3C6AD623AA2369E594FA5AD6F94B8FAA1C024BC76EA9D",
    formId: "E11",
    tableTitle: "2021 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2021-tavi-VI.xlsx",
    workbookSourceId: "source.mof_2021_tavi6_actual",
  },
  2022: {
    year: 2022,
    sourceId: "source.mof_2022_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2022-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "07E7F03F44F81CC203B71B003F223B0A359E71E226B618A88F2D648FD35084F5",
    formId: "E11",
    tableTitle: "2022 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2022 redaqtirenadi 12 Tve.xls",
    workbookSourceId: "source.mof_2022_tavi6_actual",
  },
  2023: {
    year: 2023,
    sourceId: "source.mof_2023_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2023-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "C20E1BF832E964C48F62461F0C9AF92274ECA7C54A93A735D1442698013A7330",
    formId: "E11",
    tableTitle: "2023 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2023 12 tve saitistvis.xls",
    workbookSourceId: "source.mof_2023_tavi6_actual",
  },
  2024: {
    year: 2024,
    sourceId: "source.mof_2024_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2024-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "DAA2BD22D7F0A43BF7738EA288FA159BB43C3F6F7228D3A9B4CADEB7835BCEC3",
    formId: "E11",
    tableTitle: "2024 state budget expenditure execution by functional classification",
    actualAmountIndex: 1,
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2024 12 თვე საიტისთვის.xlsx",
    workbookSourceId: "source.mof_2024_tavi6_actual",
  },
  2025: {
    year: 2025,
    sourceId: "source.mof_2025_expenditure_pdf_form_e11_actual",
    sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf",
    sourceSha256: "1B680A253394C689703BE0279F41860AFEB6EF8D6791D5E42F5BE8C70FF39EAD",
    formId: "E11",
    tableTitle: "2025 state budget expenditure execution by functional classification",
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2025.xlsx",
    workbookSourceId: "source.mof_2025_tavi6_actual",
  },
} as const;

type ExpenditureSourceYear = keyof typeof sourcesByYear;

function requestedYear(): ExpenditureSourceYear {
  const yearFlagIndex = process.argv.indexOf("--year");
  const rawYear = yearFlagIndex >= 0 ? process.argv[yearFlagIndex + 1] : process.argv[2];
  const year = rawYear ? Number(rawYear) : 2025;
  if (!(year in sourcesByYear)) throw new Error(`Unsupported expenditure PDF year: ${rawYear}`);
  return year as ExpenditureSourceYear;
}

const source = sourcesByYear[requestedYear()];
const outputFiles = expenditurePdfPhase1OutputFilesForYear(source.year);
const compactMappingOutputFile = expenditurePdfCompactMappingOutputFileForYear(source.year);

function repoPath(relativePath: string): string {
  return path.resolve(process.cwd(), "../..", relativePath);
}

function outputPath(relativePath: string): string {
  return repoPath(relativePath);
}

function pickTavi6Sheet(workbook: XLSX.WorkBook): string {
  const sheetName =
    workbook.SheetNames.find((name) => {
      const normalized = name.trim().toLowerCase();
      return normalized.includes("tavi 6") || normalized.includes("vi თავი");
    }) ?? workbook.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets for diagnostic comparison.");
  return sheetName;
}

function readWorkbookGrandTotalActualGel(): number | null {
  const workbook = XLSX.readFile(repoPath(source.workbookPath), { cellDates: false });
  const sheetName = pickTavi6Sheet(workbook);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;

  const matrix = XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });
  const rows = parseTavi6Rows({
    year: source.year,
    sourceId: source.workbookSourceId,
    workbookPath: source.workbookPath,
    sheetName,
    matrix,
  });
  const totalRow = rows.find((row) => row.isTotal);

  return totalRow ? Math.round(totalRow.actualThousandGel * 1000) : null;
}

async function writeJson(relativePath: string, value: unknown) {
  const filePath = outputPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const actualSha256 = await sha256File(`../../${source.sourceFile}`);
  if (actualSha256 !== source.sourceSha256) {
    throw new Error(`Source PDF hash mismatch. Expected ${source.sourceSha256}, got ${actualSha256}`);
  }

  const pdf = await readPdfTextPages(repoPath(source.sourceFile));
  const rows = parseExpenditurePdfText({
    ...source,
    pages: pdf.pages,
  });
  const extractionReport = buildExpenditurePdfExtractionReport({
    source,
    rows,
    pageCount: pdf.pageCount,
    tableExtractionAttempt: pdf.tableExtractionAttempt,
  });
  const workbookComparisonReport = buildWorkbookComparisonReport({
    pdfRows: rows,
    workbookGrandTotalActualGel: readWorkbookGrandTotalActualGel(),
  });
  const compactMappings = generateCompactPdfSpendingMappings(rows);
  const compactMappingValidation = validateCompactPdfSpendingMappings(rows, compactMappings);

  await mkdir(path.dirname(outputPath(outputFiles.stagingCsv)), { recursive: true });
  await writeFile(outputPath(outputFiles.stagingCsv), expenditurePdfRowsToCsv(rows), "utf8");
  await mkdir(path.dirname(outputPath(compactMappingOutputFile)), { recursive: true });
  await writeFile(outputPath(compactMappingOutputFile), pdfSpendingMappingsToCsv(compactMappings), "utf8");
  await writeJson(outputFiles.extractionReport, extractionReport);
  await writeJson(outputFiles.workbookComparisonReport, workbookComparisonReport);

  if (extractionReport.validation.status === "failed") {
    throw new Error(`PDF extraction validation failed: ${extractionReport.validation.failedChecks.join(", ")}`);
  }
  if (compactMappingValidation.status === "failed") {
    throw new Error(
      `PDF compact mapping validation failed: mapped ${compactMappingValidation.mappedTotalActualGel}, grand total ${compactMappingValidation.grandTotalActualGel}`,
    );
  }

  console.log(`PDF pilot rows: ${rows.length}`);
  console.log(`Compact mapped rows: ${compactMappings.length}`);
  console.log(`Extraction report: ${outputFiles.extractionReport}`);
  console.log(`Workbook comparison report: ${outputFiles.workbookComparisonReport}`);
  console.log(`Compact mapping CSV: ${compactMappingOutputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
