import { describe, expect, it } from "vitest";
import { generateRevenueFacts } from "../../../lib/data/realRevenue/generateFacts";
import type { OfficialRevenueRow } from "../../../lib/data/realRevenue/types";

function row(labelKa: string, actualThousandGel: number): OfficialRevenueRow {
  return {
    year: 2025,
    sourceId: "source.mof_2025_tavi1_actual",
    workbookPath: "docs/Raw Data/2025.xlsx",
    sheetName: "tavi I",
    rowNumber: 2,
    labelKa,
    approvedPlanThousandGel: actualThousandGel,
    revisedPlanThousandGel: actualThousandGel,
    actualThousandGel,
    executionPercent: 1,
    section: "revenues",
  };
}

describe("generateRevenueFacts", () => {
  it("generates source-backed aggregate revenue facts", () => {
    const facts = generateRevenueFacts([
      row("შემოსავლები", 1000),
      row("გადასახადები", 800),
      row("გრანტები", 50),
      row("სხვა შემოსავლები", 150),
    ]);

    expect(facts).toEqual([
      expect.objectContaining({ item_id: "revenue.taxes_total", amount_gel: "800000", mapping_confidence: "" }),
      expect.objectContaining({ item_id: "revenue.grants", amount_gel: "50000", mapping_confidence: "" }),
      expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "150000", mapping_confidence: "" }),
    ]);
  });

  it("throws when a required revenue source row is missing", () => {
    expect(() => generateRevenueFacts([row("შემოსავლები", 1000), row("გადასახადები", 800)])).toThrow(
      "Missing required revenue row for 2025: გრანტები",
    );
  });
});
