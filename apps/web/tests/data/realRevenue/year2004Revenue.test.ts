import { describe, expect, it } from "vitest";
import { YEAR_2004_REVENUE_FACTS } from "../../../lib/data/realRevenue/year2004Revenue";

describe("reviewed 2004 revenue handoff", () => {
  it("publishes the ten source-backed categories and excludes unavailable liabilities", () => {
    expect(YEAR_2004_REVENUE_FACTS).toEqual([
      expect.objectContaining({ item_id: "revenue.vat", amount_gel: "628158100" }),
      expect.objectContaining({ item_id: "revenue.income_tax", amount_gel: "268649900" }),
      expect.objectContaining({ item_id: "revenue.profit_tax", amount_gel: "161589700" }),
      expect.objectContaining({ item_id: "revenue.excise_tax", amount_gel: "163771500" }),
      expect.objectContaining({ item_id: "revenue.import_tax", amount_gel: "100138000" }),
      expect.objectContaining({ item_id: "revenue.property_tax", amount_gel: "29107500" }),
      expect.objectContaining({ item_id: "revenue.other_taxes", amount_gel: "459781200" }),
      expect.objectContaining({ item_id: "revenue.grants", amount_gel: "124704300" }),
      expect.objectContaining({ item_id: "revenue.other_revenue", amount_gel: "274395800" }),
      expect.objectContaining({ item_id: "revenue.asset_decrease", amount_gel: "72739800" }),
    ]);
    expect(YEAR_2004_REVENUE_FACTS).toHaveLength(10);
    expect(YEAR_2004_REVENUE_FACTS.some((fact) => fact.item_id === "revenue.increase_liabilities")).toBe(false);
    expect(YEAR_2004_REVENUE_FACTS.reduce((sum, fact) => sum + Number(fact.amount_gel), 0)).toBe(2_283_035_800);
    expect(YEAR_2004_REVENUE_FACTS.every((fact) => fact.year === 2004)).toBe(true);
    expect(YEAR_2004_REVENUE_FACTS.every((fact) => fact.source_id === "source.mof_2004_revenue_annual_execution_report")).toBe(true);
  });
});
