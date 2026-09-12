import ExcelJS from "exceljs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { WorkbookExportModel, WorkbookReadableRow } from "../../lib/explorer/workbookModel";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";

const sourceUrl = "https://fiscal.ge/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf";

const readableRows: WorkbookReadableRow[] = [
  {
    kind: "total",
    parentLabel: null,
    label: "გადასახადები სულ",
    valuesByYear: { 2020: 1_000, 2021: 1_250, 2022: 1_500 },
    basisByYear: { 2020: "actual", 2021: "actual", 2022: "actual" },
    change: 0.5,
  },
  {
    kind: "item",
    parentLabel: "გადასახადები",
    label: "დამატებული ღირებულების გადასახადი",
    valuesByYear: { 2020: 100, 2021: -120, 2022: 150 },
    basisByYear: { 2020: "actual", 2021: "planned", 2022: "actual" },
    change: 0.5,
  },
  ...Array.from({ length: 10 }, (_, index) => ({
    kind: "group" as const,
    parentLabel: null,
    label: `სატესტო ჯგუფი ${index + 1}`,
    valuesByYear: { 2020: index + 1, 2021: index + 2, 2022: index + 3 },
    basisByYear: { 2020: "actual" as const, 2021: "actual" as const, 2022: "actual" as const },
    change: 2 / (index + 1),
  })),
];

const approvedModelFixture: WorkbookExportModel = {
  locale: "ka",
  filename: "fiscal-revenue-2020-2022.xlsx",
  sheetNames: ["მარტივი ცხრილი", "მონაცემები", "წყაროები"],
  readable: {
    title: "საქართველოს საგადასახადო შემოსავლები",
    subtitle: "2020–2022 · ფაქტი და გეგმა · მილიონი ₾",
    unitLabel: "მილიონი ₾",
    years: [2020, 2021, 2022],
    rows: readableRows,
  },
  analysis: {
    headers: ["წელი", "მთავარი ჯგუფი", "კატეგორია", "თანხა (₾)", "სტატუსი"],
    rows: [[2020, "გადასახადები", "დამატებული ღირებულების გადასახადი", 1_212_500_000, "ფაქტი"]],
  },
  sources: [{
    years: [2020],
    title: "2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
    organization: "საქართველოს ფინანსთა სამინისტრო",
    downloadHref: "/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf",
    retrievedAt: "2026-06-09",
    absoluteUrl: sourceUrl,
  }],
};

