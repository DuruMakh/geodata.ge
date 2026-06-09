import { describe, expect, it } from "vitest";
import { parseExpenditurePdfText } from "../../../lib/data/realExpenditurePdf/phase1Pilot";
import {
  expenditurePdfCompactMappingOutputFileForYear,
  generateCompactPdfSpendingMappings,
  pdfSpendingMappingsToCsv,
  validateCompactPdfSpendingMappings,
} from "../../../lib/data/realExpenditurePdf/publicMapping";

const source = {
  year: 2025,
  sourceId: "source.mof_2025_expenditure_pdf_form_e11_actual",
  sourceFile: "docs/Raw Data/Expenditure/treasury.ge/2025-12-month-state-budget-functional-expenditure.pdf",
  sourceSha256: "1B680A253394C689703BE0279F41860AFEB6EF8D6791D5E42F5BE8C70FF39EAD",
  formId: "E11",
  tableTitle: "2025 state budget expenditure execution by functional classification",
};

describe("PDF public spending mapping", () => {
  it("selects child rows when a parent is split across public taxonomy fields", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 100.00 100.00 100.00 100.00 0.00
            7.1 general public services
            00 total 40.00 40.00 40.00 40.00 0.00
            7.1.1 administration
            00 total 25.00 25.00 25.00 25.00 0.00
            7.1.6 debt operations
            00 total 15.00 15.00 15.00 15.00 0.00
            7.2 defence
            00 total 60.00 60.00 60.00 60.00 0.00
          `,
        },
      ],
    });

    const mappings = generateCompactPdfSpendingMappings(rows);

    expect(mappings.map((row) => row.functionalCode)).toEqual(["7.1.1", "7.1.6", "7.2"]);
    expect(mappings.find((row) => row.functionalCode === "7.1.1")).toEqual(
      expect.objectContaining({
        publicSpendingFieldId: "spending.general_public_services",
        amountGel: 25,
      }),
    );
    expect(mappings.find((row) => row.functionalCode === "7.1.6")).toEqual(
      expect.objectContaining({
        publicSpendingFieldId: "spending.debt_service",
        amountGel: 15,
      }),
    );
    expect(mappings.find((row) => row.functionalCode === "7.2")).toEqual(
      expect.objectContaining({
        publicSpendingFieldId: "spending.defence",
        amountGel: 60,
      }),
    );
  });

  it("validates selected mapping rows against the grand total", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 100.00 100.00 100.00 100.00 0.00
            7.2 defence
            00 total 60.00 60.00 60.00 60.00 0.00
            7.3 public order
            00 total 40.00 40.00 40.00 40.00 0.00
          `,
        },
      ],
    });

    const mappings = generateCompactPdfSpendingMappings(rows);
    const validation = validateCompactPdfSpendingMappings(rows, mappings);

    expect(validation).toEqual({
      status: "passed",
      grandTotalActualGel: 100,
      mappedTotalActualGel: 100,
      differenceGel: 0,
      missingCodes: [],
    });
  });

  it("maps reviewed ambiguous functional rows to the chosen public fields", () => {
    const rows = parseExpenditurePdfText({
      ...source,
      pages: [
        {
          pageNumber: 1,
          text: `
            00 total 93.00 93.00 93.00 93.00 0.00
            7.1 general public services
            00 total 1558.00 1558.00 1558.00 1558.00 0.00
            7.1.7 intergovernmental flows
            00 total 1558.00 1558.00 1558.00 1558.00 0.00
            7.4 economic affairs
            00 total 4.00 4.00 4.00 4.00 0.00
            7.4.4 mining, manufacturing, and construction
            00 total 4.00 4.00 4.00 4.00 0.00
            7.8 recreation, culture, and religion
            00 total 89.00 89.00 89.00 89.00 0.00
            7.8.6 other unclassified recreation, culture, and religion
            00 total 89.00 89.00 89.00 89.00 0.00
          `,
        },
      ],
    });

    const mappings = generateCompactPdfSpendingMappings(rows);

    expect(mappings.find((row) => row.functionalCode === "7.1.7")).toEqual(
      expect.objectContaining({
        publicSpendingFieldId: "spending.infrastructure_regional_development",
        mappingConfidence: "medium",
      }),
    );
    expect(mappings.find((row) => row.functionalCode === "7.4.4")).toEqual(
      expect.objectContaining({
        publicSpendingFieldId: "spending.economic_affairs",
        mappingConfidence: "medium",
      }),
    );
    expect(mappings.find((row) => row.functionalCode === "7.8.6")).toEqual(
      expect.objectContaining({
        publicSpendingFieldId: "spending.culture",
        mappingConfidence: "medium",
      }),
    );
  });

  it("writes a UTF-8 BOM for Excel", () => {
    const csv = pdfSpendingMappingsToCsv([
      {
        year: 2025,
        sourceId: source.sourceId,
        functionalCode: "7.2",
        hierarchyPath: "defence",
        labelKa: "defence",
        amountGel: 60,
        publicSpendingFieldId: "spending.defence",
        mappingConfidence: "high",
        mappingReason: "direct functional mapping",
        includeInPublicFact: true,
        reviewNotes: "",
      },
    ]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("keeps compact mapping review files year-specific", () => {
    expect(expenditurePdfCompactMappingOutputFileForYear(2023)).toBe(
      "data/mappings/review/spending-field-mapping-review-2023-pdf-pilot.csv",
    );
    expect(expenditurePdfCompactMappingOutputFileForYear(2024)).toBe(
      "data/mappings/review/spending-field-mapping-review-2024-pdf-pilot.csv",
    );
  });
});
