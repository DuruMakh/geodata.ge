import { describe, expect, it } from "vitest";
import { REVENUE_SOURCE_YEARS } from "../../../lib/data/coverage";
import type { RealRevenueFactCsvRow } from "../../../lib/data/realRevenue/generateFacts";
import type { OfficialRevenueRow } from "../../../lib/data/realRevenue/types";
import { validateRealRevenueFacts } from "../../../lib/data/realRevenue/validateRealRevenue";

const officialRows: OfficialRevenueRow[] = [
  {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 2,
    sourceCode: "1",
    labelKa: "revenues",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: 1000,
    executionPercent: null,
    section: "revenues",
    consolidatedActualGel: 1300000,
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 3,
    sourceCode: "1.3.3",
    labelKa: "internal grants",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: 75,
    executionPercent: null,
    section: "revenues",
    consolidatedActualGel: 75000,
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 4,
    sourceCode: "1.4.1.1.3",
    labelKa: "internal other revenue",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: 25,
    executionPercent: null,
    section: "revenues",
    consolidatedActualGel: 25000,
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 5,
    sourceCode: "31",
    labelKa: "non-financial asset decrease",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: 60,
    executionPercent: null,
    section: "non_financial_assets",
    consolidatedActualGel: 60000,
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 6,
    sourceCode: "32",
    labelKa: "financial asset decrease",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: 40,
    executionPercent: null,
    section: "financial_assets",
    consolidatedActualGel: 40000,
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 7,
    sourceCode: "33",
    labelKa: "increase in liabilities",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: 200,
    executionPercent: null,
    section: "liabilities",
    consolidatedActualGel: 200000,
  },
  {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 8,
    sourceCode: "41",
    labelKa: "opening balance",
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel: 300,
    executionPercent: null,
    section: "other",
    consolidatedActualGel: 300000,
  },
];

function fact(itemId: string, amountGel: string): RealRevenueFactCsvRow {
  return {
    year: 2025,
    side: "revenue",
    item_id: itemId,
    amount_gel: amountGel,
    basis: "actual",
    source_id: "source.mof_2025_revenue_form1_pdf",
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "Source row",
  };
}

const validFacts = [
  fact("revenue.vat", "400000"),
  fact("revenue.income_tax", "250000"),
  fact("revenue.profit_tax", "100000"),
  fact("revenue.excise_tax", "110000"),
  fact("revenue.import_tax", "40000"),
  fact("revenue.property_tax", "50000"),
  fact("revenue.other_taxes", "50000"),
  fact("revenue.grants", "125000"),
  fact("revenue.other_revenue", "75000"),
  fact("revenue.asset_decrease", "100000"),
  fact("revenue.increase_liabilities", "200000"),
];

