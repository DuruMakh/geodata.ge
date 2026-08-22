import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../lib/explorer/workbookModel";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";

const sourceUrl = "https://fiscal.ge/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf";

const readableRows: WorkbookReadableRow[] = [
  {
    kind: "total",
    parentLabelKa: null,
    labelKa: "გადასახადები სულ",
    valuesByYear: { 2020: 1_000, 2021: 1_250, 2022: 1_500 },
    basisByYear: { 2020: "actual", 2021: "actual", 2022: "actual" },
    change: 0.5,
  },
  {
    kind: "item",
    parentLabelKa: "გადასახადები",
    labelKa: "დამატებული ღირებულების გადასახადი",
    valuesByYear: { 2020: 100, 2021: -120, 2022: 150 },
    basisByYear: { 2020: "actual", 2021: "planned", 2022: "actual" },
    change: 0.5,
  },
  ...Array.from({ length: 10 }, (_, index) => ({
    kind: "group" as const,
    parentLabelKa: null,
    labelKa: `სატესტო ჯგუფი ${index + 1}`,
    valuesByYear: { 2020: index + 1, 2021: index + 2, 2022: index + 3 },
    basisByYear: { 2020: "actual" as const, 2021: "actual" as const, 2022: "actual" as const },
    change: 2 / (index + 1),
  })),
];

const approvedModelFixture: WorkbookExportModel = {
  filename: "fiscal-revenue-2020-2022.xlsx",
  sheetNames: ["მარტივი ცხრილი", "მონაცემები"],
  readable: {
    titleKa: "საქართველოს საგადასახადო შემოსავლები",
    subtitleKa: "2020–2022 · ფაქტი და გეგმა · მილიონი ₾",
    unitLabelKa: "მილიონი ₾",
    years: [2020, 2021, 2022],
    rows: readableRows,
    sources: [{
      years: [2020],
      titleKa: "2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
      organizationKa: "საქართველოს ფინანსთა სამინისტრო",
      downloadHref: "/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf",
      retrievedAt: "2026-06-09",
      absoluteUrl: sourceUrl,
    }],
  },
  analysis: {
    headers: ["წელი", "მთავარი ჯგუფი", "კატეგორია", "თანხა (₾)", "სტატუსი"],
    rows: [[2020, "გადასახადები", "დამატებული ღირებულების გადასახადი", 1_212_500_000, "ფაქტი"]],
  },
};

