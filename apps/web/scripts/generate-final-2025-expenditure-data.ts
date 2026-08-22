import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { generateCandidateMappings } from "../lib/data/realExpenditure/candidateMapping";
import { parseAdminWorkbookRows } from "../lib/data/adminSpending/extractWorkbooks";
import type { MatrixCell } from "../lib/data/realExpenditure/parseTavi6Rows";
import {
  composeFinalExpenditureFacts,
  extractFinancialAssetAndLiabilitySupplements,
  final2025ExpenditureFactsToCsv,
  final2025SupplementsToCsv,
  finalExpenditureOutputFiles,
  type SupplementMapping,
  type WorkbookStagingRow,
} from "../lib/data/realExpenditurePdf/final2025Data";
import {
  generateCompactPdfSpendingMappings,
  validateCompactPdfSpendingMappings,
} from "../lib/data/realExpenditurePdf/publicMapping";
import { parseExpenditurePdfText, readPdfTextPages, sha256File } from "../lib/data/realExpenditurePdf/phase1Pilot";
import { parseTavi6ProgrammaticPdfRows } from "../lib/data/realExpenditurePdf/tavi6ProgrammaticPdf";
import {
  buildAggregateSupplementWorkbookRows,
  parseLegacyAnnualReportRows,
} from "../lib/data/realExpenditurePdf/legacyAnnualReportPdf";
import { canonicalizeExpenditurePdfRowLabels } from "../lib/data/realExpenditurePdf/cofogCanonicalLabels";
import {
  expenditureSourcesByYear,
  pickTavi6Sheet,
  repoPath,
  requestedYear,
} from "../lib/data/realExpenditurePdf/expenditureSourcesByYear";


type ReviewMappingCsvRow = {
  year: string;
  code: string;
  label_ka: string;
  actual_gel: string;
  mapping_confidence: "high" | "medium" | "low" | "unclassified";
  reviewed_public_spending_field_id: string;
  review_notes: string;
};

type SpendingField = {
  id: string;
  side: string;
};


const source = expenditureSourcesByYear[requestedYear()];
const outputFiles = finalExpenditureOutputFiles(source.year);



