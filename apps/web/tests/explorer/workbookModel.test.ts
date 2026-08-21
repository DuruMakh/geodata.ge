import { describe, expect, it } from "vitest";
import {
  absoluteWorkbookSourceUrl,
  buildWorkbookExportModel,
  type WorkbookExportInput,
} from "../../lib/explorer/workbookModel";

const source = {
  years: [2020],
  titleKa: "2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
  organizationKa: "საქართველოს ფინანსთა სამინისტრო",
  downloadHref: "/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf" as const,
  retrievedAt: "2026-06-09",
};

const input: WorkbookExportInput = {
  filenameBase: "revenue",
  titleKa: "საქართველოს საგადასახადო შემოსავლები",
  groupLabelKa: "გადასახადები",
  years: [2020, 2021],
  measure: { kind: "amount", unitLabelKa: "მილიონი ₾", readableScale: 1_000_000 },
  totalId: "revenue.total",
  series: [
    {
      id: "revenue.total",
      kind: "total",
      parentLabelKa: null,
      labelKa: "გადასახადები სულ",
      pointsByYear: {
        2020: { amountGel: 90, basis: "actual" },
        2021: { amountGel: 130, basis: "actual" },
      },
    },
    {
      id: "revenue.vat",
      kind: "item",
      parentLabelKa: null,
      labelKa: "დამატებული ღირებულების გადასახადი",
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
  it("builds two-sheet content without public IDs or duplicate sources", () => {
    const model = buildWorkbookExportModel(input);

    expect(model.filename).toBe("fiscal-revenue-2020-2021.xlsx");
    expect(model.readable.years).toEqual([2020, 2021]);
    expect(model.readable.rows.map((row) => row.labelKa)).toEqual([
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
    expect(model.readable.sources).toHaveLength(1);
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
      measure: { kind: "percentage", unitLabelKa: "% მშპ-ში", analysisHeaderKa: "მშპ-ის წილი (%)" },
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
});
