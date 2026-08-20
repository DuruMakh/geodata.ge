import { describe, expect, it } from "vitest";
import {
  ADMIN_SPENDING_CATEGORIES,
  classifyAdminSpendingCategory,
} from "../../../lib/data/adminSpending/categories";
import {
  parseAdminSpending2004Pages,
  extractAdminSpending2005Rows,
  extractAdminSpending2014Rows,
} from "../../../lib/data/adminSpending/extractOlderMinistryYears";
import { extractAdminSpendingOfficialRows } from "../../../lib/data/adminSpending/extractWorkbooks";
import {
  ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL,
  generateAdminSpendingFacts,
} from "../../../lib/data/adminSpending/generateAdminSpendingFacts";
import { readCsvRecords } from "../../../lib/data/csv";
import { readPdfTextPages } from "../../../lib/data/realExpenditurePdf/phase1Pilot";
import { transliterateAcadNusx } from "../../../lib/data/adminSpending/transliterateAcadNusx";
import type { OfficialExpenditureRow } from "../../../lib/data/realExpenditure/types";

function institutionRow(year: number, institutionLabelKa: string): OfficialExpenditureRow {
  return {
    year,
    sourceId: "source.test",
    workbookPath: "test.xlsx",
    sheetName: "rows",
    rowNumber: 1,
    code: "34 00",
    parentCode: "00 00",
    depth: 1,
    institutionCode: "34 00",
    institutionLabelKa,
    programCode: null,
    programLabelKa: null,
    subprogramCode: null,
    subprogramLabelKa: null,
    isTotal: false,
    isCodedRow: true,
    isLeafCode: true,
    labelKa: institutionLabelKa,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: 100,
    executionPercent: null,
  };
}

/** Category totals (GEL) for a single year from the real generated facts. */
function categoryTotals(rows: OfficialExpenditureRow[], year: number): Record<string, number> {
  const facts = generateAdminSpendingFacts(rows).filter(
    (fact) => fact.level === "admin_category" && fact.year === year,
  );
  return Object.fromEntries(facts.map((fact) => [fact.itemId.replace("admin_spending.", ""), fact.amountGel]));
}

describe("AcadNusx transliteration", () => {
  it("converts legacy Latin-encoded Georgian back to Mkhedruli", () => {
    expect(transliterateAcadNusx("saqarTvelos finansTa saministro")).toBe("საქართველოს ფინანსთა სამინისტრო");
    expect(transliterateAcadNusx("ekonomikuri ganviTarebis")).toBe("ეკონომიკური განვითარების");
    expect(transliterateAcadNusx("Tavdacvis")).toBe("თავდაცვის");
    // Digits and spaces pass through unchanged.
    expect(transliterateAcadNusx("01 00 parlamenti")).toBe("01 00 პარლამენტი");
  });
});

