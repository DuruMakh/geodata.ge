import { describe, expect, it } from "vitest";
import { generateCandidateMappings } from "../../../lib/data/realExpenditure/candidateMapping";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

function row(labelKa: string, code: string, actualThousandGel = 10): OfficialExpenditureRow {
  return {
    year: 2025,
    sourceId: "source.mof_2025_tavi6_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi 6",
    rowNumber: 1,
    code,
    parentCode: "00 00",
    depth: 1,
    institutionCode: code,
    institutionLabelKa: labelKa,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: false,
    isCodedRow: true,
    isLeafCode: true,
    labelKa,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel,
    executionPercent: null,
  };
}

describe("generateCandidateMappings", () => {
  it("maps obvious institutions to high confidence fields", () => {
    const mappings = generateCandidateMappings([
      row("საქართველოს თავდაცვის სამინისტრო", "29 00"),
      row("საქართველოს განათლების, მეცნიერებისა და ახალგაზრდობის სამინისტრო", "32 00"),
    ]);

    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "29 00",
          suggestedPublicSpendingFieldId: "spending.defence",
          mappingConfidence: "high",
        }),
        expect.objectContaining({
          code: "32 00",
          suggestedPublicSpendingFieldId: "spending.education",
          mappingConfidence: "high",
        }),
      ]),
    );
  });

  it("keeps mixed health and social ministry rows reviewable", () => {
    const mappings = generateCandidateMappings([
      row("ჯანმრთელობის დაცვის პროგრამა", "27 03", 100),
      row("მოსახლეობის სოციალური დაცვა", "27 02", 200),
      row("ოკუპირებული ტერიტორიებიდან დევნილთა, შრომის, ჯანმრთელობისა და სოციალური დაცვის სამინისტრო", "27 00", 300),
    ]);

    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "27 03",
          suggestedPublicSpendingFieldId: "spending.health",
        }),
        expect.objectContaining({
          code: "27 02",
          suggestedPublicSpendingFieldId: "spending.social_protection",
        }),
        expect.objectContaining({
          code: "27 00",
          suggestedPublicSpendingFieldId: "spending.other_unclassified",
          mappingConfidence: "medium",
        }),
      ]),
    );
  });
});
