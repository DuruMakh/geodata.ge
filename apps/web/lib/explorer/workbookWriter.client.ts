import type { WorkbookView, Worksheet } from "exceljs";
import type { WorkbookExportModel, WorkbookReadableRow } from "./workbookModel";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const AMOUNT_NUMBER_FORMAT = "#,##0.0;[Red](#,##0.0);–";
const PERCENTAGE_NUMBER_FORMAT = "0.0%;[Red](0.0%);–";
const PLANNED_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1EADC" } };
const GROUP_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFDF7EA" } };
const INK_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1E1B16" } };
const TITLE_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1EADC" } };
const INK_COLOR = { argb: "FF1E1B16" };
const PAPER_COLOR = { argb: "FFF7F2E9" };

function columnLetter(column: number): string {
  let remaining = column;
  let result = "";
  while (remaining > 0) {
    remaining -= 1;
    result = String.fromCharCode(65 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }
  return result;
}

function readableNumberFormat(isPercentage: boolean, isPlanned: boolean): string {
  if (isPlanned) return isPercentage ? '0.0% "გეგმა";[Red](0.0%) "გეგმა";0.0% "გეგმა"' : '#,##0.0 "გეგმა";[Red](#,##0.0) "გეგმა";0.0 "გეგმა"';
  return isPercentage ? PERCENTAGE_NUMBER_FORMAT : AMOUNT_NUMBER_FORMAT;
}

function sourceRowHeight(titleKa: string, organizationKa: string): number {
  const lines = Math.max(Math.ceil(titleKa.length / 36), Math.ceil(organizationKa.length / 24));
  return Math.max(24, lines * 15);
}

function formatYearRanges(years: number[]): string {
  const sorted = [...new Set(years)].sort((left, right) => left - right);
  const ranges: string[] = [];
  for (let index = 0; index < sorted.length;) {
    const start = sorted[index]!;
    let end = start;
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      index += 1;
      end = sorted[index]!;
    }
    ranges.push(start === end ? String(start) : `${start}–${end}`);
    index += 1;
  }
  return ranges.join(", ");
}

function sourceFileFormat(absoluteUrl: string): string {
  const filename = new URL(absoluteUrl).pathname.split("/").at(-1) ?? "";
  const extension = filename.includes(".") ? filename.split(".").at(-1) : undefined;
  return extension ? extension.toUpperCase() : "ფაილი";
}

function writeReadableRow(
  worksheet: Worksheet,
  rowNumber: number,
  row: WorkbookReadableRow,
  years: number[],
  isPercentage: boolean,
): void {
  const label = worksheet.getCell(rowNumber, 1);
  label.value = row.kind === "item" && row.parentLabelKa ? `${row.parentLabelKa} — ${row.labelKa}` : row.labelKa;
  label.alignment = { vertical: "middle", wrapText: true, indent: row.kind === "item" && row.parentLabelKa ? 1 : 0 };

  for (const [index, year] of years.entries()) {
    const cell = worksheet.getCell(rowNumber, index + 2);
    const value = row.valuesByYear[year];
    cell.value = value;
    cell.alignment = { horizontal: "right", vertical: "middle" };
    if (value !== null) {
      const isPlanned = row.basisByYear[year] === "planned";
      cell.numFmt = readableNumberFormat(isPercentage, isPlanned);
      if (isPlanned) cell.fill = PLANNED_FILL;
    }
  }

  const changeCell = worksheet.getCell(rowNumber, years.length + 2);
  changeCell.alignment = { horizontal: "right", vertical: "middle" };
  changeCell.numFmt = PERCENTAGE_NUMBER_FORMAT;
  if (row.change !== null && years.length > 1) {
    const firstValueCell = worksheet.getCell(rowNumber, 2).address;
    const lastValueCell = worksheet.getCell(rowNumber, years.length + 1).address;
    changeCell.value = { formula: `${lastValueCell}/${firstValueCell}-1`, result: row.change };
  }

  if (row.kind === "total" || row.kind === "group") {
    for (let column = 1; column <= years.length + 2; column += 1) {
      const cell = worksheet.getCell(rowNumber, column);
      cell.font = { bold: true };
      if (row.kind === "total") cell.fill = PLANNED_FILL;
      if (row.kind === "group") cell.fill = GROUP_FILL;
    }
  }
  if (row.kind === "total") worksheet.getRow(rowNumber).border = { bottom: { style: "medium", color: { argb: "FF1E1B16" } } };
}

function writeReadableSheet(worksheet: Worksheet, readable: WorkbookExportModel["readable"]): void {
  const lastColumn = Math.max(readable.years.length + 2, 4);
  const lastColumnLetter = columnLetter(lastColumn);
  const isPercentage = readable.unitLabelKa.includes("%");

  worksheet.mergeCells(`A1:${lastColumnLetter}1`);
  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell("A1").value = readable.titleKa;
  worksheet.getCell("A2").value = readable.subtitleKa;
  for (let column = 1; column <= lastColumn; column += 1) {
    const titleCell = worksheet.getCell(1, column);
    titleCell.fill = TITLE_FILL;
    titleCell.font = { bold: true, size: 16, color: INK_COLOR };
  }
  worksheet.getCell("A2").alignment = { vertical: "middle", wrapText: true };

  const headers = ["კატეგორია", ...readable.years, `ცვლილება ${readable.years[0]}–${readable.years.at(-1)}`];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(3, index + 1);
    cell.value = header;
    cell.fill = INK_FILL;
    cell.font = { bold: true, color: PAPER_COLOR };
    cell.alignment = { horizontal: index === 0 ? "left" : "right", vertical: "middle" };
  });

  readable.rows.forEach((row, index) => writeReadableRow(worksheet, index + 4, row, readable.years, isPercentage));

  const noteRow = readable.rows.length + 4;
  worksheet.getCell(noteRow, 1).value = `ერთეული: ${readable.unitLabelKa}`;

  worksheet.getColumn(1).width = 46;
  for (let column = 2; column <= lastColumn; column += 1) worksheet.getColumn(column).width = 18;
}

