import { describe, expect, it } from "vitest";
import {
  absoluteWorkbookSourceUrl,
  buildWorkbookExportModel,
  type WorkbookExportInput,
} from "../../lib/explorer/workbookModel";

const source = {
  years: [2020],
  title: "2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
  organization: "საქართველოს ფინანსთა სამინისტრო",
  downloadHref: "/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf" as const,
  retrievedAt: "2026-06-09",
};

const input: WorkbookExportInput = {
  locale: "ka",
  filenameBase: "revenue",
  title: "საქართველოს საგადასახადო შემოსავლები",
  groupLabel: "გადასახადები",
  years: [2020, 2021],
  measure: { kind: "amount", unitLabel: "მილიონი ₾", readableScale: 1_000_000 },
  totalId: "revenue.total",
  series: [
    {
      id: "revenue.total",
      kind: "total",
      parentLabel: null,
      label: "გადასახადები სულ",
      pointsByYear: {
        2020: { amountGel: 90, basis: "actual" },
        2021: { amountGel: 130, basis: "actual" },
      },
    },
    {
      id: "revenue.vat",
      kind: "item",
      parentLabel: null,
      label: "დამატებული ღირებულების გადასახადი",
      pointsByYear: {
        2020: { amountGel: -10, basis: "actual" },
        2021: { amountGel: 30, basis: "planned" },
      },
    },
  ],
  sources: [source, source],
  siteOrigin: "https://fiscal.ge/",
};

