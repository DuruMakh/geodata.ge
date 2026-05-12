import { describe, expect, it } from "vitest";
import { generateBudgetFactsFromReviewedMappings } from "../../../lib/data/realExpenditure/generateFacts";
import type { CandidateSpendingMapping, OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

function officialRow(code: string, amount: number): OfficialExpenditureRow {
  return {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi 6",
    rowNumber: 5,
    code,
    parentCode: "00 00",
    depth: 1,
    institutionCode: code,
    institutionLabelKa: `Institution ${code}`,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: false,
    isCodedRow: true,
    isLeafCode: true,
    labelKa: `Institution ${code}`,
    approvedPlanThousandGel: amount,
    revisedPlanThousandGel: amount,
    actualThousandGel: amount,
    executionPercent: 1,
  };
}

function mapping(
  code: string,
  fieldId: string,
  confidence: CandidateSpendingMapping["mappingConfidence"],
  reviewed = "",
): CandidateSpendingMapping {
  return {
    year: 2025,
    code,
    parentCode: "00 00",
    depth: 1,
    institutionCode: code,
    institutionLabelKa: `Institution ${code}`,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    labelKa: `Institution ${code}`,
    actualGel: 100000,
    suggestedPublicSpendingFieldId: fieldId,
    mappingConfidence: confidence,
    mappingReason: "general public services institution keyword",
    reviewedPublicSpendingFieldId: reviewed,
    reviewNotes: "reviewed",
  };
}

describe("generateBudgetFactsFromReviewedMappings", () => {
  it("aggregates reviewed leaf rows by year and public spending field", () => {
    const facts = generateBudgetFactsFromReviewedMappings(
      [officialRow("01 00", 100), officialRow("02 00", 25)],
      [
        mapping("01 00", "spending.general_public_services", "medium", "spending.general_public_services"),
        mapping("02 00", "spending.general_public_services", "high"),
      ],
    );

    expect(facts).toEqual([
      {
        year: 2025,
        side: "expenditure",
        item_id: "spending.general_public_services",
        amount_gel: "125000",
        basis: "actual",
        source_id: "source.mof_2025_tavi6_actual",
        official_institution: "Multiple official rows",
        official_program: "",
        official_subprogram: "",
        public_spending_field_id: "spending.general_public_services",
        mapping_confidence: "medium",
        mapping_notes: "Aggregated 2 reviewed leaf rows; codes: 01 00, 02 00",
      },
    ]);
  });

  it("blocks unreviewed non-high-confidence rows above threshold", () => {
    expect(() =>
      generateBudgetFactsFromReviewedMappings(
        [officialRow("01 00", 100)],
        [mapping("01 00", "spending.general_public_services", "medium")],
      ),
    ).toThrow("requires reviewed_public_spending_field_id");
  });
});
