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
    valuesByYear: { 2020: 100, 2021: 120, 2022: 150 },
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
    subtitleKa: "გადასახადები",
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
  expect(readable.getCell("A18").value).toBe("2020");
  expect(readable.getCell("B18").value).toBe("2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები");
  expect(readable.getCell("C18").value).toBe("საქართველოს ფინანსთა სამინისტრო");
  expect(readable.getCell("D18").value).toBe("2026-06-09");
  expect(readable.getCell("E18").value).toMatchObject({ hyperlink: sourceUrl });
}

describe("createWorkbookBuffer", () => {
  it("writes the approved two-sheet workbook", async () => {
    const workbook = await loadWorkbook(approvedModelFixture);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები"]);
    expect(workbook.views[0]?.activeTab).toBe(0);

    const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
    expect(readable.getCell("A1").value).toBe("საქართველოს საგადასახადო შემოსავლები");
    expect(readable.getCell("B3").value).toBe(2020);
    expect(readable.getCell("B3").alignment?.horizontal).toBe("right");
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
    expect(JSON.stringify(analysis.getRow(1).values)).not.toContain("კატეგორიის კოდი");
  });

  it("keeps planned values numeric while preserving readable source and table details", async () => {
    const workbook = await loadWorkbook(approvedModelFixture);
    const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
    const analysis = workbook.getWorksheet("მონაცემები")!;

    expect(readable.getCell("C5").type).toBe(ExcelJS.ValueType.Number);
    expect(readable.getCell("C5").numFmt).toBe('#,##0.0 "გეგმა"');
    expect(readable.getCell("C5").fill).toMatchObject({ type: "pattern", fgColor: { argb: "FFF1EADC" } });
    expect(readable.getCell("A5").alignment?.indent).toBe(1);
    expect(readable.getCell("E4").value).toMatchObject({ formula: "D4/B4-1", result: 0.5 });
    expect(readable.getCell("E18").value).toMatchObject({ hyperlink: sourceUrl });
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

    expect(workbook.getWorksheet("მონაცემები")!.getCell("F1").value).toBe("მშპ-ის წილი (%)");
  });

  it("keeps one-year source metadata in distinct cells", async () => {
    const workbook = await loadWorkbook(modelWithYears([2020]));

    expectSourceMetadata(workbook.getWorksheet("მარტივი ცხრილი")!);
  });

  it("keeps two-year source metadata in distinct cells", async () => {
    const workbook = await loadWorkbook(modelWithYears([2020, 2021]));

    expectSourceMetadata(workbook.getWorksheet("მარტივი ცხრილი")!);
  });
});
