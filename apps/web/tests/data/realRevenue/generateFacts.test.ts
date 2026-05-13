import { describe, expect, it } from "vitest";
import { generateLegacyAggregateRevenueFacts, generateRevenueFacts } from "../../../lib/data/realRevenue/generateFacts";
import type { OfficialRevenueRow } from "../../../lib/data/realRevenue/types";

function row(
  sourceCode: string,
  labelKa: string,
  actualThousandGel: number,
  consolidatedActualGel = actualThousandGel * 1000,
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
    section: "revenues",
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
    ]);
    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item_id: "revenue.vat", amount_gel: "400000" }),
        expect.objectContaining({ item_id: "revenue.grants", amount_gel: "125000" }),
        expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "75000" }),
      ]),
    );
    expect(facts.reduce((sum, fact) => sum + Number(fact.amount_gel), 0)).toBe(1200000);
  });

  it("generates legacy aggregate facts for workbook/PDF comparisons", () => {
    const facts = generateLegacyAggregateRevenueFacts(rows);

    expect(facts).toEqual([
      expect.objectContaining({ item_id: "revenue.taxes_total", amount_gel: "800000" }),
      expect.objectContaining({ item_id: "revenue.grants", amount_gel: "50000" }),
      expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "150000" }),
    ]);
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
