import { describe, expect, it } from "vitest";
import {
  buildExpenditurePdfExtractionReport,
  buildWorkbookComparisonReport,
  expenditurePdfPhase1OutputFilesForYear,
  expenditurePdfPhase1OutputFiles,
  expenditurePdfRowsToCsv,
  parseExpenditurePdfText,
  validateExpenditurePdfRows,
} from "../../../lib/data/realExpenditurePdf/phase1Pilot";

const source = {
  year: 2025,
  sourceId: "source.mof_2025_expenditure_pdf_form_e11_actual",
  sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf",
  sourceSha256: "1B680A253394C689703BE0279F41860AFEB6EF8D6791D5E42F5BE8C70FF39EAD",
  formId: "E11",
  tableTitle: "2025 state budget expenditure execution by functional classification",
};

describe("expenditure PDF Phase 1 pilot", () => {
  it("keeps only grand total and functional category totals", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            form E11
            00 total 100.00 100.00 100.00 100.00 0.00
            2 expenses 80.00 80.00 80.00 80.00 0.00
            31 non-financial assets growth 20.00 20.00 20.00 20.00 0.00
            7.1 general public services
            00 total 40.00 40.00 40.00 40.00 0.00
            2 expenses 30.00 30.00 30.00 30.00 0.00
          `,
        },
        {
          pageNumber: 2,
          text: `
            2.1 compensation of employees 10.00 10.00 10.00 10.00 0.00
            2.2 goods and services 20.00 20.00 20.00 20.00 0.00
            31 non-financial assets growth 10.00 10.00 10.00 10.00 0.00
            7.2 defence
            00 total 60.00 60.00 60.00 60.00 0.00
            2 expenses 60.00 60.00 60.00 60.00 0.00
          `,
        },
      ],
    });

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.economicCode)).toEqual(["00", "00", "00"]);
    expect(rows.map((row) => row.functionalCode)).toEqual([null, "7.1", "7.2"]);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        rowType: "grand_total",
        economicCode: "00",
        actualRaw: "100.00",
        actualGel: 100,
        actualThousandGel: 0.1,
        includeInPublicMapping: false,
      }),
    );
    expect(rows.find((row) => row.functionalCode === "7.1")).toEqual(
      expect.objectContaining({
        hierarchyPath: "general public services",
        rowType: "functional_total",
        includeInPublicMapping: true,
        identityConfidence: "official_code",
        actualGel: 40,
      }),
    );
  });

  it("preserves functional hierarchy paths for subcategory totals", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 100.00 100.00 100.00 100.00 0.00
            7.1 services
            00 total 100.00 100.00 100.00 100.00 0.00
            7.1.1 subcategory
            00 total 30.00 30.00 30.00 30.00 0.00
            2.1 compensation of employees 30.00 30.00 30.00 30.00 0.00
          `,
        },
      ],
    });

    expect(rows.map((row) => row.functionalCode)).toEqual([null, "7.1", "7.1.1"]);
    expect(rows.find((row) => row.functionalCode === "7.1.1")).toEqual(
      expect.objectContaining({
        hierarchyPath: "services > subcategory",
        rowType: "functional_total",
        actualGel: 30,
      }),
    );
  });

  it("passes validation when top functional totals reconcile", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 100.00 100.00 100.00 100.00 0.00
            2 expenses 80.00 80.00 80.00 80.00 0.00
            31 non-financial assets growth 20.00 20.00 20.00 20.00 0.00
            7.1 services
            00 total 40.00 40.00 40.00 40.00 0.00
            2 expenses 40.00 40.00 40.00 40.00 0.00
            7.2 defence
            00 total 60.00 60.00 60.00 60.00 0.00
            2 expenses 60.00 60.00 60.00 60.00 0.00
          `,
        },
      ],
    });

    const validation = validateExpenditurePdfRows(rows);

    expect(validation.status).toBe("passed");
    expect(validation.grandTotalActualGel).toBe(100);
    expect(validation.topFunctionalTotalActualGel).toBe(100);
    expect(validation.failedChecks).toEqual([]);
  });

  it("can use the payment column as actual when a PDF has no revised-plan column", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      actualAmountIndex: 1,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 90.00 100.00 110.00 10.00
            31 non-financial assets growth 100.00 100.00 110.00 10.00
            7.1 services
            00 total 90.00 100.00 110.00 10.00
          `,
        },
      ],
    });

    expect(rows.find((row) => row.rowType === "grand_total")?.actualGel).toBe(100);
    expect(validateExpenditurePdfRows(rows).status).toBe("passed");
  });

  it("fails validation when top functional totals do not reconcile", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 100,000.00 100,000.00 100,000.00 100,000.00 0.00
            2 expenses 80,000.00 80,000.00 80,000.00 80,000.00 0.00
            31 non-financial assets growth 20,000.00 20,000.00 20,000.00 20,000.00 0.00
            7.1 services
            00 total 80,000.00 80,000.00 80,000.00 80,000.00 0.00
          `,
        },
      ],
    });

    const validation = validateExpenditurePdfRows(rows);

    expect(validation.status).toBe("failed");
    expect(validation.failedChecks).toContain("top_functional_total_actual_gel");
  });

  it("keeps Phase 1 outputs separate from current app imports", () => {
    expect(expenditurePdfPhase1OutputFiles).toEqual({
      stagingCsv: "data/staging/expenditure-pdf-official-rows-2025-pilot.csv",
      extractionReport: "data/reports/expenditure-pdf-extraction-report-2025-pilot.json",
      workbookComparisonReport: "data/reports/expenditure-pdf-vs-workbook-2025-pilot-report.json",
    });
    expect(expenditurePdfPhase1OutputFilesForYear(2024)).toEqual({
      stagingCsv: "data/staging/expenditure-pdf-official-rows-2024-pilot.csv",
      extractionReport: "data/reports/expenditure-pdf-extraction-report-2024-pilot.json",
      workbookComparisonReport: "data/reports/expenditure-pdf-vs-workbook-2024-pilot-report.json",
    });
    expect(expenditurePdfPhase1OutputFilesForYear(2023)).toEqual({
      stagingCsv: "data/staging/expenditure-pdf-official-rows-2023-pilot.csv",
      extractionReport: "data/reports/expenditure-pdf-extraction-report-2023-pilot.json",
      workbookComparisonReport: "data/reports/expenditure-pdf-vs-workbook-2023-pilot-report.json",
    });
    expect(Object.values(expenditurePdfPhase1OutputFiles)).not.toContain("data/imports/expenditure-facts-2023-2025.csv");
    expect(Object.values(expenditurePdfPhase1OutputFiles)).not.toContain("data/imports/budget-facts-2023-2025.csv");
  });

  it("writes a UTF-8 BOM so Georgian labels open correctly in Excel", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 100.00 100.00 100.00 100.00 0.00
            7.1 services
            00 total 100.00 100.00 100.00 100.00 0.00
          `,
        },
      ],
    });

    expect(expenditurePdfRowsToCsv(rows).charCodeAt(0)).toBe(0xfeff);
  });

  it("builds a report with the extraction boundary and text fallback evidence", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 100.00 100.00 100.00 100.00 0.00
            2 expenses 80.00 80.00 80.00 80.00 0.00
            31 non-financial assets growth 20.00 20.00 20.00 20.00 0.00
            7.1 services
            00 total 100.00 100.00 100.00 100.00 0.00
          `,
        },
      ],
    });

    const report = buildExpenditurePdfExtractionReport({
      source,
      rows,
      pageCount: 1,
      tableExtractionAttempt: {
        attempted: true,
        extractedTables: 0,
        selectedMethod: "text_fallback",
      },
    });

    expect(report.boundary).toEqual({
      formId: "E11",
      tableTitle: "2025 state budget expenditure execution by functional classification",
      pageStart: 1,
      pageEnd: 1,
    });
    expect(report.validation.status).toBe("passed");
    expect(report.tableExtractionAttempt.selectedMethod).toBe("text_fallback");
  });

  it("records workbook comparison differences as diagnostic evidence", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 100,000.00 100,000.00 100,000.00 100,000.00 0.00
            2 expenses 80,000.00 80,000.00 80,000.00 80,000.00 0.00
            31 non-financial assets growth 20,000.00 20,000.00 20,000.00 20,000.00 0.00
            7.1 services
            00 total 100,000.00 100,000.00 100,000.00 100,000.00 0.00
          `,
        },
      ],
    });

    const report = buildWorkbookComparisonReport({
      pdfRows: rows,
      workbookGrandTotalActualGel: 120000,
    });

    expect(report.status).toBe("failed");
    expect(report.notes).toContain("Diagnostic only: the PDF E11 source and workbook tavi 6 source have different structures.");
  });
});