describe("classifier — older-year mappings", () => {
  it("maps the 2005 Economic Development ministry to economy", () => {
    expect(classifyAdminSpendingCategory(institutionRow(2005, "საქართველოს ეკონომიკური განვითარების სამინისტრო"))).toBe(
      "admin_spending.economy_sustainable_development",
    );
  });

  it("maps the standalone Refugees/IDP ministry (2005-2018) to health & social", () => {
    const refugees2005 = "საქართველოს ლტოლვილთა და განსახლების სამინისტრო";
    const idp2014 = "საქართველოს ოკუპირებული ტერიტორიებიდან იძულებით გადაადგილებულ პირთა, განსახლებისა და ლტოლვილთა სამინისტრო";

    expect(classifyAdminSpendingCategory(institutionRow(2005, refugees2005))).toBe("admin_spending.health_social_affairs");
    expect(classifyAdminSpendingCategory(institutionRow(2014, idp2014))).toBe("admin_spending.health_social_affairs");
    // The standalone ministry existed through 2018; those years route to health & social too (its
    // successor programs consolidated into the IDPs/Labour/Health super-ministry from 2019).
    expect(classifyAdminSpendingCategory(institutionRow(2017, idp2014))).toBe("admin_spending.health_social_affairs");
    expect(classifyAdminSpendingCategory(institutionRow(2018, idp2014))).toBe("admin_spending.health_social_affairs");
    // Boundary: from 2019 the standalone label no longer exists (institution 27 carries "დევნილ" and
    // is caught by the modern health rule instead); the standalone-label rule stops at 2018.
    expect(classifyAdminSpendingCategory(institutionRow(2019, idp2014))).toBe("admin_spending.other_costs");
  });

  it("maps the pre-2018 Environment & Natural Resources ministry (through 2017) to environment & agriculture", () => {
    const env2014 = "საქართველოს გარემოსა და ბუნებრივი რესურსების დაცვის სამინისტრო";
    expect(classifyAdminSpendingCategory(institutionRow(2014, env2014))).toBe("admin_spending.environment_agriculture");
    // The old naming existed through 2017 and routes to environment & agriculture (from 2018 the
    // ministry merged with agriculture under "გარემოს დაცვისა", caught by the modern rule).
    expect(classifyAdminSpendingCategory(institutionRow(2017, env2014))).toBe("admin_spending.environment_agriculture");
    // Guard: the fix must not swallow the 2013 Energy & Natural Resources ministry (stays economy).
    expect(classifyAdminSpendingCategory(institutionRow(2013, "საქართველოს ენერგეტიკისა და ბუნებრივი რესურსების სამინისტრო"))).toBe(
      "admin_spending.economy_sustainable_development",
    );
  });

  it("books the 2005 Culture ministry's Youth Affairs Department to education/science/youth", () => {
    expect(classifyAdminSpendingCategory(institutionRow(2005, "ახალგაზრდობის საქმეთა დეპარტამენტი"))).toBe(
      "admin_spending.education_science_youth",
    );
    // The 2005 Sport Department routes to sport; the culture remainder to culture.
    expect(classifyAdminSpendingCategory(institutionRow(2005, "სპორტის დეპარტამენტი"))).toBe("admin_spending.sport");
    expect(classifyAdminSpendingCategory(institutionRow(2005, "საქართველოს კულტურის და ძეგლთა დაცვის სამინისტრო"))).toBe(
      "admin_spending.culture",
    );
  });
});

