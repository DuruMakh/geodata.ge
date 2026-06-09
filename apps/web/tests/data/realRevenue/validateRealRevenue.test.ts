import { describe, expect, it } from "vitest";
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
