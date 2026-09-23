import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildDebtWorkbookExportModel } from "../../lib/explorer/debtWorkbook";
import type { SourcedWorkbookPublicSource } from "../../lib/methodology/workbookSources";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { loadGovernmentDebtFacts } from "../../lib/data/governmentDebt/importGovernmentDebtFacts";
import { loadDebtWorkbookSources, resetWorkbookSourceCacheForTests } from "../../lib/methodology/workbookSources";
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

const debtSources: SourcedWorkbookPublicSource[] = [
  {
    sourceId: "source.mof_public_debt_bulletin_n13",
    years: [2013, 2014],
    title: "სახელმწიფო ვალის სტატისტიკური ბიულეტენი №13",
    organization: "საქართველოს ფინანსთა სამინისტრო",
    downloadHref: "/downloads/methodology/debt/files/2013-2019/public-debt-bulletin-n13.pdf",
    retrievedAt: "2026-09-01",
  },
  {
    sourceId: "source.mof_public_debt_bulletin_n25",
    years: [2015, 2025, 2026],
    title: "სახელმწიფო ვალის სტატისტიკური ბიულეტენი",
    organization: "საქართველოს ფინანსთა სამინისტრო",
    downloadHref: "/downloads/methodology/debt/files/2013-2030/public-debt-bulletin-n25.pdf",
    retrievedAt: "2026-09-01",
  },
  {
    years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    title: "მთავრობის ვალის ყოველთვიური ანგარიში",
    organization: "საქართველოს ფინანსთა სამინისტრო",
    sourceId: "source.mof_monthly_debt_report_2026_07",
    downloadHref: "/downloads/methodology/debt/files/2015-2025/monthly-debt-report-2026-07.pdf",
    retrievedAt: "2026-09-01",
  },
];

const gdpSources: WorkbookPublicSource[] = [{
  years: [2013, 2014],
  title: "მშპ მიმდინარე ფასებში — SNA 2008",
  organization: "საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი)",
  downloadHref: "https://www.geostat.ge/gdp.xlsx",
  retrievedAt: "2026-08-13",
}];