async function loadWorkbook(model: WorkbookExportModel) {
  const buffer = await createWorkbookBuffer(model);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

it("honors optional readable precision for small nominal and preliminary amounts", async () => {
  const model = structuredClone(approvedModelFixture);
  Object.assign(model.readable, { amountDecimals: 2 });
  model.readable.rows[0].valuesByYear[2020] = 0.021963618299791698;
  model.readable.rows[0].basisByYear[2020] = "preliminary";
  const workbook = await loadWorkbook(model);
  expect(workbook.worksheets[0].getCell("B4").value).toBe(0.021963618299791698);
  expect(workbook.worksheets[0].getCell("B4").numFmt).toContain("#,##0.00");
});

function modelWithYears(years: number[]): WorkbookExportModel {
  return {
    ...approvedModelFixture,
    readable: { ...approvedModelFixture.readable, years },
  };
}

function expectSourceMetadata(sources: ExcelJS.Worksheet) {
  expect(sources.getRow(3).values).toEqual([undefined, "პერიოდი", "ოფიციალური წყარო", "ორგანიზაცია", "ფაილი", "მოპოვებულია"]);
  expect(sources.getCell("A4").value).toBe("2020");
  expect(sources.getCell("B4").value).toBe("2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები");
  expect(sources.getCell("C4").value).toBe("საქართველოს ფინანსთა სამინისტრო");
  expect(sources.getCell("D4").value).toMatchObject({ text: "ფაილის ჩამოტვირთვა", hyperlink: sourceUrl });
  expect(sources.getCell("D4").font).toMatchObject({ color: { argb: "FF0563C1" }, underline: true });
  expect(sources.getCell("E4").value).toBe("2026-06-09");
}

describe("createWorkbookBuffer", () => {
  it("writes English cells, planned formats and source links as a real three-sheet workbook", async () => {
    const englishModel: WorkbookExportModel = {
      ...approvedModelFixture,
      locale: "en",
      filename: "fiscal-revenue-2020-2022-en.xlsx",
      sheetNames: ["Summary", "Data", "Sources"],
      readable: {
        ...approvedModelFixture.readable,
        title: "Georgia tax revenue", subtitle: "2020–2022 · Actual and planned · million GEL", unitLabel: "million GEL",
        rows: readableRows.map((row, index) => ({ ...row, label: index === 0 ? "Total taxes" : index === 1 ? "VAT" : `Test group ${index - 1}`, parentLabel: row.parentLabel ? "Taxes" : null })),
      },
      analysis: { headers: ["Year", "Group", "Category", "Amount (GEL)", "Status"], rows: [[2020, "Taxes", "VAT", 1_212_500_000, "Actual"]] },
      sources: approvedModelFixture.sources.map(source => ({ ...source, title: "Consolidated budget receipts, 2020", organization: "Ministry of Finance of Georgia" })),
    };
    const workbook = await loadWorkbook(englishModel);
    expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
    const summary = workbook.getWorksheet("Summary")!;
    expect(summary.getCell("A3").value).toBe("Category");
    expect(summary.getCell("E3").value).toBe("Change 2020–2022");
    expect(summary.getCell("C5").type).toBe(ExcelJS.ValueType.Number);
    expect(summary.getCell("C5").value).toBe(-120);
    expect(summary.getCell("C5").numFmt).toContain('"Planned"');
    expect(summary.getCell("E5").value).toEqual({ formula: "D5/B5-1", result: 0.5 });
    expect(summary.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 3 });
    expect(workbook.getWorksheet("Data")!.getCell("D2").value).toBe(1_212_500_000);
    expect(workbook.getWorksheet("Data")!.getCell("D2").type).toBe(ExcelJS.ValueType.Number);
    expect(workbook.getWorksheet("Sources")!.getCell("D4").value).toMatchObject({ text: "Download file", hyperlink: sourceUrl });
    workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
      expect(JSON.stringify(cell.value)).not.toMatch(/\p{Script=Georgian}/u);
      expect(cell.numFmt ?? "").not.toMatch(/\p{Script=Georgian}/u);
    })));
  });

  it("writes the approved three-sheet workbook with a cream title and separate sources", async () => {
    const workbook = await loadWorkbook(approvedModelFixture);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
    expect(workbook.views[0]?.activeTab).toBe(0);

    const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
    expect(readable.getCell("A1").value).toBe("საქართველოს საგადასახადო შემოსავლები");
    expect(readable.getCell("A2").value).toBe("2020–2022 · ფაქტი და გეგმა · მილიონი ₾");
    expect(readable.getCell("B3").value).toBe(2020);
    expect(readable.getCell("E3").value).toBe("ცვლილება 2020–2022");
    expect(readable.getCell("B3").alignment?.horizontal).toBe("right");
    expect(readable.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FFF1EADC" } });
    expect(readable.getCell("A1").font).toMatchObject({ color: { argb: "FF1E1B16" } });
    expect(readable.getCell("A3").fill).toMatchObject({ fgColor: { argb: "FF1E1B16" } });
    expect(readable.getCell("A4").font?.bold).toBe(true);
    expect(readable.getCell("A4").fill).toMatchObject({ fgColor: { argb: "FFF1EADC" } });
    expect(readable.getCell("A6").font?.bold).toBe(true);
    expect(readable.getCell("A6").fill).toMatchObject({ fgColor: { argb: "FFFDF7EA" } });
    expect(readable.getCell("A5").alignment?.wrapText).toBe(true);
    expect(readable.getColumn(1).width).toBeGreaterThanOrEqual(42);
    expect(readable.getColumn(2).width).toBe(18);
    expect(readable.getColumn(3).width).toBe(18);
    expect([1, 2, 3, 4, 5].map((column) => readable.getColumn(column).width)).toEqual([46, 18, 18, 18, 18]);
    expect(readable.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 3 });
    expect(readable.getCell("A17").value).toBeNull();

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

    const sources = workbook.getWorksheet("წყაროები")!;
    expectSourceMetadata(sources);
    expect(sources.getCell("A1").value).toBe("წყაროები");
    expect(sources.getCell("A1").fill).toMatchObject({ fgColor: { argb: "FFF1EADC" } });
    expect(sources.getCell("A3").fill).toMatchObject({ fgColor: { argb: "FF1E1B16" } });
    expect(sources.views[0]).toMatchObject({ state: "frozen", ySplit: 3 });
  });

  it("keeps the source title and file format in the hyperlink tooltip", async () => {
    const bytes = new Uint8Array(await createWorkbookBuffer(approvedModelFixture));
    const sourceSheetXml = strFromU8(unzipSync(bytes)["xl/worksheets/sheet3.xml"]!);

    expect(sourceSheetXml).toContain(
      'tooltip="2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები · PDF"',
    );
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
    const sources = workbook.getWorksheet("წყაროები")!;
    expect(sources.getCell("D4").value).toMatchObject({ text: "ფაილის ჩამოტვირთვა", hyperlink: sourceUrl });
    expect(sources.getCell("B4").alignment?.wrapText).toBe(true);
    expect(sources.getCell("C4").alignment?.wrapText).toBe(true);
    expect(analysis.getTables()).toHaveLength(1);
    const table = analysis.getTable("FiscalExportData") as unknown as { table: { columns: Array<{ filterButton: boolean }> } };
    expect(table.table.columns.map((column) => column.filterButton)).toEqual([true, true, true, true, true]);
    expect(JSON.stringify(analysis.getSheetValues())).not.toMatch(/category_id|parent_id|source_id|docs\/Raw Data/);
  });

  it("adds the GDP-share header only to percentage analysis data", async () => {
    const workbook = await loadWorkbook({
      ...approvedModelFixture,
      readable: { ...approvedModelFixture.readable, unitLabel: "% მშპ-ში" },
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
    expectSourceMetadata(workbook.getWorksheet("წყაროები")!);
    expect(readable.getCell("A1").value).toBe("საქართველოს საგადასახადო შემოსავლები");
    expect(readable.model.merges).toContain("A1:D1");
    expect(readable.getColumn(4).width).toBe(18);
  });

  it("keeps two-year source metadata in distinct cells", async () => {
    const workbook = await loadWorkbook(modelWithYears([2020, 2021]));

    expectSourceMetadata(workbook.getWorksheet("წყაროები")!);
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
        rows: approvedModelFixture.readable.rows,
      },
      sources: [{
          ...approvedModelFixture.sources[0]!,
          title: "მოკლე წყარო",
          absoluteUrl: "https://fiscal.ge/a.pdf",
      }],
    });
    const longWorkbook = await loadWorkbook({
      ...approvedModelFixture,
      sources: [{
        ...approvedModelFixture.sources[0]!,
        title: "2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლების ოფიციალური და სრულად გადამოწმებული პირველწყარო",
      }],
    });

    const shortHeight = shortWorkbook.getWorksheet("წყაროები")!.getRow(4).height!;
    const longHeight = longWorkbook.getWorksheet("წყაროები")!.getRow(4).height!;
    expect(shortHeight).toBeGreaterThanOrEqual(24);
    expect(longHeight).toBeGreaterThan(shortHeight);
    expect(longHeight).toBeGreaterThanOrEqual(30);
  });

  it("compresses continuous and discontinuous source years into readable ranges", async () => {
    const workbook = await loadWorkbook({
      ...approvedModelFixture,
      sources: [{ ...approvedModelFixture.sources[0]!, years: [2015, 2016, 2017, 2018, 2019, 2021, 2022] }],
    });

    expect(workbook.getWorksheet("წყაროები")!.getCell("A4").value).toBe("2015–2019, 2021–2022");
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
        unitLabel: "% მშპ-ში",
        rows: [{ ...readableRows[1]!, valuesByYear: { 2020: 0, 2021: 0, 2022: 0 }, basisByYear: { 2020: "planned", 2021: "planned", 2022: "planned" } }],
      },
    });

    expect(amountWorkbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").value).toBe(0);
    expect(amountWorkbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").numFmt).toContain("გეგმა");
    expect(percentageWorkbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").value).toBe(0);
    expect(percentageWorkbook.getWorksheet("მარტივი ცხრილი")!.getCell("B4").numFmt).toContain("გეგმა");
  });
});
