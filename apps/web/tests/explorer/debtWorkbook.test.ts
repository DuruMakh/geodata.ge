import { describe, expect, it } from "vitest";
import { buildDebtWorkbookExportModel } from "../../lib/explorer/debtWorkbook";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import type { ServedGovernmentDebtFact, ServedNationalGdpFact } from "../../lib/servedRows";

const facts: ServedGovernmentDebtFact[] = [
  { year: 2013, family: "stock", seriesId: "debt.stock.total", value: 8_000_000_000, valueKind: "amount_gel", status: "actual", sourceId: "mof_public_debt_bulletin_n13", snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2014, family: "stock", seriesId: "debt.stock.total", value: 10_000_000_000, valueKind: "amount_gel", status: "actual", sourceId: "mof_public_debt_bulletin_n13", snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2013, family: "stock", seriesId: "debt.stock.domestic", value: 2_000_000_000, valueKind: "amount_gel", status: "actual", sourceId: "mof_public_debt_bulletin_n13", snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2014, family: "stock", seriesId: "debt.stock.domestic", value: 2_500_000_000, valueKind: "amount_gel", status: "actual", sourceId: "mof_public_debt_bulletin_n13", snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2025, family: "service", seriesId: "debt.service.total", value: 4_000_000_000, valueKind: "amount_gel", status: "actual", sourceId: "mof_public_debt_bulletin_n25", snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2026, family: "service", seriesId: "debt.service.total", value: 5_000_000_000, valueKind: "amount_gel", status: "projection_existing_portfolio", sourceId: "mof_public_debt_bulletin_n25", snapshotDate: "2025-12-31", lastReviewedAt: "2026-09-01" },
  { year: 2019, family: "rate", seriesId: "debt.rate.total", value: 3.2, valueKind: "percent", status: "actual", sourceId: "mof_monthly_debt_report_2026_07", snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2019, family: "rate", seriesId: "debt.rate.external", value: null, valueKind: "percent", status: "not_available", sourceId: "mof_debt_strategy_2022_2025", snapshotDate: null, lastReviewedAt: "2026-09-01" },
  { year: 2021, family: "rate", seriesId: "debt.rate.external", value: 0.95, valueKind: "percent", status: "actual", sourceId: "mof_debt_strategy_2023_2026", snapshotDate: null, lastReviewedAt: "2026-09-01" },
];

const gdpFacts: ServedNationalGdpFact[] = [
  { year: 2013, gdpCurrentPricesGel: 16_000_000_000, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "gdp" },
  { year: 2014, gdpCurrentPricesGel: 20_000_000_000, accountingStandard: "sna_2008", status: "final_as_published", sourceId: "gdp" },
];

const debtSources: WorkbookPublicSource[] = [
  {
    years: [2013, 2014, 2025, 2026],
    titleKa: "სახელმწიფო ვალის სტატისტიკური ბიულეტენი",
    organizationKa: "საქართველოს ფინანსთა სამინისტრო",
    downloadHref: "/downloads/methodology/debt/files/2013-2030/public-debt-bulletin-n25.pdf",
    retrievedAt: "2026-09-01",
  },
  {
    years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    titleKa: "მთავრობის ვალის ყოველთვიური ანგარიში",
    organizationKa: "საქართველოს ფინანსთა სამინისტრო",
    downloadHref: "/downloads/methodology/debt/files/2015-2025/monthly-debt-report-2026-07.pdf",
    retrievedAt: "2026-09-01",
  },
];

const gdpSources: WorkbookPublicSource[] = [{
  years: [2013, 2014],
  titleKa: "მშპ მიმდინარე ფასებში — SNA 2008",
  organizationKa: "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)",
  downloadHref: "https://www.geostat.ge/gdp.xlsx",
  retrievedAt: "2026-08-13",
}];

describe("Debt workbook adapter", () => {
  it("maps the active stock selection, range, GDP measure and existing three-sheet contract", () => {
    const model = buildDebtWorkbookExportModel({
      facts,
      gdpFacts,
      family: "stock",
      selectedIds: ["debt.stock.total", "debt.stock.domestic"],
      range: { start: 2013, end: 2014 },
      shareOfGdp: true,
      sources: debtSources,
      gdpSources,
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.filename).toBe("fiscal-government-debt-stock-2013-2014.xlsx");
    expect(model.sheetNames).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
    expect(model.readable.years).toEqual([2013, 2014]);
    expect(model.readable.unitLabelKa).toBe("% მშპ-ში");
    expect(model.readable.rows.map((row) => [row.labelKa, row.valuesByYear])).toEqual([
      ["მთლიანი ვალი", { 2013: 0.5, 2014: 0.5 }],
      ["საშინაო ვალი", { 2013: 0.125, 2014: 0.125 }],
    ]);
    expect(model.analysis.headers).toEqual(["წელი", "მთავარი ჯგუფი", "კატეგორია", "თანხა (₾)", "სტატუსი", "მშპ-ის წილი (%)"]);
    expect(model.sources.map((source) => source.titleKa)).toEqual([
      "სახელმწიფო ვალის სტატისტიკური ბიულეტენი",
      "მშპ მიმდინარე ფასებში — SNA 2008",
    ]);
  });

  it("exports rates as percentages with exact gaps and no invented GEL amount", () => {
    const model = buildDebtWorkbookExportModel({
      facts,
      gdpFacts: [],
      family: "rate",
      selectedIds: ["debt.rate.external"],
      range: { start: 2019, end: 2021 },
      shareOfGdp: false,
      sources: debtSources,
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.readable.unitLabelKa).toBe("%");
    expect(model.readable.years).toEqual([2019, 2021]);
    expect(model.readable.rows[0]?.valuesByYear).toEqual({ 2019: null, 2021: 0.0095 });
    expect(model.analysis.headers).toEqual(["წელი", "მთავარი ჯგუფი", "კატეგორია", "თანხა (₾)", "სტატუსი", "საპროცენტო განაკვეთი (%)"]);
    expect(model.analysis.rows).toEqual([
      [2019, "საპროცენტო განაკვეთი", "საგარეო განაკვეთი", null, "არ არის ხელმისაწვდომი", null],
      [2021, "საპროცენტო განაკვეთი", "საგარეო განაკვეთი", null, "ფაქტი", 0.0095],
    ]);
  });

  it("marks existing-portfolio forecast rows and keeps validated source links", () => {
    const model = buildDebtWorkbookExportModel({
      facts,
      gdpFacts: [],
      family: "service",
      selectedIds: ["debt.service.total"],
      range: { start: 2025, end: 2026 },
      shareOfGdp: false,
      sources: debtSources,
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.readable.subtitleKa).toBe("2025–2026 · ფაქტი და პროგნოზი · მლრდ ₾");
    expect(model.analysis.rows.map((row) => row[4])).toEqual(["ფაქტი", "პროგნოზი"]);
    expect(model.sources).toEqual([
      expect.objectContaining({
        downloadHref: "/downloads/methodology/debt/files/2013-2030/public-debt-bulletin-n25.pdf",
        absoluteUrl: "https://fiscal.ge/downloads/methodology/debt/files/2013-2030/public-debt-bulletin-n25.pdf",
      }),
    ]);
  });
});