describe("Debt workbook adapter", () => {
  it.each(["stock", "service", "rate"] as const)("exports English %s without changing numbers, status flags or source links", async family => {
    const presentation = await getPresentation("en", ["workbook"], facts.map(fact => fact.seriesId));
    const input = {
      facts, gdpFacts, family,
      selectedIds: [...new Set(facts.filter(fact => fact.family === family).map(fact => fact.seriesId))],
      range: { start: family === "stock" ? 2013 : family === "service" ? 2025 : 2019, end: family === "stock" ? 2014 : family === "service" ? 2026 : 2021 },
      shareOfGdp: false, sources: debtSources, gdpSources, siteOrigin: "https://fiscal.ge",
    };
    const ka = buildDebtWorkbookExportModel(input);
    const en = buildDebtWorkbookExportModel({ ...input, sources: debtSources.map((source, index) => ({ ...source, title: `Official debt source ${index + 1}`, organization: "Ministry of Finance of Georgia" })) }, presentation);
    expect(en.sheetNames).toEqual(["Summary", "Data", "Sources"]);
    expect(en.analysis.rows.map(row => [row[0], row[3], row[5]])).toEqual(ka.analysis.rows.map(row => [row[0], row[3], row[5]]));
    expect(en.readable.rows.map(row => [row.valuesByYear, row.basisByYear])).toEqual(ka.readable.rows.map(row => [row.valuesByYear, row.basisByYear]));
    expect(en.sources.map(source => [source.absoluteUrl, source.years])).toEqual(ka.sources.map(source => [source.absoluteUrl, source.years]));
    expect(JSON.stringify(en)).not.toMatch(/\p{Script=Georgian}/u);
    if (family === "service") expect(en.analysis.rows.some(row => row[4] === "Forecast")).toBe(true);
    if (family === "rate") {
      expect(en.analysis.rows.every(row => row[3] === null)).toBe(true);
      expect(en.analysis.rows.some(row => row[4] === "Not available")).toBe(true);
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(en));
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
    if (family === "rate") {
      const sheet = workbook.getWorksheet("Data")!;
      for (let row = 2; row <= sheet.rowCount; row += 1) expect(sheet.getCell(row, 4).value).toBeNull();
    }
  });

  it("uses exact real-manifest stock and service lineage at source-era boundaries", async () => {
    resetWorkbookSourceCacheForTests();
    const [realFacts, realSources] = await Promise.all([
      loadGovernmentDebtFacts(),
      loadDebtWorkbookSources(),
    ]);
    const build = (family: "stock" | "service", start: number, end: number) => buildDebtWorkbookExportModel({
      facts: realFacts,
      gdpFacts: [],
      family,
      selectedIds: [family === "stock" ? "debt.stock.total" : "debt.service.total"],
      range: { start, end },
      shareOfGdp: false,
      sources: realSources,
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    }).sources.map((source) => ({ href: source.downloadHref, years: source.years }));

    const stock2013 = build("stock", 2013, 2014);
    expect(stock2013).toEqual([
      { href: "/downloads/methodology/debt/files/2013-2019/public-debt-bulletin-n13.pdf", years: [2013, 2014] },
    ]);
    expect(JSON.stringify(stock2013)).not.toContain("bulletin-n25");

    const service2015 = build("service", 2015, 2016);
    expect(service2015).toEqual([
      { href: "/downloads/methodology/debt/files/2013-2030/public-debt-bulletin-n25.pdf", years: [2015, 2016] },
      { href: "/downloads/methodology/debt/files/2013-2016/public-debt-bulletin-n7.pdf", years: [2015, 2016] },
    ]);
    expect(JSON.stringify(service2015)).not.toMatch(/bulletin-n13|bulletin-n19/);

    expect(build("service", 2026, 2030)).toEqual([
      { href: "/downloads/methodology/debt/files/2013-2030/public-debt-bulletin-n25.pdf", years: [2026, 2027, 2028, 2029, 2030] },
    ]);
  });

  it.each([
    {
      name: "external 2015–2017",
      selectedId: "debt.rate.external" as const,
      years: [2015, 2016, 2017],
    },
    {
      name: "domestic 2025",
      selectedId: "debt.rate.domestic" as const,
      years: [2025],
    },
  ])("labels the gap-only $name range as unavailable in the model and generated workbook", async ({ selectedId, years }) => {
    const gapFacts: ServedGovernmentDebtFact[] = years.map((year) => ({
      year,
      family: "rate",
      seriesId: selectedId,
      value: null,
      valueKind: "percent",
      status: "not_available",
      sourceId: null,
      snapshotDate: null,
      lastReviewedAt: "2026-09-01",
    }));
    const model = buildDebtWorkbookExportModel({
      facts: gapFacts,
      gdpFacts: [],
      family: "rate",
      selectedIds: [selectedId],
      range: { start: years[0]!, end: years.at(-1)! },
      shareOfGdp: false,
      sources: [],
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.readable.subtitle).toBe(`${years[0]}–${years.at(-1)} · არ არის ხელმისაწვდომი · %`);
    expect(model.readable.subtitle).not.toContain("ფაქტი");
    expect(model.analysis.rows.every((row) => row[4] === "არ არის ხელმისაწვდომი")).toBe(true);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(model));
    expect(workbook.getWorksheet("მარტივი ცხრილი")!.getCell("A2").value).toBe(model.readable.subtitle);
    expect(workbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").value).toBeNull();
    expect(workbook.getWorksheet("მონაცემები")!.getCell("E2").value).toBe("არ არის ხელმისაწვდომი");
  });

  it.each([
    {
      name: "external 2015–2017",
      selectedId: "debt.rate.external" as const,
      start: 2015,
      end: 2017,
    },
    {
      name: "domestic 2025",
      selectedId: "debt.rate.domestic" as const,
      start: 2025,
      end: 2025,
    },
  ])("keeps the reviewed rate-source set in a gap-only $name workbook", async ({ selectedId, start, end }) => {
    resetWorkbookSourceCacheForTests();
    const [realFacts, realSources] = await Promise.all([
      loadGovernmentDebtFacts(),
      loadDebtWorkbookSources(),
    ]);
    const model = buildDebtWorkbookExportModel({
      facts: realFacts,
      gdpFacts: [],
      family: "rate",
      selectedIds: [selectedId],
      range: { start, end },
      shareOfGdp: false,
      sources: realSources,
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.sources.map((source) => source.downloadHref.split("/").at(-1))).toEqual([
      "monthly-debt-report-2026-07.pdf",
      "debt-management-strategy-2019-2021.pdf",
      "debt-management-strategy-2022-2025.pdf",
      "debt-management-strategy-2023-2026.pdf",
      "debt-management-strategy-2025-2029.pdf",
    ]);
    expect(model.sources.every((source) => source.years[0] === start && source.years.at(-1) === end)).toBe(true);
  });

  it("keeps a selected total rate in the machine-friendly sheet beside a component rate", () => {
    const model = buildDebtWorkbookExportModel({
      facts,
      gdpFacts: [],
      family: "rate",
      selectedIds: ["debt.rate.total", "debt.rate.external"],
      range: { start: 2019, end: 2019 },
      shareOfGdp: false,
      sources: debtSources,
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.analysis.rows).toEqual([
      [2019, "საპროცენტო განაკვეთი", "საპროცენტო განაკვეთი", null, "ფაქტი", 0.032],
      [2019, "საპროცენტო განაკვეთი", "საგარეო განაკვეთი", null, "არ არის ხელმისაწვდომი", null],
    ]);
  });

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
    expect(model.readable.unitLabel).toBe("% მშპ-ში");
    expect(model.readable.subtitle).toBe("2013–2014 · ფაქტი · % მშპ-ში");
    expect(model.readable.rows.map((row) => [row.label, row.valuesByYear])).toEqual([
      ["მთლიანი ვალი", { 2013: 0.5, 2014: 0.5 }],
      ["საშინაო ვალი", { 2013: 0.125, 2014: 0.125 }],
    ]);
    expect(model.analysis.headers).toEqual(["წელი", "მთავარი ჯგუფი", "კატეგორია", "თანხა (₾)", "სტატუსი", "მშპ-ის წილი (%)"]);
    expect(model.analysis.rows.map((row) => row[2])).toEqual([
      "საშინაო ვალი",
      "საშინაო ვალი",
    ]);
    expect(model.sources.map((source) => source.title)).toEqual([
      "სახელმწიფო ვალის სტატისტიკური ბიულეტენი №13",
      "მშპ მიმდინარე ფასებში — SNA 2008",
    ]);
  });

  it("keeps derived service totals out of the machine-friendly sheet when a component is selected", () => {
    const serviceFacts: ServedGovernmentDebtFact[] = [
      { year: 2025, family: "service", seriesId: "debt.service.total", value: 4_000_000_000, valueKind: "amount_gel", status: "actual", sourceId: "mof_public_debt_bulletin_n25", snapshotDate: null, lastReviewedAt: "2026-09-01" },
      { year: 2025, family: "service", seriesId: "debt.service.principal", value: 2_500_000_000, valueKind: "amount_gel", status: "actual", sourceId: "mof_public_debt_bulletin_n25", snapshotDate: null, lastReviewedAt: "2026-09-01" },
    ];
    const model = buildDebtWorkbookExportModel({
      facts: serviceFacts,
      gdpFacts: [],
      family: "service",
      selectedIds: ["debt.service.total", "debt.service.principal"],
      range: { start: 2025, end: 2025 },
      shareOfGdp: false,
      sources: debtSources,
      gdpSources: [],
      siteOrigin: "https://fiscal.ge",
    });

    expect(model.analysis.rows.map((row) => row[2])).toEqual(["ძირი თანხა"]);
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

    expect(model.readable.unitLabel).toBe("%");
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

    expect(model.readable.subtitle).toBe("2025–2026 · ფაქტი და პროგნოზი · მლრდ ₾");
    expect(model.analysis.rows.map((row) => row[4])).toEqual(["ფაქტი", "პროგნოზი"]);
    expect(model.sources).toEqual([
      expect.objectContaining({
        downloadHref: "/downloads/methodology/debt/files/2013-2030/public-debt-bulletin-n25.pdf",
        absoluteUrl: "https://fiscal.ge/downloads/methodology/debt/files/2013-2030/public-debt-bulletin-n25.pdf",
      }),
    ]);
  });

  it("drops the relative change column from percentage exports only", () => {
    const base = { facts, gdpFacts, sources: debtSources, gdpSources, siteOrigin: "https://fiscal.ge" };
    const rate = buildDebtWorkbookExportModel({ ...base, family: "rate", selectedIds: ["debt.rate.total"], range: { start: 2019, end: 2021 }, shareOfGdp: false });
    const stockShare = buildDebtWorkbookExportModel({ ...base, family: "stock", selectedIds: ["debt.stock.total"], range: { start: 2013, end: 2014 }, shareOfGdp: true });
    const stockGel = buildDebtWorkbookExportModel({ ...base, family: "stock", selectedIds: ["debt.stock.total"], range: { start: 2013, end: 2014 }, shareOfGdp: false });

    expect(rate.readable.showChangeColumn).toBe(false);
    expect(stockShare.readable.showChangeColumn).toBe(false);
    expect(stockGel.readable.showChangeColumn).toBeUndefined();
  });
});