async function readCsv<T>(relativePath: string): Promise<T[]> {
  const text = await readFile(repoPath(relativePath), "utf8");
  return parse(text, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as T[];
}

async function readWorkbookRows(): Promise<ReturnType<typeof parseAdminWorkbookRows>> {
  if ("legacyAnnualReport" in source) {
    const workbookPdf = await readPdfTextPages(repoPath(source.workbookPath));
    return parseLegacyAnnualReportRows({
      year: source.year,
      sourceId: source.workbookSourceId,
      workbookPath: source.workbookPath,
      dialect: source.legacyAnnualReport.dialect,
      orgChapterPageRange: source.legacyAnnualReport.orgChapterPageRange,
      officialTotals: source.legacyAnnualReport.officialTotals,
      pages: workbookPdf.pages,
    });
  }

  if ("aggregateSupplements" in source) {
    return buildAggregateSupplementWorkbookRows({
      year: source.year,
      sourceId: source.workbookSourceId,
      workbookPath: source.workbookPath,
      paymentsTotalThousandGel: source.aggregateSupplements.paymentsTotalThousandGel,
      items: source.aggregateSupplements.items,
    });
  }

  if (source.workbookPath.endsWith(".pdf")) {
    const workbookPdf = await readPdfTextPages(repoPath(source.workbookPath));
    const pageRange = "workbookPageRange" in source ? source.workbookPageRange : null;
    return parseTavi6ProgrammaticPdfRows({
      year: source.year,
      sourceId: source.workbookSourceId,
      workbookPath: source.workbookPath,
      pages: pageRange ? workbookPdf.pages.slice(pageRange[0] - 1, pageRange[1]) : workbookPdf.pages,
    });
  }

  const workbook = XLSX.read(readFileSync(repoPath(source.workbookPath)), { type: "buffer", cellDates: false });
  const sheetName = pickTavi6Sheet(workbook, source.year);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing selected workbook sheet: ${sheetName}`);

  const matrix = XLSX.utils.sheet_to_json<MatrixCell[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });

  return parseAdminWorkbookRows({
    year: source.year,
    sourceId: source.workbookSourceId,
    workbookPath: source.workbookPath,
    sheetName,
    matrix,
  });
}

function workbookRowsToSupplementRows(rows: ReturnType<typeof parseAdminWorkbookRows>): WorkbookStagingRow[] {
  return rows.map((row) => ({
    year: row.year,
    sourceId: row.sourceId,
    code: row.code,
    isCodedRow: row.isCodedRow,
    isLeafCode: row.isLeafCode,
    labelKa: row.labelKa,
    actualGel: Math.round(row.actualThousandGel * 1000),
  }));
}

function mappingsByCode(rows: ReviewMappingCsvRow[]): Map<string, SupplementMapping> {
  return new Map(
    rows
      .filter((row) => row.year === String(source.year) && row.reviewed_public_spending_field_id)
      .map((row) => [
        row.code,
        {
          publicSpendingFieldId: row.reviewed_public_spending_field_id,
          mappingConfidence: row.mapping_confidence,
          labelKa: row.label_ka,
          mappingNotes: row.review_notes,
        },
      ]),
  );
}

function reviewedMappingsByLabel(rows: ReviewMappingCsvRow[]): Map<string, SupplementMapping> {
  const mappings = new Map<string, SupplementMapping>();

  for (const row of rows.filter(
    (candidate) =>
      candidate.reviewed_public_spending_field_id &&
      candidate.reviewed_public_spending_field_id !== "spending.other_unclassified",
  )) {
    if (mappings.has(row.label_ka)) continue;
    mappings.set(row.label_ka, {
      publicSpendingFieldId: row.reviewed_public_spending_field_id,
      mappingConfidence: row.mapping_confidence,
      labelKa: row.label_ka,
      mappingNotes: `Propagated from reviewed 2023-2025 row by exact Georgian label match: ${row.review_notes}`,
    });
  }

  return mappings;
}

function supplementMappingsByCode(input: {
  reviewRows: ReviewMappingCsvRow[];
  workbookRows: ReturnType<typeof parseAdminWorkbookRows>;
}): Map<string, SupplementMapping> {
  const mappings = mappingsByCode(input.reviewRows);
  const mappingsByLabel = reviewedMappingsByLabel(input.reviewRows);

  for (const row of generateCandidateMappings(input.workbookRows)) {
    if (mappings.has(row.code)) continue;
    const reviewedMapping = mappingsByLabel.get(row.labelKa);
    if (reviewedMapping) {
      mappings.set(row.code, reviewedMapping);
      continue;
    }
    mappings.set(row.code, {
      publicSpendingFieldId: row.suggestedPublicSpendingFieldId,
      mappingConfidence: row.mappingConfidence,
      labelKa: row.labelKa,
      mappingNotes: `Generated older-year supplement mapping candidate: ${row.mappingReason}`,
    });
  }

  return mappings;
}

async function loadSpendingFieldIds(): Promise<string[]> {
  const content = await readFile(repoPath("data/taxonomy/spending-fields.json"), "utf8");
  const fields = JSON.parse(content) as SpendingField[];
  return fields.filter((field) => field.side === "expenditure").map((field) => field.id);
}

function workbookTotalGelFromParsedRows(rows: ReturnType<typeof parseAdminWorkbookRows>): number {
  const totalRow = rows.find((row) => row.isTotal && row.code === "00 00");
  if (totalRow) return Math.round(totalRow.actualThousandGel * 1000);

  const topLevelRows = rows.filter((row) => row.code && !row.parentCode);
  if (topLevelRows.length > 0) {
    return Math.round(topLevelRows.reduce((sum, row) => sum + row.actualThousandGel * 1000, 0));
  }

  throw new Error(`Could not infer ${source.year} workbook total from raw workbook.`);
}

async function writeText(relativePath: string, content: string): Promise<void> {
  const filePath = repoPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function main() {
  const actualSha256 = await sha256File(`../../${source.sourceFile}`);
  if (actualSha256 !== source.sourceSha256) {
    throw new Error(`Source PDF hash mismatch. Expected ${source.sourceSha256}, got ${actualSha256}`);
  }

  const pdf = await readPdfTextPages(repoPath(source.sourceFile));
  const parsedPdfRows = parseExpenditurePdfText({
    ...source,
    pages: pdf.pages,
  });
  const canonicalLabels =
    ("legacyEncodedLabels" in source && source.legacyEncodedLabels === true) ||
    ("canonicalizeLabels" in source && source.canonicalizeLabels === true);
  const pdfRows = canonicalLabels ? canonicalizeExpenditurePdfRowLabels(parsedPdfRows) : parsedPdfRows;
  const pdfMappings = generateCompactPdfSpendingMappings(pdfRows);
  const pdfValidation = validateCompactPdfSpendingMappings(pdfRows, pdfMappings);

  if (pdfValidation.status === "failed") {
    throw new Error(
      `PDF mapping validation failed: mapped ${pdfValidation.mappedTotalActualGel}, grand total ${pdfValidation.grandTotalActualGel}`,
    );
  }

  const reviewMappingRows = await readCsv<ReviewMappingCsvRow>(
    "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
  );
  const workbookRows = await readWorkbookRows();
  const supplementMappings = supplementMappingsByCode({
    reviewRows: reviewMappingRows,
    workbookRows,
  });
  const supplements = extractFinancialAssetAndLiabilitySupplements({
    rows: workbookRowsToSupplementRows(workbookRows),
    mappingsByCode: supplementMappings,
  });
  const generatedSupplementMappingRows = supplements.filter((row) =>
    row.mappingNotes.startsWith("Generated older-year supplement mapping candidate:"),
  ).length;
  const result = composeFinalExpenditureFacts({
    year: source.year,
    finalSourceId: source.finalSourceId,
    sourceFiles: [
      source.sourceFile,
      source.workbookPath,
      "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
      ...(generatedSupplementMappingRows > 0 ? ["apps/web/lib/data/realExpenditure/candidateMapping.ts"] : []),
    ],
    pdfMappings,
    supplements,
    spendingFieldIds: await loadSpendingFieldIds(),
    workbookTotalGel: workbookTotalGelFromParsedRows(workbookRows),
  });

  if (generatedSupplementMappingRows > 0) {
    result.report.notes.push(
      `${generatedSupplementMappingRows} workbook supplement rows used generated older-year mapping candidates where no reviewed 2023-2025 code mapping existed.`,
    );
  }
  if (result.report.differenceGel > 1000) {
    result.report.notes.push(
      `Final reconciliation failed tolerance: final total differs from workbook total by ${result.report.differenceGel} GEL.`,
    );
  }

  await writeText(outputFiles.factsCsv, final2025ExpenditureFactsToCsv(result.facts));
  await writeText(outputFiles.supplementCsv, final2025SupplementsToCsv(supplements));
  await writeText(outputFiles.reportJson, `${JSON.stringify(result.report, null, 2)}\n`);

  if (result.report.differenceGel > 1000) {
    throw new Error(`Final ${source.year} data reconciliation failed by ${result.report.differenceGel} GEL`);
  }

  console.log(`Final ${source.year} expenditure rows: ${result.facts.length}`);
  console.log(`PDF mapped total GEL: ${result.report.pdfMappedTotalGel}`);
  console.log(`Supplement total GEL: ${result.report.supplementTotalGel}`);
  console.log(`Final total GEL: ${result.report.finalTotalGel}`);
  console.log(`Workbook total GEL: ${result.report.workbookTotalGel}`);
  console.log(`Facts CSV: ${outputFiles.factsCsv}`);
  console.log(`Supplement CSV: ${outputFiles.supplementCsv}`);
  console.log(`Report JSON: ${outputFiles.reportJson}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
