import { describe, expect, it } from "vitest";
import { generateCandidateMappings } from "../../../lib/data/realExpenditure/candidateMapping";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

function row(labelKa: string, code: string): OfficialExpenditureRow {
  return {
    year: 2022,
    sourceId: "source.mof_2022_tavi6_actual",
    workbookPath: "docs/Raw Data/Expenditure/mof.ge/2022 redaqtirenadi 12 Tve.xls",
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
    actualThousandGel: 10,
    executionPercent: null,
  };
}

describe("generateCandidateMappings older-year supplement labels", () => {
  it("maps state obligation repayment labels to debt service", () => {
    const mappings = generateCandidateMappings([
      row("საგარეო სახელმწიფო ვალდებულებების მომსახურება და დაფარვა", "55 01"),
      row("საშინაო სახელმწიფო ვალდებულებების მომსახურება და დაფარვა", "55 02"),
    ]);

    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "55 01",
          suggestedPublicSpendingFieldId: "spending.debt_service",
          mappingConfidence: "high",
        }),
        expect.objectContaining({
          code: "55 02",
          suggestedPublicSpendingFieldId: "spending.debt_service",
          mappingConfidence: "high",
        }),
      ]),
    );
  });

  it("maps transport and municipal project labels to infrastructure", () => {
    const mappings = generateCandidateMappings([
      row("თბილისის ავტობუსების პროექტი (EBRD)", "55 13 02"),
      row("მყარი ნარჩენების მართვის პროგრამა", "25 05"),
    ]);

    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "55 13 02",
          suggestedPublicSpendingFieldId: "spending.infrastructure_regional_development",
        }),
        expect.objectContaining({
          code: "25 05",
          suggestedPublicSpendingFieldId: "spending.infrastructure_regional_development",
        }),
      ]),
    );
  });

  it("maps energy transmission project labels to infrastructure", () => {
    const mappings = generateCandidateMappings([
      row("ელექტროგადამცემი ქსელის გაძლიერების პროექტი", "24 14 01"),
      row("ვარდნილისა და ენგურის ჰიდროელექტროსადგურების რეაბილიტაციის პროექტი (EBRD, EIB, EU)", "24 19"),
      row("რეგიონალური ელექტროგადაცემის გაუმჯობესების პროექტი", "36 03 01"),
      row('220კვ "ახალციხე-ბათუმი" ხაზის მშენებლობა', "36 03 03"),
    ]);

    expect(mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "24 14 01",
          suggestedPublicSpendingFieldId: "spending.infrastructure_regional_development",
        }),
        expect.objectContaining({
          code: "24 19",
          suggestedPublicSpendingFieldId: "spending.infrastructure_regional_development",
        }),
        expect.objectContaining({
          code: "36 03 01",
          suggestedPublicSpendingFieldId: "spending.infrastructure_regional_development",
        }),
        expect.objectContaining({
          code: "36 03 03",
          suggestedPublicSpendingFieldId: "spending.infrastructure_regional_development",
        }),
      ]),
    );
  });

  it("maps public broadcaster supplement labels to culture", () => {
    const mappings = generateCandidateMappings([row("სსიპ – საზოგადოებრივი მაუწყებელი", "42 00")]);

    expect(mappings[0]).toEqual(
      expect.objectContaining({
        suggestedPublicSpendingFieldId: "spending.culture",
      }),
    );
  });

  it("maps mixed social and health program management to health", () => {
    const mappings = generateCandidateMappings([row("სოციალური და ჯანმრთელობის დაცვის პროგრამების მართვა", "35 01 04")]);

    expect(mappings[0]).toEqual(
      expect.objectContaining({
        suggestedPublicSpendingFieldId: "spending.health",
        mappingConfidence: "medium",
      }),
    );
  });
});
