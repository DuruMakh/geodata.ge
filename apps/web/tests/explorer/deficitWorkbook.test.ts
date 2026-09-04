import { describe, expect, it } from "vitest";
import { buildDeficitWorkbookExportModel } from "../../lib/explorer/deficitWorkbook";
import type { ServedGeneralGovernmentBalanceFact } from "../../lib/servedRows";

const facts: ServedGeneralGovernmentBalanceFact[] = [
  { year: 2025, generalGovernmentBalancePctGdp: -1.455, generalGovernmentBalanceGel: -1_526_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
  { year: 2026, generalGovernmentBalancePctGdp: -2.327, generalGovernmentBalanceGel: -2_672_000_000, status: "projection", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
];

describe("general-government deficit workbook", () => {
  it("exports the active percentage range with actual and projection statuses", () => {
    const model = buildDeficitWorkbookExportModel({
      facts,
      range: { start: 2025, end: 2026 },
      percentage: true,
      sources: [{
        years: [2025, 2026],
        titleKa: "IMF WEO",
        organizationKa: "IMF",
        downloadHref: "https://data.imf.org/source.xlsx",
        retrievedAt: "2026-09-04",
      }],
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.filename).toBe("fiscal-general-government-deficit-2025-2026.xlsx");
    expect(model.readable.unitLabelKa).toBe("% მშპ-ში");
    expect(model.analysis.rows).toEqual([
      [2025, "ზოგადი მთავრობის ბალანსი", "ზოგადი მთავრობის ბალანსი", -1_526_000_000, "ფაქტი", -0.01455],
      [2026, "ზოგადი მთავრობის ბალანსი", "ზოგადი მთავრობის ბალანსი", -2_672_000_000, "პროგნოზი", -0.02327],
    ]);
    expect(model.sources).toHaveLength(1);
  });
});
