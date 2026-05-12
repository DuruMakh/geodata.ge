import { describe, expect, it } from "vitest";
import type { RealExpenditureFactCsvRow } from "../../../lib/data/realExpenditure/generateFacts";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";
import { validateRealExpenditureFacts } from "../../../lib/data/realExpenditure/validateRealExpenditure";

const officialRows: OfficialExpenditureRow[] = [
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi 6",
    rowNumber: 4,
    code: "00 00",
    parentCode: null,
    depth: 0,
    institutionCode: null,
    institutionLabelKa: null,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: true,
    isCodedRow: true,
    isLeafCode: false,
    labelKa: "სულ ჯამი",
    approvedPlanThousandGel: 100,
    revisedPlanThousandGel: 100,
    actualThousandGel: 100,
    executionPercent: 1,
  },
];

describe("validateRealExpenditureFacts", () => {
  it("passes when generated facts reconcile to official total", () => {
    const facts: RealExpenditureFactCsvRow[] = [
      {
        year: 2025,
        side: "expenditure",
        item_id: "spending.general_public_services",
        amount_gel: "100000",
        basis: "actual",
        source_id: "source.mof_2025_tavi6_actual",
        official_institution: "საქართველოს პარლამენტი",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "spending.general_public_services",
        mapping_confidence: "medium",
        mapping_notes: "reviewed",
      },
    ];

    expect(validateRealExpenditureFacts(officialRows, facts)).toEqual(
      expect.objectContaining({
        reconciliationStatusByYear: { 2025: "passed" },
        generatedTotalGelByYear: { 2025: 100000 },
      }),
    );
  });

  it("fails when generated facts do not reconcile to official total", () => {
    const facts: RealExpenditureFactCsvRow[] = [
      {
        year: 2025,
        side: "expenditure",
        item_id: "spending.general_public_services",
        amount_gel: "90000",
        basis: "actual",
        source_id: "source.mof_2025_tavi6_actual",
        official_institution: "საქართველოს პარლამენტი",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "spending.general_public_services",
        mapping_confidence: "medium",
        mapping_notes: "reviewed",
      },
    ];

    const report = validateRealExpenditureFacts(officialRows, facts);

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings[0]).toContain("2025 reconciliation mismatch");
  });
});
