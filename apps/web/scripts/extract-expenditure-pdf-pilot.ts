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
import {
  parseTavi6ProgrammaticPdfRows,
  tavi6ProgrammaticPdfTotalActualGel,
} from "../lib/data/realExpenditurePdf/tavi6ProgrammaticPdf";
import { parseLegacyAnnualReportRows } from "../lib/data/realExpenditurePdf/legacyAnnualReportPdf";
import { canonicalizeExpenditurePdfRowLabels } from "../lib/data/realExpenditurePdf/cofogCanonicalLabels";
import {
  expenditureSourcesByYear,
  pickTavi6Sheet,
  repoPath,
  requestedYear,
} from "../lib/data/realExpenditurePdf/expenditureSourcesByYear";



const source = expenditureSourcesByYear[requestedYear()];
const outputFiles = expenditurePdfPhase1OutputFilesForYear(source.year);
const compactMappingOutputFile = expenditurePdfCompactMappingOutputFileForYear(source.year);




async function readWorkbookGrandTotalActualGel(): Promise<number | null> {
  if ("aggregateSupplements" in source) {
    return Math.round(source.aggregateSupplements.paymentsTotalThousandGel * 1000);
  }

  if ("legacyAnnualReport" in source) {
    const workbookPdf = await readPdfTextPages(repoPath(source.workbookPath));
    const rows = parseLegacyAnnualReportRows({
      year: source.year,
      sourceId: source.workbookSourceId,
      workbookPath: source.workbookPath,
      dialect: source.legacyAnnualReport.dialect,
      orgChapterPageRange: source.legacyAnnualReport.orgChapterPageRange,
      officialTotals: source.legacyAnnualReport.officialTotals,
      pages: workbookPdf.pages,
    });
    const totalRow = rows.find((row) => row.isTotal);
    return totalRow ? Math.round(totalRow.actualThousandGel * 1000) : null;
  }

  if (source.workbookPath.endsWith(".pdf")) {
    const workbookPdf = await readPdfTextPages(repoPath(source.workbookPath));
    const pageRange = "workbookPageRange" in source ? source.workbookPageRange : null;
    const rows = parseTavi6ProgrammaticPdfRows({
      year: source.year,
      sourceId: source.workbookSourceId,
      workbookPath: source.workbookPath,
      pages: pageRange ? workbookPdf.pages.slice(pageRange[0] - 1, pageRange[1]) : workbookPdf.pages,
    });
    return tavi6ProgrammaticPdfTotalActualGel(rows);
  }

  const workbook = XLSX.readFile(repoPath(source.workbookPath), { cellDates: false });
  const sheetName = pickTavi6Sheet(workbook, source.year);
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
  const filePath = repoPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const actualSha256 = await sha256File(`../../${source.sourceFile}`);
  if (actualSha256 !== source.sourceSha256) {
    throw new Error(`Source PDF hash mismatch. Expected ${source.sourceSha256}, got ${actualSha256}`);
  }

  const pdf = await readPdfTextPages(repoPath(source.sourceFile));
  const parsedRows = parseExpenditurePdfText({
    ...source,
    pages: pdf.pages,
  });
  const canonicalLabels =
    ("legacyEncodedLabels" in source && source.legacyEncodedLabels === true) ||
    ("canonicalizeLabels" in source && source.canonicalizeLabels === true);
  const rows = canonicalLabels ? canonicalizeExpenditurePdfRowLabels(parsedRows) : parsedRows;
  const extractionReport = buildExpenditurePdfExtractionReport({
    source,
    rows,
    pageCount: pdf.pageCount,
    tableExtractionAttempt: pdf.tableExtractionAttempt,
  });
  const workbookComparisonReport = buildWorkbookComparisonReport({
    pdfRows: rows,
    // Diagnostic-only: years whose configured workbook has no parseable
    // tavi-6 shape fall back to a "skipped" comparison instead of failing.
    workbookGrandTotalActualGel: await readWorkbookGrandTotalActualGel().catch(() => null),
  });
  const compactMappings = generateCompactPdfSpendingMappings(rows);
  const compactMappingValidation = validateCompactPdfSpendingMappings(rows, compactMappings);

  await mkdir(path.dirname(repoPath(outputFiles.stagingCsv)), { recursive: true });
  await writeFile(repoPath(outputFiles.stagingCsv), expenditurePdfRowsToCsv(rows), "utf8");
  await mkdir(path.dirname(repoPath(compactMappingOutputFile)), { recursive: true });
  await writeFile(repoPath(compactMappingOutputFile), pdfSpendingMappingsToCsv(compactMappings), "utf8");
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
