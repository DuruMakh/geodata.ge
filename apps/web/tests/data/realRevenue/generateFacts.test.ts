import { describe, expect, it } from "vitest";
import { generateLegacyAggregateRevenueFacts, generateRevenueFacts } from "../../../lib/data/realRevenue/generateFacts";
import type { OfficialRevenueRow } from "../../../lib/data/realRevenue/types";

function row(
  sourceCode: string,
  labelKa: string,
  actualThousandGel: number,
  consolidatedActualGel = actualThousandGel * 1000,
  section: OfficialRevenueRow["section"] = "revenues",
): OfficialRevenueRow {
  return {
    year: 2025,
    sourceId: "source.mof_2025_revenue_form1_pdf",
    workbookPath: "docs/Raw Data/2025.pdf",
    sheetName: "form #1",
    rowNumber: 2,
    sourceCode,
    labelKa,
    approvedPlanThousandGel: null,
    revisedPlanThousandGel: null,
    actualThousandGel,
    executionPercent: null,
    section,
    consolidatedActualGel,
  };
}

const rows = [
  row("1", "revenues", 1000, 1300000),
  row("1.1", "taxes", 800, 1000000),
  row("1.1.4.1.1", "vat", 300, 400000),
  row("1.1.1.1.1", "income tax", 200, 250000),
  row("1.1.1.2.1", "profit tax", 100, 100000),
  row("1.1.4.2", "excise", 90, 110000),
  row("1.1.5.1", "import tax", 40, 40000),
  row("1.1.3", "property tax", 20, 50000),
  row("1.1.6", "other taxes", 50, 50000),
  row("1.3", "grants", 50, 200000),
  row("1.3.3", "internal grants", 10, 75000),
  row("1.4", "other revenue", 150, 100000),
  row("1.4.1.1.3", "internal other revenue", 5, 25000),
  row("31", "non-financial asset decrease", 60, 60000, "non_financial_assets"),
  row("32", "financial asset decrease", 40, 40000, "financial_assets"),
  row("33", "increase in liabilities", 200, 200000, "liabilities"),
  row("41", "opening balance", 300, 300000, "other"),
];

describe("generateRevenueFacts", () => {
  it("generates detailed source-backed revenue facts without the tax aggregate", () => {
    const facts = generateRevenueFacts(rows);

    expect(facts.map((fact) => fact.item_id)).toEqual([
      "revenue.vat",
      "revenue.income_tax",
      "revenue.profit_tax",
      "revenue.excise_tax",
      "revenue.import_tax",
      "revenue.property_tax",
      "revenue.other_taxes",
      "revenue.grants",
      "revenue.other_revenue",
      "revenue.asset_decrease",
      "revenue.increase_liabilities",
    ]);
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item_id: "revenue.vat", amount_gel: "400000" }),
        expect.objectContaining({
          item_id: "revenue.grants",
          amount_gel: "125000",
          mapping_notes: expect.stringContaining("net of Source row 1.3.3"),
        }),
        expect.objectContaining({
          item_id: "revenue.other_revenue",
          amount_gel: "75000",
          mapping_notes: expect.stringContaining("net of Source row 1.4.1.1.3"),
        }),
        expect.objectContaining({
          item_id: "revenue.asset_decrease",
          amount_gel: "100000",
          mapping_notes: expect.stringContaining("Source rows 31 + 32"),
        }),
        expect.objectContaining({
          item_id: "revenue.increase_liabilities",
          amount_gel: "200000",
          mapping_notes: expect.stringContaining("Source row 33"),
        }),
      ]),
    );
    expect(facts.reduce((sum, fact) => sum + Number(fact.amount_gel), 0)).toBe(1500000);
  });

  it("generates legacy aggregate facts for workbook/PDF comparisons", () => {
    const facts = generateLegacyAggregateRevenueFacts(rows);

    expect(facts).toEqual([
      expect.objectContaining({ item_id: "revenue.taxes_total", amount_gel: "800000" }),
      expect.objectContaining({ item_id: "revenue.grants", amount_gel: "50000" }),
      expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "150000" }),
    ]);
  });

  it("uses older numeric Treasury source codes when dotted source codes are absent", () => {
    const oldCodeRows = [
      row("1", "revenues", 1000, 1300000),
      row("11411", "\u02ab\u02ec\u02c0", 300, 400000),
      row("11111", "income tax", 200, 250000),
      row("11121", "profit tax", 100, 100000),
      row("1142", "excise", 90, 110000),
      row("1151", "import tax", 40, 40000),
      row("113", "property tax", 20, 50000),
      row("116", "other taxes", 50, 50000),
      row("13", "grants", 50, 200000),
      row("133", "internal grants", 10, 75000),
      row("14", "other revenue", 150, 100000),
      row("14111", "internal other revenue", 5, 25000),
      row("31", "non-financial asset decrease", 60, 60000, "non_financial_assets"),
      row("32", "financial asset decrease", 40, 40000, "financial_assets"),
      row("33", "increase in liabilities", 200, 200000, "liabilities"),
    ];

    const facts = generateRevenueFacts(oldCodeRows);

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: "revenue.vat",
          amount_gel: "400000",
          mapping_notes: "Source row 11411: დამატებული ღირებულების გადასახადი",
        }),
        expect.objectContaining({ item_id: "revenue.grants", amount_gel: "125000" }),
        expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "75000" }),
        expect.objectContaining({ item_id: "revenue.asset_decrease", amount_gel: "100000" }),
        expect.objectContaining({ item_id: "revenue.increase_liabilities", amount_gel: "200000" }),
      ]),
    );
    expect(facts.map((fact) => fact.mapping_notes).join("\n")).not.toMatch(/[\u02b0-\u02ff]/);
  });

  it("throws when a required detailed revenue source row is missing", () => {
    expect(() => generateRevenueFacts(rows.filter((candidate) => candidate.sourceCode !== "1.3"))).toThrow(
      "Missing required revenue row for 2025: 1.3",
    );
  });

  it("throws when an internal consolidation row is missing", () => {
    expect(() => generateRevenueFacts(rows.filter((candidate) => candidate.sourceCode !== "1.3.3"))).toThrow(
      "Missing required revenue row for 2025: 1.3.3",
    );
  });
});