describe("buildWorkbookExportModel", () => {
  it("exports English headings and status without changing amounts, missingness or source selection", () => {
    const ka = buildWorkbookExportModel(input);
    const englishInput = {
      ...input, locale: "en" as const, title: "Georgia tax revenue", groupLabel: "Taxes",
      measure: { kind: "amount" as const, unitLabel: "million GEL", readableScale: 1_000_000 },
      series: input.series.map(series => ({ ...series, label: series.id === "revenue.total" ? "Total taxes" : "VAT" })),
      sources: input.sources.map(source => ({ ...source, title: "Consolidated budget receipts, 2020", organization: "Ministry of Finance of Georgia" })),
    };
    const en = buildWorkbookExportModel(englishInput);
    expect(en.sheetNames).toEqual(["Summary", "Data", "Sources"]);
    expect(en.filename).toBe("fiscal-revenue-2020-2021-en.xlsx");
    expect(en.analysis.headers).toEqual(["Year", "Group", "Category", "Amount (GEL)", "Status"]);
    expect(en.analysis.rows.map(row => row[3])).toEqual(ka.analysis.rows.map(row => row[3]));
    expect(en.readable.rows.map(row => [row.valuesByYear, row.basisByYear, row.change])).toEqual(ka.readable.rows.map(row => [row.valuesByYear, row.basisByYear, row.change]));
    expect(en.sources.map(source => [source.absoluteUrl, source.years])).toEqual(ka.sources.map(source => [source.absoluteUrl, source.years]));
    expect(en.readable.subtitle).toBe("2020–2021 · Actual and planned · million GEL");
    expect(en.analysis.rows).toContainEqual([2021, "Taxes", "VAT", 30, "Planned"]);
    expect(JSON.stringify(en)).not.toMatch(/\p{Script=Georgian}/u);
  });

  it("builds three-sheet content without public IDs or duplicate sources", () => {
    const model = buildWorkbookExportModel(input);

    expect(model.filename).toBe("fiscal-revenue-2020-2021.xlsx");
    expect(model.sheetNames).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
    expect(model.readable.subtitle).toBe("2020–2021 · ფაქტი და გეგმა · მილიონი ₾");
    expect(model.readable.years).toEqual([2020, 2021]);
    expect(model.readable.rows.map((row) => row.label)).toEqual([
      "გადასახადები სულ",
      "დამატებული ღირებულების გადასახადი",
    ]);
    expect(model.analysis.headers).toEqual([
      "წელი",
      "მთავარი ჯგუფი",
      "კატეგორია",
      "თანხა (₾)",
      "სტატუსი",
    ]);
    expect(model.analysis.rows[0]).not.toContain("revenue.vat");
    expect(model.sources).toHaveLength(1);
    expect(model.readable).not.toHaveProperty("sources");
    expect(model.analysis.rows).toContainEqual([2021, "გადასახადები", "დამატებული ღირებულების გადასახადი", 30, "გეგმა"]);
  });

  it("leaves change blank for a negative starting value", () => {
    const model = buildWorkbookExportModel(input);
    expect(model.readable.rows[1]?.change).toBeNull();
  });

  it("normalizes the site origin without hardcoding a host", () => {
    expect(absoluteWorkbookSourceUrl("https://fiscal.ge/", source.downloadHref)).toBe(
      "https://fiscal.ge/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf",
    );
  });

  it("preserves an official HTTPS source URL without a site-origin prefix", () => {
    expect(absoluteWorkbookSourceUrl("https://fiscal.ge/", "https://www.geostat.ge/media/27798/GDP-at-current-prices.xlsx")).toBe(
      "https://www.geostat.ge/media/27798/GDP-at-current-prices.xlsx",
    );
  });

  it("merges active-year coverage for duplicate source URLs", () => {
    const model = buildWorkbookExportModel({
      ...input,
      sources: [source, { ...source, years: [2021] }],
    });
    expect(model.sources).toHaveLength(1);
    expect(model.sources[0]?.years).toEqual([2020, 2021]);
  });

  it("preserves missing years and real zero values", () => {
    const model = buildWorkbookExportModel({
      ...input,
      years: [2020, 2021, 2022],
      series: [{ ...input.series[0], pointsByYear: { 2020: { amountGel: 0, basis: "actual" } } }],
      totalId: null,
    });
    expect(model.readable.rows[0]?.valuesByYear[2020]).toBe(0);
    expect(model.readable.rows[0]?.valuesByYear[2021]).toBeNull();
  });

  it("uses percentage measure values while retaining full GEL analysis amounts", () => {
    const model = buildWorkbookExportModel({
      ...input,
      measure: { kind: "percentage", unitLabel: "% მშპ-ში", analysisHeader: "მშპ-ის წილი (%)" },
      series: [{ ...input.series[1], pointsByYear: { 2020: { amountGel: 500, measureValue: 2.5, basis: "actual" } } }],
      totalId: null,
    });
    expect(model.readable.rows[0]?.valuesByYear[2020]).toBe(2.5);
    expect(model.analysis.headers.at(-1)).toBe("მშპ-ის წილი (%)");
    expect(model.analysis.rows[0]?.[3]).toBe(500);
  });

  it("uses exact total points and includes a total-only selection in analysis", () => {
    const totalOnly = buildWorkbookExportModel({
      ...input,
      series: [{ ...input.series[0], pointsByYear: { 2020: { amountGel: 1_212_500_000, basis: "actual" } } }],
      years: [2020],
      totalId: "revenue.total",
    });
    expect(totalOnly.analysis.rows).toHaveLength(totalOnly.readable.years.length);

    const nonAdditive = buildWorkbookExportModel({
      ...input,
      years: [2025],
      series: [
        { ...input.series[0], pointsByYear: { 2025: { amountGel: 1_212_500_000, basis: "actual" } } },
        { ...input.series[1], pointsByYear: { 2025: { amountGel: 12_500_000, basis: "actual" } } },
      ],
    });
    expect(nonAdditive.readable.rows[0]?.valuesByYear[2025]).toBe(1_212.5);
  });

  it("does not label published or preliminary data as actual", () => {
    const withBasis = (basis: "published" | "preliminary") => buildWorkbookExportModel({
      ...input,
      series: input.series.map((series) => ({
        ...series,
        pointsByYear: Object.fromEntries(Object.entries(series.pointsByYear).map(([year, point]) => [year, point && { ...point, basis }])),
      })),
    });

    expect(withBasis("published").readable.subtitle).toBe("2020–2021 · გამოქვეყნებული · მილიონი ₾");
    expect(withBasis("preliminary").readable.subtitle).toBe("2020–2021 · წინასწარი · მილიონი ₾");
  });
});