function writeSourcesSheet(
  worksheet: Worksheet,
  sources: WorkbookExportModel["sources"],
  years: number[],
): void {
  worksheet.mergeCells("A1:E1");
  worksheet.mergeCells("A2:E2");
  worksheet.getCell("A1").value = "წყაროები";
  worksheet.getCell("A2").value = `${formatYearRanges(years)} · ოფიციალური პირველწყაროები`;
  for (let column = 1; column <= 5; column += 1) {
    const titleCell = worksheet.getCell(1, column);
    titleCell.fill = TITLE_FILL;
    titleCell.font = { bold: true, size: 16, color: INK_COLOR };
  }
  worksheet.getCell("A2").alignment = { vertical: "middle", wrapText: true };

  ["პერიოდი", "ოფიციალური წყარო", "ორგანიზაცია", "ფაილი", "მოპოვებულია"].forEach((header, index) => {
    const cell = worksheet.getCell(3, index + 1);
    cell.value = header;
    cell.fill = INK_FILL;
    cell.font = { bold: true, color: PAPER_COLOR };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  sources.forEach((source, index) => {
    const rowNumber = index + 4;
    worksheet.getCell(rowNumber, 1).value = formatYearRanges(source.years);
    worksheet.getCell(rowNumber, 2).value = source.titleKa;
    worksheet.getCell(rowNumber, 3).value = source.organizationKa;
    worksheet.getCell(rowNumber, 4).value = {
      text: "ფაილის ჩამოტვირთვა",
      hyperlink: source.absoluteUrl,
      tooltip: `${source.titleKa} · ${sourceFileFormat(source.absoluteUrl)}`,
    };
    worksheet.getCell(rowNumber, 4).font = { color: { argb: "FF0563C1" }, underline: true };
    worksheet.getCell(rowNumber, 5).value = source.retrievedAt;
    for (let column = 1; column <= 5; column += 1) {
      worksheet.getCell(rowNumber, column).alignment = { vertical: "top", wrapText: true };
    }
    worksheet.getRow(rowNumber).height = sourceRowHeight(source.titleKa, source.organizationKa);
  });

  [18, 42, 30, 22, 14].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  worksheet.autoFilter = { from: "A3", to: `E${Math.max(3, sources.length + 3)}` };
}

function writeAnalysisSheet(worksheet: Worksheet, analysis: WorkbookExportModel["analysis"]): void {
  worksheet.addTable({
    name: "FiscalExportData",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: analysis.headers.map((name) => ({ name, filterButton: true })),
    rows: analysis.rows,
  });
  const percentageColumns = analysis.headers.flatMap((header, index) => header.endsWith("(%)") ? [index + 1] : []);
  for (const column of percentageColumns) {
    for (let row = 2; row <= analysis.rows.length + 1; row += 1) worksheet.getCell(row, column).numFmt = "0.0%";
  }
  const widths = [10, 28, 42, 18, 12, 16];
  analysis.headers.forEach((_, index) => {
    const column = index + 1;
    worksheet.getColumn(column).width = widths[index] ?? 18;
    const header = worksheet.getCell(1, column);
    header.alignment = { vertical: "top", wrapText: true };
    if (column === 2 || column === 3) {
      for (let row = 2; row <= analysis.rows.length + 1; row += 1) worksheet.getCell(row, column).alignment = { vertical: "top", wrapText: true };
    }
  });
  for (let row = 2; row <= analysis.rows.length + 1; row += 1) worksheet.getCell(row, 4).numFmt = "#,##0.00;[Red](#,##0.00);–";
}

export async function createWorkbookBuffer(model: WorkbookExportModel): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fiscal.ge";
  workbook.created = new Date();
  workbook.views = [{ activeTab: 0 } as WorkbookView];

  const readable = workbook.addWorksheet(model.sheetNames[0], {
    views: [{ state: "frozen", xSplit: 1, ySplit: 3, topLeftCell: "B4" }],
  });
  const analysis = workbook.addWorksheet(model.sheetNames[1], {
    views: [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }],
  });
  const sources = workbook.addWorksheet(model.sheetNames[2], {
    views: [{ state: "frozen", ySplit: 3, topLeftCell: "A4" }],
  });

  writeReadableSheet(readable, model.readable);
  writeAnalysisSheet(analysis, model.analysis);
  writeSourcesSheet(sources, model.sources, model.readable.years);

  const bytes = await workbook.xlsx.writeBuffer();
  return new Uint8Array(bytes).buffer;
}

export async function downloadWorkbook(model: WorkbookExportModel): Promise<void> {
  const buffer = await createWorkbookBuffer(model);
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }));
  const link = document.createElement("a");
  link.href = url;
  link.download = model.filename;
  link.click();
  URL.revokeObjectURL(url);
}
