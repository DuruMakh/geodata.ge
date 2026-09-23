import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildDeficitWorkbookExportModel } from "../../lib/explorer/deficitWorkbook";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import type { ServedGeneralGovernmentBalanceFact } from "../../lib/servedRows";

const facts: ServedGeneralGovernmentBalanceFact[] = [
  { year: 2025, generalGovernmentBalancePctGdp: -1.455, generalGovernmentBalanceGel: -1_526_000_000, status: "actual", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
  { year: 2026, generalGovernmentBalancePctGdp: -2.327, generalGovernmentBalanceGel: -2_672_000_000, status: "projection", sourceId: "source.imf", lastReviewedAt: "2026-09-04" },
];

describe("general-government deficit workbook", () => {
  it("retains signed GEL values, percentage values and projections in English", async () => {
    const presentation = await getPresentation("en", ["workbook"], ["deficit.general_government.balance"]);
    const input = { facts, range: { start: 2025, end: 2026 }, percentage: true, sources: [], siteOrigin: "https://fiscal.ge" };
    const ka = buildDeficitWorkbookExportModel(input);
    const en = buildDeficitWorkbookExportModel(input, presentation);
    expect(en.analysis.rows.map(row => [row[0], row[3], row[5]])).toEqual(ka.analysis.rows.map(row => [row[0], row[3], row[5]]));
    expect(en.analysis.rows.map(row => row[3])).toEqual([-1_526_000_000, -2_672_000_000]);
    expect(en.analysis.rows.map(row => row[4])).toEqual(["Actual", "Forecast"]);
    expect(en.sheetNames).toEqual(["Summary", "Data", "Sources"]);
    expect(JSON.stringify(en)).not.toMatch(/\p{Script=Georgian}/u);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(en));
    const data = workbook.getWorksheet("Data")!;
    expect(data.getCell("D2").value).toBe(-1_526_000_000);
    expect(data.getCell("D2").type).toBe(ExcelJS.ValueType.Number);
    expect(data.getCell("F2").value).toBe(-0.01455);
  });

  it("exports the active percentage range with actual and projection statuses", () => {
    const model = buildDeficitWorkbookExportModel({
      facts,
      range: { start: 2025, end: 2026 },
      percentage: true,
      sources: [{
        years: [2025, 2026],
        title: "IMF WEO",
        organization: "IMF",
        downloadHref: "https://data.imf.org/source.xlsx",
        retrievedAt: "2026-09-04",
      }],
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.filename).toBe("fiscal-general-government-deficit-2025-2026.xlsx");
    expect(model.readable.unitLabel).toBe("% მშპ-ში");
    expect(model.analysis.rows).toEqual([
      [2025, "ზოგადი მთავრობის ბალანსი", "ზოგადი მთავრობის ბალანსი", -1_526_000_000, "ფაქტი", -0.01455],
      [2026, "ზოგადი მთავრობის ბალანსი", "ზოგადი მთავრობის ბალანსი", -2_672_000_000, "პროგნოზი", -0.02327],
    ]);
    expect(model.sources).toHaveLength(1);
  });

  it("drops the relative change column from the percentage export only", () => {
    const input = { facts, range: { start: 2025, end: 2026 }, sources: [], siteOrigin: "https://fiscal.ge" };
    expect(buildDeficitWorkbookExportModel({ ...input, percentage: true }).readable.showChangeColumn).toBe(false);
    expect(buildDeficitWorkbookExportModel({ ...input, percentage: false }).readable.showChangeColumn).toBeUndefined();
  });
});