describe("validateRealRevenueFacts", () => {
  it("reports Form #1 validation coverage for 2005-2025 without the separate 2004 handoff", () => {
    const rows: OfficialRevenueRow[] = REVENUE_SOURCE_YEARS.map((year) => ({
      year,
      sourceId: `source.mof_${year}_revenue_form1_pdf`,
      workbookPath: `docs/Raw Data/Revenue/${year}-jan-dec-consolidated-revenue.pdf`,
      sheetName: "form #1",
      rowNumber: 1,
      sourceCode: "1",
      labelKa: "revenue total",
      approvedPlanThousandGel: null,
      revisedPlanThousandGel: null,
      actualThousandGel: 1000,
      executionPercent: null,
      section: "revenues",
      consolidatedActualGel: 1000000,
    }));
    const facts: RealRevenueFactCsvRow[] = REVENUE_SOURCE_YEARS.map((year) => ({
      year,
      side: "revenue",
      item_id: "revenue.other_revenue",
      amount_gel: "1000000",
      basis: "actual",
      source_id: `source.mof_${year}_revenue_form1_pdf`,
      official_institution: "",
      official_program: "",
      official_subprogram: "",
      public_spending_field_id: "",
      mapping_confidence: "",
      mapping_notes: "test row",
    }));

    const report = validateRealRevenueFacts(rows, facts, REVENUE_SOURCE_YEARS);

    expect(report.importLabel).toBe("real-revenue-2005-2025");
    expect(report.years).toEqual(REVENUE_SOURCE_YEARS);
    expect(report.years).not.toContain(2004);
  });
  it("passes when detailed generated facts reconcile to final receipts without opening balance rows", () => {
    const report = validateRealRevenueFacts(officialRows, validFacts);

    expect(report.reconciliationStatusByYear).toEqual({ 2025: "passed" });
    expect(report.officialRevenueTotalGelByYear).toEqual({ 2025: 1200000 });
    expect(report.assetDecreaseGelByYear).toEqual({ 2025: 100000 });
    expect(report.liabilitiesIncreaseGelByYear).toEqual({ 2025: 200000 });
    expect(report.finalReceiptsTotalGelByYear).toEqual({ 2025: 1500000 });
    expect(report.generatedReceiptsTotalGelByYear).toEqual({ 2025: 1500000 });
    expect(report.warnings).toEqual([]);
  });


  it("passes old 2006 revenue codes without modern internal transfer rows", () => {
    const oldRows: OfficialRevenueRow[] = [
      { ...officialRows[0], year: 2006, sourceCode: "010000000000", consolidatedActualGel: 3151976058 },
      { ...officialRows[0], year: 2006, sourceCode: "020000000000", consolidatedActualGel: 519108357 },
      { ...officialRows[0], year: 2006, sourceCode: "030000000000", section: "non_financial_assets", consolidatedActualGel: 564458259 },
      { ...officialRows[0], year: 2006, sourceCode: "040000000000", consolidatedActualGel: 131872214 },
      { ...officialRows[0], year: 2006, sourceCode: "050000000000", section: "liabilities", consolidatedActualGel: 170501437 },
    ];
    const oldFacts: RealRevenueFactCsvRow[] = [
      fact("revenue.vat", "1332651137"),
      fact("revenue.income_tax", "385945388"),
      fact("revenue.profit_tax", "341070394"),
      fact("revenue.excise_tax", "335622390"),
      fact("revenue.import_tax", "132366209"),
      fact("revenue.property_tax", "85820217"),
      fact("revenue.other_taxes", "538500324"),
      fact("revenue.grants", "131872214"),
      fact("revenue.other_revenue", "519108357"),
      fact("revenue.asset_decrease", "564458259"),
      fact("revenue.increase_liabilities", "170501437"),
    ].map((candidate) => ({ ...candidate, year: 2006, source_id: "source.mof_2006_revenue_form1_pdf" }));

    const report = validateRealRevenueFacts(oldRows, oldFacts, [2006]);

    expect(report.reconciliationStatusByYear[2006]).toBe("passed");
    expect(report.generatedReceiptsTotalGelByYear?.[2006]).toBe(4537916326);
    expect(report.warnings).toEqual([]);
  });

  it("passes when compact internal grant rows are absent and grant children reconcile", () => {
    const compactRows: OfficialRevenueRow[] = [
      { ...officialRows[0], sourceCode: "1", consolidatedActualGel: 1300000 },
      { ...officialRows[0], sourceCode: "13", consolidatedActualGel: 200000 },
      { ...officialRows[0], sourceCode: "131", consolidatedActualGel: 180000 },
      { ...officialRows[0], sourceCode: "132", consolidatedActualGel: 20000 },
      { ...officialRows[2], sourceCode: "14111" },
      officialRows[3],
      officialRows[4],
      officialRows[5],
    ];
    const facts = validFacts.map((candidate) => candidate.item_id === "revenue.grants"
      ? { ...candidate, amount_gel: "200000" }
      : candidate);

    const report = validateRealRevenueFacts(compactRows, facts, [2025]);

    expect(report.reconciliationStatusByYear[2025]).toBe("passed");
    expect(report.internalGrantsRemovedGelByYear?.[2025]).toBe(0);
    expect(report.finalReceiptsTotalGelByYear?.[2025]).toBe(1575000);
    expect(report.warnings).toEqual([]);
  });
  it("fails when generated facts do not reconcile to final receipts", () => {
    const report = validateRealRevenueFacts(officialRows, [fact("revenue.vat", "900000")]);

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings[0]).toContain("2025 receipts reconciliation mismatch");
  });

  it("fails when a configured year has no official revenue total row", () => {
    const report = validateRealRevenueFacts(
      [
        {
          ...officialRows[0],
          sourceCode: "2",
          section: "expenditures",
        },
      ],
      [],
      [2025],
    );

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings).toContain("2025 missing official revenue total row");
  });

  it("fails when a configured year is missing internal transfer rows", () => {
    const report = validateRealRevenueFacts([officialRows[0]], validFacts, [2025]);

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        "2025 missing internal revenue flow row: 1.3.3",
        "2025 missing internal revenue flow row: 1.4.1.1.3",
      ]),
    );
  });

  it("fails when a configured year is missing receipt source rows", () => {
    const report = validateRealRevenueFacts(
      officialRows.filter((candidate) => candidate.sourceCode !== "32"),
      validFacts,
      [2025],
    );

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings).toContain("2025 missing receipt source row: 32");
  });

  it("fails when a configured year is missing generated revenue fact categories", () => {
    const report = validateRealRevenueFacts(officialRows, validFacts.filter((candidate) => candidate.item_id !== "revenue.asset_decrease"), [2025]);

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings).toContain("2025 missing generated revenue fact: revenue.asset_decrease");
  });
});