describe("2005 ministry-total extraction", () => {
  const rows = extractAdminSpending2005Rows();
  const totals = categoryTotals(rows, 2005);
  const totalRow = rows.find((row) => row.isTotal);

  it("reconciles category totals to the official 2005 payments total (with undistributed residual)", () => {
    const categorySum = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
    const sourceTotal = Math.round((totalRow?.actualThousandGel ?? 0) * 1000);
    // The workbook itemises 2,609,022.9k by ministry; the extractor reconciles to the official
    // 2005 payments total (2,626,507.3k) by booking the ~17.5M undistributed residual to Other costs.
    expect(sourceTotal).toBe(2_626_507_300);
    expect(Math.abs(categorySum - sourceTotal)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
  });

  it("splits the bundled Finance line into debt service, finance-proper and transfers/other", () => {
    // 574,203.3k = debt 282,040.4 + finance-proper 113,362.1 + transfers/other 178,800.8.
    expect(totals.debt_service).toBe(282_040_400);
    expect(totals.finance).toBe(113_362_100);
  });

  it("routes 2005-era ministry names to the right categories", () => {
    // Health & social absorbs the standalone Refugees ministry (631,807.8 + 61,866.6).
    expect(totals.health_social_affairs).toBe(693_674_400);
    // Economy absorbs the Economic Development ministry (230,349.1 energy + 183,969.4 econ-dev).
    expect(totals.economy_sustainable_development).toBe(414_318_500);
  });

  it("splits the combined Culture/Sport ministry using the 2005 annual execution report", () => {
    // Workbook line 33 00 (34,433.2k) split per the annual report: sport 6,915.1k, youth 2,887.9k
    // (booked to education), culture remainder 24,630.2k.
    expect(totals.culture).toBe(24_630_200);
    expect(totals.sport).toBe(6_915_100);
    // Education/science/youth = the Education ministry (80,946.8k) + the Youth Affairs dept (2,887.9k).
    expect(totals.education_science_youth).toBe(83_834_700);
  });

  it("is still ministry-totals only — no drill-down programs for 2005", () => {
    const programFacts = generateAdminSpendingFacts(rows).filter(
      (fact) => fact.level === "major_program" && fact.year === 2005,
    );
    expect(programFacts).toHaveLength(0);
  });
});

describe("2004 ministry-total extraction", () => {
  const rows = extractAdminSpendingOfficialRows().filter((row) => row.year === 2004);
  const officialInstitutionRows = rows.filter((row) => row.isCodedRow && !row.isTotal);
  const syntheticSplitRows = rows.filter((row) => !row.isCodedRow && !row.isTotal);
  const totalRow = rows.find((row) => row.isTotal);

  it("derives the reviewed institution handoff from annex pages 2-231", async () => {
    const pdf = await readPdfTextPages(
      "../../docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2004-annual-execution-annex.pdf",
    );
    const parsed = parseAdminSpending2004Pages(pdf.pages);
    const reviewRows = await readCsvRecords(
      "../../data/mappings/review/admin-spending-institution-review-2004.csv",
    );

    expect(parsed).toHaveLength(47);
    expect(parsed[0]).toMatchObject({ code: "01 00", pageNumber: 2, actualThousandGel: 14_603.4 });
    expect(parsed.find((row) => row.code === "21 00")).toMatchObject({ pageNumber: 16, actualThousandGel: 535.9 });
    expect(parsed.at(-1)).toMatchObject({ code: "47 00", pageNumber: 230, actualThousandGel: 228.5 });
    expect(
      parsed.map((row) => ({
        code: row.code,
        label: row.labelKa,
        approved: row.approvedPlanThousandGel,
        actual: row.actualThousandGel,
        page: row.pageNumber,
      })),
    ).toEqual(
      reviewRows.map((row) => ({
        code: row.official_code,
        label: row.official_label_ka,
        approved: Number(row.approved_plan_thousand_gel),
        actual: Number(row.actual_thousand_gel),
        page: Number(row.source_page),
      })),
    );
  }, 30_000);

  it("preserves all 47 official institutions with source-page provenance and the printed rounding", () => {
    const defenceRow = officialInstitutionRows.find((row) => row.code === "26 00");

    expect(officialInstitutionRows).toHaveLength(47);
    expect(new Set(officialInstitutionRows.map((row) => row.code)).size).toBe(47);
    expect(officialInstitutionRows.every((row) => row.isLeafCode)).toBe(true);
    expect(officialInstitutionRows.every((row) => row.institutionCode === row.code)).toBe(true);
    expect(officialInstitutionRows.every((row) => row.rowNumber >= 2 && row.rowNumber <= 231)).toBe(true);
    expect(defenceRow?.actualThousandGel).toBe(172_009.0);
    expect(totalRow?.actualThousandGel).toBe(1_930_210.3);
    expect(officialInstitutionRows.reduce((sum, row) => sum + row.actualThousandGel, 0)).toBeCloseTo(1_930_210.4, 1);
  });

  it("keeps source-backed classification splits distinct and exactly additive to their official parents", () => {
    const splitTotalFor = (parentCode: string) =>
      syntheticSplitRows
        .filter((row) => row.parentCode === parentCode)
        .reduce((sum, row) => sum + row.actualThousandGel, 0);
    const sourceAmountFor = (code: string) =>
      officialInstitutionRows.find((row) => row.code === code)?.actualThousandGel;

    expect(syntheticSplitRows).toHaveLength(5);
    expect(syntheticSplitRows.every((row) => row.isLeafCode && row.code?.startsWith("synthetic:"))).toBe(true);
    expect(syntheticSplitRows.every((row) => row.institutionCode === row.parentCode)).toBe(true);
    expect(Object.fromEntries(syntheticSplitRows.map((row) => [row.code, row.rowNumber]))).toEqual({
      "synthetic:22_00:finance": 16,
      "synthetic:22_00:debt": 19,
      "synthetic:22_00:transfers": 20,
      "synthetic:30_00:culture": 115,
      "synthetic:30_00:sport": 116,
    });
    expect(splitTotalFor("22 00")).toBe(sourceAmountFor("22 00"));
    expect(splitTotalFor("30 00")).toBe(sourceAmountFor("30 00"));
  });

  it("does not suppress the same official code in another year", () => {
    const nextYearFinance = {
      ...institutionRow(2005, "საქართველოს ფინანსთა სამინისტრო"),
      code: "22 00",
      institutionCode: "22 00",
    };
    const facts = generateAdminSpendingFacts([...rows, nextYearFinance]);

    expect(
      facts.find((fact) => fact.year === 2005 && fact.itemId === "admin_spending.finance")?.amountGel,
    ).toBe(100_000);
  });

  it("reconciles the category facts within GEL 100 and emits no 2004 programs", () => {
    const facts = generateAdminSpendingFacts(rows);
    const categoryFacts = facts.filter((fact) => fact.level === "admin_category" && fact.year === 2004);
    const programFacts = facts.filter((fact) => fact.level === "major_program" && fact.year === 2004);
    const categorySum = categoryFacts.reduce((sum, fact) => sum + fact.amountGel, 0);
    const sourceTotal = Math.round((totalRow?.actualThousandGel ?? 0) * 1000);

    expect(Math.abs(categorySum - sourceTotal)).toBe(100);
    expect(programFacts).toHaveLength(0);
  });

  it("reviews every official code exactly once against an existing admin category", async () => {
    const reviewRows = await readCsvRecords(
      "../../data/mappings/review/admin-spending-institution-review-2004.csv",
    );
    const reviewedCategoryIds = new Set(ADMIN_SPENDING_CATEGORIES.map((category) => category.id));

    expect(reviewRows).toHaveLength(47);
    expect(reviewRows.map((row) => row.official_code).sort()).toEqual(
      officialInstitutionRows.map((row) => row.code).sort(),
    );
    expect(new Set(reviewRows.map((row) => row.official_code)).size).toBe(47);
    expect(reviewRows.every((row) => reviewedCategoryIds.has(row.admin_spending_category_id))).toBe(true);
    expect(reviewRows.every((row) => row.mapping_confidence && row.mapping_notes)).toBe(true);
    expect(
      reviewRows.every((reviewRow) => {
        const sourceRow = officialInstitutionRows.find((row) => row.code === reviewRow.official_code);
        return sourceRow && classifyAdminSpendingCategory(sourceRow) === reviewRow.admin_spending_category_id;
      }),
    ).toBe(true);
  });
});

describe("2014 extraction (from the 2015 workbook col_4)", () => {
  const rows = extractAdminSpending2014Rows();
  const totals = categoryTotals(rows, 2014);
  const totalRow = rows.find((row) => row.isTotal);

  it("reconciles to the official 2014 payments total", () => {
    const categorySum = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
    const sourceTotal = Math.round((totalRow?.actualThousandGel ?? 0) * 1000);
    expect(sourceTotal).toBe(9_009_812_200);
    expect(Math.abs(categorySum - sourceTotal)).toBeLessThanOrEqual(ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL);
  });

  it("splits debt service out of the state-wide-payments line and maps the IDP ministry to health", () => {
    expect(totals.debt_service).toBe(779_134_400);
    // Health & social includes the standalone IDP ministry (~2,642,784 + ~49,364; leaf-aggregated).
    expect(totals.health_social_affairs).toBe(2_692_148_600);
  });

  it("maps the Environment & Natural Resources ministry into environment & agriculture", () => {
    // Agriculture ministry (265,756.0k) + the environment ministry (32,385.1k) previously in Other.
    expect(totals.environment_agriculture).toBe(298_141_200);
  });
});
