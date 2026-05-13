import { describe, expect, it } from "vitest";
import type { RealRevenueFactCsvRow } from "../../../lib/data/realRevenue/generateFacts";
import type { OfficialRevenueRow } from "../../../lib/data/realRevenue/types";
import { validateRealRevenueFacts } from "../../../lib/data/realRevenue/validateRealRevenue";

const officialRows: OfficialRevenueRow[] = [
  {
    year: 2025,
    sourceId: "source.mof_2025_tavi1_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi I",
    rowNumber: 2,
    labelKa: "შემოსავლები",
    approvedPlanThousandGel: 1000,
    revisedPlanThousandGel: 1000,
    actualThousandGel: 1000,
    executionPercent: 1,
    section: "revenues",
  },
];

function fact(itemId: string, amountGel: string): RealRevenueFactCsvRow {
  return {
    year: 2025,
    side: "revenue",
    item_id: itemId,
    amount_gel: amountGel,
    basis: "actual",
    source_id: "source.mof_2025_tavi1_actual",
    official_institution: "",
    official_program: "",
    official_subprogram: "",
    public_spending_field_id: "",
    mapping_confidence: "",
    mapping_notes: "Source row",
  };
}

describe("validateRealRevenueFacts", () => {
  it("passes when generated facts reconcile to the official revenue total", () => {
    const report = validateRealRevenueFacts(officialRows, [
      fact("revenue.taxes_total", "800000"),
      fact("revenue.grants", "50000"),
      fact("revenue.other_revenue", "150000"),
    ]);

    expect(report.reconciliationStatusByYear).toEqual({ 2025: "passed" });
    expect(report.generatedRevenueTotalGelByYear).toEqual({ 2025: 1000000 });
    expect(report.warnings).toContain("tax_breakdown_missing_from_current_workbooks");
  });

  it("fails when generated facts do not reconcile to the official revenue total", () => {
    const report = validateRealRevenueFacts(officialRows, [fact("revenue.taxes_total", "900000")]);

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings[0]).toContain("2025 revenue reconciliation mismatch");
  });

  it("fails when a configured year has no official revenue total row", () => {
    const report = validateRealRevenueFacts(
      [
        {
          ...officialRows[0],
          labelKa: "ხარჯები",
          section: "expenditures",
        },
      ],
      [],
      [2025],
    );

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings).toContain("2025 missing official revenue total row");
  });

  it("fails when a configured year is missing generated revenue fact categories", () => {
    const report = validateRealRevenueFacts(officialRows, [fact("revenue.taxes_total", "800000")], [2025]);

    expect(report.reconciliationStatusByYear[2025]).toBe("failed");
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        "2025 missing generated revenue fact: revenue.grants",
        "2025 missing generated revenue fact: revenue.other_revenue",
      ]),
    );
  });
});