async function loadWorkbook(model: WorkbookExportModel) {
  const buffer = await createWorkbookBuffer(model);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function modelWithYears(years: number[]): WorkbookExportModel {
  return {
    ...approvedModelFixture,
    readable: { ...approvedModelFixture.readable, years },
  };
}

function expectSourceMetadata(readable: ExcelJS.Worksheet) {
  expect(readable.getRow(17).values).toEqual([undefined, "წელი", "ოფიციალური წყარო", "ფაილის ჩამოტვირთვა", "მოპოვებულია"]);
  expect(readable.getCell("A18").value).toBe("2020");
  expect(readable.getCell("B18").value).toBe("2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები");
  expect(readable.getCell("C18").value).toMatchObject({ hyperlink: sourceUrl });
  expect(readable.getCell("D18").value).toBe("2026-06-09");
}

describe("createWorkbookBuffer", () => {
  it("writes the approved two-sheet workbook", async () => {
    const workbook = await loadWorkbook(approvedModelFixture);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები"]);
    expect(workbook.views[0]?.activeTab).toBe(0);

    const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
    expect(readable.getCell("A1").value).toBe("საქართველოს საგადასახადო შემოსავლები");
    expect(readable.getCell("A2").value).toBe("2020–2022 · ფაქტი და გეგმა · მილიონი ₾");
    expect(readable.getCell("B3").value).toBe(2020);
    expect(readable.getCell("E3").value).toBe("ცვლილება 2020–2022");
    expect(readable.getCell("B3").alignment?.horizontal).toBe("right");
    expect(readable.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FF1E1B16" } });
    expect(readable.getCell("A3").fill).toMatchObject({ fgColor: { argb: "FF1E1B16" } });
    expect(readable.getCell("A4").font?.bold).toBe(true);
    expect(readable.getCell("A4").fill).toMatchObject({ fgColor: { argb: "FFF1EADC" } });
    expect(readable.getCell("A6").font?.bold).toBe(true);
    expect(readable.getCell("A6").fill).toMatchObject({ fgColor: { argb: "FFFDF7EA" } });
    expect(readable.getCell("A5").alignment?.wrapText).toBe(true);
    expect(readable.getColumn(1).width).toBeGreaterThanOrEqual(42);
    expect(readable.getColumn(2).width).toBe(18);
    expect(readable.getColumn(3).width).toBe(18);
    expect(readable.getColumn(4).width).toBe(16);
    expect(readable.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 3 });

    const analysis = workbook.getWorksheet("მონაცემები")!;
    expect(analysis.getRow(1).values).toEqual([
      undefined,
      "წელი",
      "მთავარი ჯგუფი",
      "კატეგორია",
      "თანხა (₾)",
      "სტატუსი",
    ]);
    expect(analysis.getCell("D2").type).toBe(ExcelJS.ValueType.Number);
    expect([1, 2, 3, 4, 5].map((column) => analysis.getColumn(column).width)).toEqual([10, 28, 42, 18, 12]);
    expect(analysis.getCell("B2").alignment).toMatchObject({ vertical: "top", wrapText: true });
    expect(analysis.getCell("C2").alignment).toMatchObject({ vertical: "top", wrapText: true });
    expect(analysis.getCell("D2").numFmt).toBe("#,##0.00;[Red](#,##0.00);–");
    expect(JSON.stringify(analysis.getRow(1).values)).not.toContain("კატეგორიის კოდი");
  });

  it("keeps planned values numeric while preserving readable source and table details", async () => {
    const workbook = await loadWorkbook(approvedModelFixture);
    const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
    const analysis = workbook.getWorksheet("მონაცემები")!;

    expect(readable.getCell("C5").type).toBe(ExcelJS.ValueType.Number);
    expect(readable.getCell("C5").value).toBe(-120);
    expect(readable.getCell("C5").numFmt).toBe('#,##0.0 "გეგმა";[Red](#,##0.0) "გეგმა";0.0 "გეგმა"');
    expect(readable.getCell("C5").fill).toMatchObject({ type: "pattern", fgColor: { argb: "FFF1EADC" } });
    expect(readable.getCell("A5").value).toBe("გადასახადები — დამატებული ღირებულების გადასახადი");
    expect(readable.getCell("A5").alignment?.indent).toBe(1);
    expect(readable.getCell("E4").value).toMatchObject({ formula: "D4/B4-1", result: 0.5 });
    expect(readable.getCell("C18").value).toMatchObject({ hyperlink: sourceUrl });
    expect(readable.getCell("B18").alignment?.wrapText).toBe(true);
    expect(readable.getCell("C18").alignment?.wrapText).toBe(true);
    expect(readable.getRow(18).height).toBeGreaterThanOrEqual(60);
    expect(analysis.getTables()).toHaveLength(1);
    const table = analysis.getTable("FiscalExportData") as unknown as { table: { columns: Array<{ filterButton: boolean }> } };
    expect(table.table.columns.map((column) => column.filterButton)).toEqual([true, true, true, true, true]);
    expect(JSON.stringify(analysis.getSheetValues())).not.toMatch(/category_id|parent_id|source_id|docs\/Raw Data/);
  });

  it("adds the GDP-share header only to percentage analysis data", async () => {
    const workbook = await loadWorkbook({
      ...approvedModelFixture,
      readable: { ...approvedModelFixture.readable, unitLabelKa: "% მშპ-ში" },
      analysis: {
        headers: [...approvedModelFixture.analysis.headers, "მშპ-ის წილი (%)"],
        rows: [[2020, "გადასახადები", "დამატებული ღირებულების გადასახადი", 1_212_500_000, "ფაქტი", 0.025]],
      },
    });

    const analysis = workbook.getWorksheet("მონაცემები")!;
    expect(analysis.getCell("F1").value).toBe("მშპ-ის წილი (%)");
    expect(analysis.getCell("F2").value).toBe(0.025);
    expect(analysis.getCell("F2").numFmt).toBe("0.0%");
    expect(analysis.getColumn(6).width).toBe(16);
  });

  it("keeps one-year source metadata in distinct cells", async () => {
    const workbook = await loadWorkbook(modelWithYears([2020]));

    const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
    expectSourceMetadata(readable);
    expect(readable.getCell("A1").value).toBe("საქართველოს საგადასახადო შემოსავლები");
    expect(readable.model.merges).toContain("A1:D1");
    expect(readable.getColumn(4).width).toBe(16);
  });

  it("keeps two-year source metadata in distinct cells", async () => {
    const workbook = await loadWorkbook(modelWithYears([2020, 2021]));

    expectSourceMetadata(workbook.getWorksheet("მარტივი ცხრილი")!);
  });

  it("keeps a program-only selection connected to its parent", async () => {
    const workbook = await loadWorkbook({
      ...approvedModelFixture,
      readable: { ...approvedModelFixture.readable, rows: [readableRows[1]!] },
    });

    expect(workbook.getWorksheet("მარტივი ცხრილი")!.getCell("A4").value).toBe("გადასახადები — დამატებული ღირებულების გადასახადი");
  });

  it("gives longer wrapped source text more room than a short source", async () => {
    const shortWorkbook = await loadWorkbook({
      ...approvedModelFixture,
      readable: {
        ...approvedModelFixture.readable,
        sources: [{
          ...approvedModelFixture.readable.sources[0]!,
          titleKa: "მოკლე წყარო",
          absoluteUrl: "https://fiscal.ge/a.pdf",
        }],
      },
    });
    const longWorkbook = await loadWorkbook(approvedModelFixture);

    const shortHeight = shortWorkbook.getWorksheet("მარტივი ცხრილი")!.getRow(18).height!;
    const longHeight = longWorkbook.getWorksheet("მარტივი ცხრილი")!.getRow(18).height!;
    expect(shortHeight).toBeGreaterThanOrEqual(30);
    expect(longHeight).toBeGreaterThan(shortHeight);
    expect(longHeight).toBeGreaterThanOrEqual(60);
  });

  it("gives a 119-character public URL seven readable wrapped lines", async () => {
    const longUrl = "https://fiscal.ge/downloads/methodology/revenue/files/2020/-long-public-archive-name-with-validated-source-document.pdf";
    expect(longUrl).toHaveLength(119);
    const workbook = await loadWorkbook({
      ...approvedModelFixture,
      readable: { ...approvedModelFixture.readable, sources: [{ ...approvedModelFixture.readable.sources[0]!, absoluteUrl: longUrl }] },
    });

    expect(workbook.getWorksheet("მარტივი ცხრილი")!.getRow(18).height).toBeGreaterThanOrEqual(105);
  });

  it("keeps planned zeros numeric with visible amount and percentage markers", async () => {
    const amountWorkbook = await loadWorkbook({
      ...approvedModelFixture,
      readable: {
        ...approvedModelFixture.readable,
        rows: [{ ...readableRows[1]!, valuesByYear: { 2020: 0, 2021: 0, 2022: 0 }, basisByYear: { 2020: "planned", 2021: "planned", 2022: "planned" } }],
      },
    });
    const percentageWorkbook = await loadWorkbook({
      ...approvedModelFixture,
      readable: {
        ...approvedModelFixture.readable,
        unitLabelKa: "% მშპ-ში",
        rows: [{ ...readableRows[1]!, valuesByYear: { 2020: 0, 2021: 0, 2022: 0 }, basisByYear: { 2020: "planned", 2021: "planned", 2022: "planned" } }],
      },
    });

    expect(amountWorkbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").value).toBe(0);
    expect(amountWorkbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").numFmt).toContain("გეგმა");
    expect(percentageWorkbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").value).toBe(0);
    expect(percentageWorkbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").numFmt).toContain("გეგმა");
  });
});
