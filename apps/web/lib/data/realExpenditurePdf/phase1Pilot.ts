import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

export function expenditurePdfPhase1OutputFilesForYear(year: number) {
  return {
    stagingCsv: `data/staging/expenditure-pdf-official-rows-${year}-pilot.csv`,
    extractionReport: `data/reports/expenditure-pdf-extraction-report-${year}-pilot.json`,
    workbookComparisonReport: `data/reports/expenditure-pdf-vs-workbook-${year}-pilot-report.json`,
  } as const;
}

export const expenditurePdfPhase1OutputFiles = expenditurePdfPhase1OutputFilesForYear(2025);

export type ExpenditurePdfSource = {
  year: number;
  sourceId: string;
  sourceFile: string;
  sourceSha256: string;
  formId: string;
  tableTitle: string;
  actualAmountIndex?: number;
};

export type ExpenditurePdfPageText = {
  pageNumber: number;
  text: string;
};

export type ExpenditurePdfRowType = "grand_total" | "functional_total";
export type ExpenditurePdfIdentityConfidence = "official_code" | "fallback";

export type ExpenditurePdfOfficialRow = {
  sourceId: string;
  sourceFile: string;
  year: number;
  formId: string;
  tableTitle: string;
  pageNumber: number;
  tableIndex: number;
  rowIndex: number;
  rowId: string;
  rowType: ExpenditurePdfRowType;
  includeInPublicMapping: boolean;
  identityConfidence: ExpenditurePdfIdentityConfidence;
  functionalCode: string | null;
  economicCode: string;
  hierarchyPath: string;
  labelKa: string;
  approvedPlanRaw: string | null;
  approvedPlanThousandGel: number | null;
  approvedPlanGel: number | null;
  revisedPlanRaw: string | null;
  revisedPlanThousandGel: number | null;
  revisedPlanGel: number | null;
  actualRaw: string;
  actualThousandGel: number;
  actualGel: number;
  annualObligationRaw: string | null;
  annualObligationThousandGel: number | null;
  annualObligationGel: number | null;
  yearResourceRaw: string | null;
  yearResourceThousandGel: number | null;
  yearResourceGel: number | null;
  sourceUnit: "gel";
  rawRowText: string;
};

export type ExpenditurePdfValidationReport = {
  status: "passed" | "failed";
  toleranceGel: number;
  grandTotalActualGel: number;
  topFunctionalTotalActualGel: number;
  rowCount: number;
  functionalTotalRowCount: number;
  includeInPublicMappingRowCount: number;
  failedChecks: string[];
  checks: Array<{
    name: string;
    expectedGel: number;
    actualGel: number;
    differenceGel: number;
    status: "passed" | "failed";
  }>;
};

export type ExpenditurePdfExtractionReport = {
  source: ExpenditurePdfSource;
  boundary: {
    formId: string;
    tableTitle: string;
    pageStart: number;
    pageEnd: number;
  };
  tableExtractionAttempt: {
    attempted: boolean;
    extractedTables: number;
    selectedMethod: "table" | "text_fallback";
  };
  sourceUnit: "gel";
  acceptedMonetaryColumns: string[];
  acceptedRateColumns: string[];
  excludedBreakdownCodes: string[];
  rowCounts: {
    totalRows: number;
    grandTotalRows: number;
    functionalTotalRows: number;
    includeInPublicMappingRows: number;
  };
  validation: ExpenditurePdfValidationReport;
};

export type WorkbookComparisonReport = {
  status: "passed" | "failed" | "skipped";
  pdfGrandTotalActualGel: number;
  workbookGrandTotalActualGel: number | null;
  differenceGel: number | null;
  notes: string[];
};

const monetaryToleranceGel = 1000;
const amountPattern = /-?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}/g;
const codeLinePattern = /^(\d+(?:\.\d+)*|00|31)\s+(.+)$/;

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\t/g, " ").replace(/\s+/g, " ").trim();
}

