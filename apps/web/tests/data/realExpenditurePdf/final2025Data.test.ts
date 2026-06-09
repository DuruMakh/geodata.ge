import { describe, expect, it } from "vitest";
import type { CompactPdfSpendingMappingRow } from "../../../lib/data/realExpenditurePdf/publicMapping";
import {
  composeFinalExpenditureFacts,
  composeFinal2025ExpenditureFacts,
  extractFinancialAssetAndLiabilitySupplements,
  final2025ExpenditureFactsToCsv,
} from "../../../lib/data/realExpenditurePdf/final2025Data";

const spendingFieldIds = [
  "spending.infrastructure_regional_development",
  "spending.debt_service",
  "spending.defence",
  "spending.other_unclassified",
];

function pdfRow(functionalCode: string, amountGel: number, publicSpendingFieldId: string): CompactPdfSpendingMappingRow {
  return {
    year: 2025,
    sourceId: "source.pdf",
    functionalCode,
    hierarchyPath: functionalCode,
    labelKa: functionalCode,
    amountGel,
    publicSpendingFieldId,
    mappingConfidence: "medium",
    mappingReason: "test",
    includeInPublicFact: true,
    reviewNotes: "",
  };
}

describe("final 2025 expenditure data composition", () => {
  it("adds financial assets growth and liabilities decrease supplements without changing public taxonomy", () => {
    const pdfMappings = [
      pdfRow("7.6", 1000, "spending.infrastructure_regional_development"),
      pdfRow("7.1.6", 500, "spending.debt_service"),
    ];
    const supplements = [
      {
        year: 2025,
        sourceId: "source.workbook",
        code: "25 04",
        labelKa: "water infrastructure",
        economicLabelKa: "ფინანსური აქტივების ზრდა",
        amountGel: 300,
        publicSpendingFieldId: "spending.infrastructure_regional_development",
        mappingConfidence: "medium" as const,
        mappingNotes: "mapped by reviewed workbook row",
      },
      {
        year: 2025,
        sourceId: "source.workbook",
        code: "57 01",
        labelKa: "external debt repayment",
        economicLabelKa: "ვალდებულებების კლება",
        amountGel: 1300,
        publicSpendingFieldId: "spending.debt_service",
        mappingConfidence: "medium" as const,
        mappingNotes: "mapped by reviewed workbook row",
      },
      {
        year: 2025,
        sourceId: "source.workbook",
        code: "29 07",
        labelKa: "defence capabilities",
        economicLabelKa: "ფინანსური აქტივების ზრდა",
        amountGel: 200,
        publicSpendingFieldId: "spending.defence",
        mappingConfidence: "medium" as const,
        mappingNotes: "mapped by reviewed workbook row",
      },
    ];

    const result = composeFinal2025ExpenditureFacts({
      pdfMappings,
      supplements,
      spendingFieldIds,
      workbookTotalGel: 3500,
    });

    expect(result.facts.map((row) => row.item_id)).toEqual(spendingFieldIds);
    expect(result.facts.find((row) => row.item_id === "spending.infrastructure_regional_development")?.amount_gel).toBe(
      "1300",
    );
    expect(result.facts.find((row) => row.item_id === "spending.debt_service")?.amount_gel).toBe("1800");
    expect(result.facts.find((row) => row.item_id === "spending.defence")?.amount_gel).toBe("200");
    expect(result.facts.find((row) => row.item_id === "spending.other_unclassified")?.amount_gel).toBe("0");
    expect(result.report).toEqual(
      expect.objectContaining({
        pdfMappedTotalGel: 1500,
        supplementTotalGel: 1800,
        finalTotalGel: 3300,
        workbookTotalGel: 3500,
        differenceGel: 200,
      }),
    );
  });

  it("extracts only reviewed mapped financial-asset and liability supplement rows from workbook staging rows", () => {
    const supplements = extractFinancialAssetAndLiabilitySupplements({
      rows: [
        { year: 2025, sourceId: "source.workbook", code: "25 04", isCodedRow: true, labelKa: "water", actualGel: 5000 },
        {
          year: 2025,
          sourceId: "source.workbook",
          code: null,
          isCodedRow: false,
          labelKa: "ფინანსური აქტივების ზრდა",
          actualGel: 300,
        },
        { year: 2025, sourceId: "source.workbook", code: "57 01", isCodedRow: true, labelKa: "debt", actualGel: 9000 },
        {
          year: 2025,
          sourceId: "source.workbook",
          code: null,
          isCodedRow: false,
          labelKa: "ვალდებულებების კლება",
          actualGel: 1300,
        },
        { year: 2025, sourceId: "source.workbook", code: "77 00", isCodedRow: true, labelKa: "unmapped", actualGel: 1 },
        {
          year: 2025,
          sourceId: "source.workbook",
          code: null,
          isCodedRow: false,
          labelKa: "ფინანსური აქტივების ზრდა",
          actualGel: 100,
        },
      ],
      mappingsByCode: new Map([
        [
          "25 04",
          {
            publicSpendingFieldId: "spending.infrastructure_regional_development",
            mappingConfidence: "medium" as const,
            labelKa: "water",
            mappingNotes: "reviewed",
          },
        ],
        [
          "57 01",
          {
            publicSpendingFieldId: "spending.debt_service",
            mappingConfidence: "medium" as const,
            labelKa: "debt",
            mappingNotes: "reviewed",
          },
        ],
      ]),
    });

    expect(supplements).toEqual([
      expect.objectContaining({
        code: "25 04",
        economicLabelKa: "ფინანსური აქტივების ზრდა",
        amountGel: 300,
        publicSpendingFieldId: "spending.infrastructure_regional_development",
      }),
      expect.objectContaining({
        code: "57 01",
        economicLabelKa: "ვალდებულებების კლება",
        amountGel: 1300,
        publicSpendingFieldId: "spending.debt_service",
      }),
    ]);
  });

  it("skips non-leaf workbook supplement subtotal rows when leaf metadata is present", () => {
    const supplements = extractFinancialAssetAndLiabilitySupplements({
      rows: [
        {
          year: 2025,
          sourceId: "source.workbook",
          code: "24 00",
          isCodedRow: true,
          isLeafCode: false,
          labelKa: "ministry subtotal",
          actualGel: 5000,
        },
        {
          year: 2025,
          sourceId: "source.workbook",
          code: null,
          isCodedRow: false,
          labelKa: "ფინანსური აქტივების ზრდა",
          actualGel: 1000,
        },
        {
          year: 2025,
          sourceId: "source.workbook",
          code: "24 14 03 03",
          isCodedRow: true,
          isLeafCode: true,
          labelKa: "transmission line",
          actualGel: 5000,
        },
        {
          year: 2025,
          sourceId: "source.workbook",
          code: null,
          isCodedRow: false,
          labelKa: "ფინანსური აქტივების ზრდა",
          actualGel: 400,
        },
      ],
      mappingsByCode: new Map([
        [
          "24 00",
          {
            publicSpendingFieldId: "spending.economic_affairs",
            mappingConfidence: "medium" as const,
            labelKa: "ministry subtotal",
            mappingNotes: "subtotal",
          },
        ],
        [
          "24 14 03 03",
          {
            publicSpendingFieldId: "spending.infrastructure_regional_development",
            mappingConfidence: "medium" as const,
            labelKa: "transmission line",
            mappingNotes: "leaf",
          },
        ],
      ]),
    });

    expect(supplements).toEqual([
      expect.objectContaining({
        code: "24 14 03 03",
        amountGel: 400,
        publicSpendingFieldId: "spending.infrastructure_regional_development",
      }),
    ]);
  });

  it("writes a UTF-8 BOM for the final CSV", () => {
    const result = composeFinal2025ExpenditureFacts({
      pdfMappings: [],
      supplements: [],
      spendingFieldIds: ["spending.other_unclassified"],
      workbookTotalGel: 0,
    });

    const csv = final2025ExpenditureFactsToCsv(result.facts);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("can compose final expenditure facts for 2024 with a year-specific source id", () => {
    const result = composeFinalExpenditureFacts({
      year: 2024,
      finalSourceId: "source.mof_2024_expenditure_pdf_e11_plus_tavi6_supplement_actual",
      sourceFiles: [
        "docs/Raw Data/Expenditure/treasury.ge/2024-12-month-state-budget-functional-expenditure.pdf",
        "docs/Raw Data/Expenditure/mof.ge/2024 12 თვე საიტისთვის.xlsx",
        "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
      ],
      pdfMappings: [pdfRow("7.2", 1000, "spending.defence")],
      supplements: [
        {
          year: 2024,
          sourceId: "source.workbook",
          code: "29 07",
          labelKa: "defence capabilities",
          economicLabelKa: "ფინანსური აქტივების ზრდა",
          amountGel: 200,
          publicSpendingFieldId: "spending.defence",
          mappingConfidence: "medium" as const,
          mappingNotes: "mapped by reviewed workbook row",
        },
      ],
      spendingFieldIds: ["spending.defence", "spending.other_unclassified"],
      workbookTotalGel: 1200,
    });

    expect(result.facts).toEqual([
      expect.objectContaining({
        year: 2024,
        item_id: "spending.defence",
        amount_gel: "1200",
        source_id: "source.mof_2024_expenditure_pdf_e11_plus_tavi6_supplement_actual",
      }),
      expect.objectContaining({
        year: 2024,
        item_id: "spending.other_unclassified",
        amount_gel: "0",
      }),
    ]);
    expect(result.report).toEqual(
      expect.objectContaining({
        year: 2024,
        pdfMappedTotalGel: 1000,
        supplementTotalGel: 200,
        finalTotalGel: 1200,
        workbookTotalGel: 1200,
        differenceGel: 0,
        sources: [
          "docs/Raw Data/Expenditure/treasury.ge/2024-12-month-state-budget-functional-expenditure.pdf",
          "docs/Raw Data/Expenditure/mof.ge/2024 12 თვე საიტისთვის.xlsx",
          "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
        ],
      }),
    );
  });

  it("can compose final expenditure facts for 2023 with a year-specific source id", () => {
    const result = composeFinalExpenditureFacts({
      year: 2023,
      finalSourceId: "source.mof_2023_expenditure_pdf_e11_plus_tavi6_supplement_actual",
      sourceFiles: [
        "docs/Raw Data/Expenditure/treasury.ge/2023-12-month-state-budget-functional-expenditure.pdf",
        "docs/Raw Data/Expenditure/mof.ge/2023 12 tve saitistvis.xls",
        "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
      ],
      pdfMappings: [pdfRow("7.2", 1000, "spending.defence")],
      supplements: [
        {
          year: 2023,
          sourceId: "source.workbook",
          code: "29 07",
          labelKa: "defence capabilities",
          economicLabelKa: "ფინანსური აქტივების ზრდა",
          amountGel: 200,
          publicSpendingFieldId: "spending.defence",
          mappingConfidence: "medium" as const,
          mappingNotes: "mapped by reviewed workbook row",
        },
      ],
      spendingFieldIds: ["spending.defence", "spending.other_unclassified"],
      workbookTotalGel: 1200,
    });

    expect(result.facts).toEqual([
      expect.objectContaining({
        year: 2023,
        item_id: "spending.defence",
        amount_gel: "1200",
        source_id: "source.mof_2023_expenditure_pdf_e11_plus_tavi6_supplement_actual",
      }),
      expect.objectContaining({
        year: 2023,
        item_id: "spending.other_unclassified",
        amount_gel: "0",
      }),
    ]);
    expect(result.report.sources).toEqual([
      "docs/Raw Data/Expenditure/treasury.ge/2023-12-month-state-budget-functional-expenditure.pdf",
      "docs/Raw Data/Expenditure/mof.ge/2023 12 tve saitistvis.xls",
      "data/mappings/review/spending-field-mapping-review-2023-2025.csv",
    ]);
  });
});