function parseGel(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function gelToThousandGel(value: number | null): number | null {
  return value === null ? null : value / 1000;
}

function roundedGel(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

function parentFunctionalCode(code: string): string | null {
  const parts = code.split(".");
  if (parts.length <= 2) return null;
  return parts.slice(0, -1).join(".");
}

function isTopFunctionalCode(code: string | null): boolean {
  return Boolean(code && code.split(".").length === 2);
}

function buildRowId(input: {
  year: number;
  formId: string;
  functionalCode: string | null;
  economicCode: string;
  hierarchyPath: string;
}): string {
  return [
    input.year,
    input.formId,
    input.functionalCode ?? "root",
    input.economicCode,
    createHash("sha1").update(input.hierarchyPath).digest("hex").slice(0, 12),
  ].join(":");
}

type ParsedSegment = {
  pageNumber: number;
  code: string;
  text: string;
};

function segmentsFromPages(pages: ExpenditurePdfPageText[]): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let active: { pageNumber: number; code: string; parts: string[] } | null = null;

  const flush = () => {
    if (!active) return;
    const text = normalizeText(active.parts.join(" "));
    if (text) {
      segments.push({
        pageNumber: active.pageNumber,
        code: active.code,
        text,
      });
    }
    active = null;
  };

  for (const page of pages) {
    const lines = page.text
      .split(/\r?\n/)
      .map(normalizeText)
      .filter(Boolean);

    for (const line of lines) {
      if (/^(2025 |01\/04\/2026|\d{2}\/\d{2}\/\d{4})/.test(line) || line.includes(" - 42 ")) {
        flush();
        continue;
      }

      const codeMatch = line.match(codeLinePattern);
      if (codeMatch) {
        flush();
        active = {
          pageNumber: page.pageNumber,
          code: codeMatch[1],
          parts: [codeMatch[2]],
        };
        continue;
      }

      if (active) active.parts.push(line);
    }

    flush();
  }

  return segments;
}

export function parseExpenditurePdfText(input: ExpenditurePdfSource & { pages: ExpenditurePdfPageText[] }): ExpenditurePdfOfficialRow[] {
  const segments = segmentsFromPages(input.pages);
  const rows: ExpenditurePdfOfficialRow[] = [];
  const seen = new Set<string>();
  const functionalPaths = new Map<string, string>();
  let currentFunctional: { code: string; label: string; path: string } | null = null;

  for (const segment of segments) {
    const amounts = Array.from(segment.text.matchAll(amountPattern)).map((match) => match[0]);
    const labelKa = normalizeText(segment.text.replace(amountPattern, ""));

    if (amounts.length === 0 && segment.code.startsWith("7.")) {
      const parentPath = parentFunctionalCode(segment.code);
      const hierarchyPath = parentPath ? [functionalPaths.get(parentPath), labelKa].filter(Boolean).join(" > ") : labelKa;
      functionalPaths.set(segment.code, hierarchyPath);
      currentFunctional = {
        code: segment.code,
        label: labelKa,
        path: hierarchyPath,
      };
      continue;
    }

    if (amounts.length < 2 || !labelKa) continue;
    if (!currentFunctional && segment.code !== "00") continue;
    if (currentFunctional && segment.code !== "00") continue;

    const approvedPlanGel = parseGel(amounts[0] ?? null);
    const revisedPlanGel = parseGel(amounts[1] ?? null);
    const actualIndex = Math.min(input.actualAmountIndex ?? 2, amounts.length - 1);
    const actualGel = parseGel(amounts[actualIndex] ?? null);
    const annualObligationGel = parseGel(amounts.length >= 4 ? amounts[3] : null);
    const yearResourceGel = parseGel(amounts.length >= 5 ? amounts[4] : null);
    if (actualGel === null) continue;

    const functionalCode = currentFunctional?.code ?? null;
    const rowType: ExpenditurePdfRowType = functionalCode ? "functional_total" : "grand_total";
    const hierarchyPath = currentFunctional?.path ?? labelKa;
    const outputLabel = currentFunctional?.label ?? labelKa;
    const dedupeKey = [functionalCode ?? "root", segment.code, outputLabel, ...amounts].join("|");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rows.push({
      sourceId: input.sourceId,
      sourceFile: input.sourceFile,
      year: input.year,
      formId: input.formId,
      tableTitle: input.tableTitle,
      pageNumber: segment.pageNumber,
      tableIndex: 1,
      rowIndex: rows.length + 1,
      rowId: buildRowId({
        year: input.year,
        formId: input.formId,
        functionalCode,
        economicCode: segment.code,
        hierarchyPath,
      }),
      rowType,
      includeInPublicMapping: rowType === "functional_total",
      identityConfidence: "official_code",
      functionalCode,
      economicCode: segment.code,
      hierarchyPath,
      labelKa: outputLabel,
      approvedPlanRaw: amounts[0] ?? null,
      approvedPlanThousandGel: gelToThousandGel(approvedPlanGel),
      approvedPlanGel: roundedGel(approvedPlanGel),
      revisedPlanRaw: amounts[1] ?? null,
      revisedPlanThousandGel: gelToThousandGel(revisedPlanGel),
      revisedPlanGel: roundedGel(revisedPlanGel),
      actualRaw: amounts[actualIndex] ?? "",
      actualThousandGel: actualGel / 1000,
      actualGel: Math.round(actualGel),
      annualObligationRaw: amounts.length >= 4 ? amounts[3] : null,
      annualObligationThousandGel: gelToThousandGel(annualObligationGel),
      annualObligationGel: roundedGel(annualObligationGel),
      yearResourceRaw: amounts.length >= 5 ? amounts[4] : null,
      yearResourceThousandGel: gelToThousandGel(yearResourceGel),
      yearResourceGel: roundedGel(yearResourceGel),
      sourceUnit: "gel",
      rawRowText: `${functionalCode ? `${functionalCode} ` : ""}${segment.code} ${segment.text}`,
    });
  }

  return rows;
}

function checkTotal(name: string, expectedGel: number, actualGel: number) {
  const differenceGel = Math.abs(expectedGel - actualGel);
  return {
    name,
    expectedGel,
    actualGel,
    differenceGel,
    status: differenceGel <= monetaryToleranceGel ? "passed" as const : "failed" as const,
  };
}

export function validateExpenditurePdfRows(rows: ExpenditurePdfOfficialRow[]): ExpenditurePdfValidationReport {
  const grandTotal = rows.find((row) => row.rowType === "grand_total");
  const grandTotalActualGel = grandTotal?.actualGel ?? 0;
  const topFunctionalTotalActualGel = rows
    .filter((row) => row.rowType === "functional_total" && isTopFunctionalCode(row.functionalCode))
    .reduce((sum, row) => sum + row.actualGel, 0);

  const checks = [checkTotal("top_functional_total_actual_gel", grandTotalActualGel, topFunctionalTotalActualGel)];
  const failedChecks = checks.filter((check) => check.status === "failed").map((check) => check.name);

  if (!grandTotal) failedChecks.push("grand_total_row_present");

  return {
    status: failedChecks.length === 0 ? "passed" : "failed",
    toleranceGel: monetaryToleranceGel,
    grandTotalActualGel,
    topFunctionalTotalActualGel,
    rowCount: rows.length,
    functionalTotalRowCount: rows.filter((row) => row.rowType === "functional_total").length,
    includeInPublicMappingRowCount: rows.filter((row) => row.includeInPublicMapping).length,
    failedChecks,
    checks,
  };
}

export function buildExpenditurePdfExtractionReport(input: {
  source: ExpenditurePdfSource;
  rows: ExpenditurePdfOfficialRow[];
  pageCount: number;
  tableExtractionAttempt: ExpenditurePdfExtractionReport["tableExtractionAttempt"];
}): ExpenditurePdfExtractionReport {
  const validation = validateExpenditurePdfRows(input.rows);

  return {
    source: input.source,
    boundary: {
      formId: input.source.formId,
      tableTitle: input.source.tableTitle,
      pageStart: 1,
      pageEnd: input.pageCount,
    },
    tableExtractionAttempt: input.tableExtractionAttempt,
    sourceUnit: "gel",
    acceptedMonetaryColumns: ["approved_plan", "revised_plan", "actual", "annual_obligation", "year_resource"],
    acceptedRateColumns: [],
    excludedBreakdownCodes: ["2.*", "31"],
    rowCounts: {
      totalRows: input.rows.length,
      grandTotalRows: input.rows.filter((row) => row.rowType === "grand_total").length,
      functionalTotalRows: input.rows.filter((row) => row.rowType === "functional_total").length,
      includeInPublicMappingRows: input.rows.filter((row) => row.includeInPublicMapping).length,
    },
    validation,
  };
}

export function buildWorkbookComparisonReport(input: {
  pdfRows: ExpenditurePdfOfficialRow[];
  workbookGrandTotalActualGel: number | null;
}): WorkbookComparisonReport {
  const pdfGrandTotalActualGel = input.pdfRows.find((row) => row.rowType === "grand_total")?.actualGel ?? 0;

  if (input.workbookGrandTotalActualGel === null) {
    return {
      status: "skipped",
      pdfGrandTotalActualGel,
      workbookGrandTotalActualGel: null,
      differenceGel: null,
      notes: ["Workbook comparison source was not available."],
    };
  }

  const differenceGel = Math.abs(pdfGrandTotalActualGel - input.workbookGrandTotalActualGel);

  return {
    status: differenceGel <= monetaryToleranceGel ? "passed" : "failed",
    pdfGrandTotalActualGel,
    workbookGrandTotalActualGel: input.workbookGrandTotalActualGel,
    differenceGel,
    notes:
      differenceGel <= monetaryToleranceGel
        ? []
        : ["Diagnostic only: the PDF E11 source and workbook tavi 6 source have different structures."],
  };
}

function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function expenditurePdfRowsToCsv(rows: ExpenditurePdfOfficialRow[]): string {
  const headers = [
    "source_id",
    "source_file",
    "year",
    "form_id",
    "table_title",
    "page_number",
    "table_index",
    "row_index",
    "row_id",
    "row_type",
    "include_in_public_mapping",
    "identity_confidence",
    "functional_code",
    "economic_code",
    "hierarchy_path",
    "label_ka",
    "approved_plan_raw",
    "approved_plan_thousand_gel",
    "approved_plan_gel",
    "revised_plan_raw",
    "revised_plan_thousand_gel",
    "revised_plan_gel",
    "actual_raw",
    "actual_thousand_gel",
    "actual_gel",
    "annual_obligation_raw",
    "annual_obligation_thousand_gel",
    "annual_obligation_gel",
    "year_resource_raw",
    "year_resource_thousand_gel",
    "year_resource_gel",
    "source_unit",
    "raw_row_text",
  ];

  const records = rows.map((row) => ({
    source_id: row.sourceId,
    source_file: row.sourceFile,
    year: row.year,
    form_id: row.formId,
    table_title: row.tableTitle,
    page_number: row.pageNumber,
    table_index: row.tableIndex,
    row_index: row.rowIndex,
    row_id: row.rowId,
    row_type: row.rowType,
    include_in_public_mapping: row.includeInPublicMapping,
    identity_confidence: row.identityConfidence,
    functional_code: row.functionalCode,
    economic_code: row.economicCode,
    hierarchy_path: row.hierarchyPath,
    label_ka: row.labelKa,
    approved_plan_raw: row.approvedPlanRaw,
    approved_plan_thousand_gel: row.approvedPlanThousandGel,
    approved_plan_gel: row.approvedPlanGel,
    revised_plan_raw: row.revisedPlanRaw,
    revised_plan_thousand_gel: row.revisedPlanThousandGel,
    revised_plan_gel: row.revisedPlanGel,
    actual_raw: row.actualRaw,
    actual_thousand_gel: row.actualThousandGel,
    actual_gel: row.actualGel,
    annual_obligation_raw: row.annualObligationRaw,
    annual_obligation_thousand_gel: row.annualObligationThousandGel,
    annual_obligation_gel: row.annualObligationGel,
    year_resource_raw: row.yearResourceRaw,
    year_resource_thousand_gel: row.yearResourceThousandGel,
    year_resource_gel: row.yearResourceGel,
    source_unit: row.sourceUnit,
    raw_row_text: row.rawRowText,
  }));

  return `\ufeff${[
    headers.join(","),
    ...records.map((record) => headers.map((header) => csvEscape(record[header as keyof typeof record] ?? null)).join(",")),
  ].join("\n")}`;
}

export async function readPdfTextPages(pdfPath: string): Promise<{
  pageCount: number;
  pages: ExpenditurePdfPageText[];
  tableExtractionAttempt: ExpenditurePdfExtractionReport["tableExtractionAttempt"];
}> {
  const buffer = await readFile(pdfPath);
  const parser = new PDFParse({ data: buffer });

  try {
    const textResult = await parser.getText();
    let extractedTables = 0;

    try {
      const tableResult = await parser.getTable();
      extractedTables = tableResult.pages.reduce((sum, page) => sum + page.tables.length, 0);
    } catch {
      extractedTables = 0;
    }

    return {
      pageCount: textResult.total,
      pages: textResult.pages.map((page, index) => ({
        pageNumber: index + 1,
        text: page.text,
      })),
      tableExtractionAttempt: {
        attempted: true,
        extractedTables,
        selectedMethod: extractedTables > 0 ? "table" : "text_fallback",
      },
    };
  } finally {
    await parser.destroy();
  }
}

export async function sha256File(relativePath: string): Promise<string> {
  const filePath = path.resolve(process.cwd(), relativePath);
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}
