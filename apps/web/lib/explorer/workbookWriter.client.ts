import type { WorkbookView, Worksheet } from "exceljs";
import type { WorkbookExportModel, WorkbookReadableRow } from "./workbookModel";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const AMOUNT_NUMBER_FORMAT = "#,##0.0;[Red](#,##0.0);–";
const PERCENTAGE_NUMBER_FORMAT = "0.0%;[Red](0.0%);–";
const PLANNED_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1EADC" } };
const SOURCE_LINK_COLUMN = 5;

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
  if (isPlanned) return isPercentage ? '0.0% "გეგმა"' : '#,##0.0 "გეგმა"';
  return isPercentage ? PERCENTAGE_NUMBER_FORMAT : AMOUNT_NUMBER_FORMAT;
}

function writeReadableRow(
  worksheet: Worksheet,
  rowNumber: number,
  row: WorkbookReadableRow,
  years: number[],
  isPercentage: boolean,
): void {
  const label = worksheet.getCell(rowNumber, 1);
  label.value = row.labelKa;
  label.alignment = { vertical: "middle", indent: row.kind === "item" && row.parentLabelKa ? 1 : 0 };

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
}

function writeReadableSheet(worksheet: Worksheet, readable: WorkbookExportModel["readable"]): void {
  const lastColumn = readable.years.length + 2;
  const lastColumnLetter = columnLetter(lastColumn);
  const isPercentage = readable.unitLabelKa.includes("%");

  worksheet.mergeCells(`A1:${lastColumnLetter}1`);
  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell("A1").value = readable.titleKa;
  worksheet.getCell("A2").value = readable.subtitleKa;
  worksheet.getCell("A1").font = { bold: true, size: 16 };
  worksheet.getCell("A2").font = { italic: true };

  const headers = ["კატეგორია", ...readable.years, "პერიოდის ცვლილება"];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(3, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: index === 0 ? "left" : "right", vertical: "middle" };
  });

  readable.rows.forEach((row, index) => writeReadableRow(worksheet, index + 4, row, readable.years, isPercentage));

  const noteRow = readable.rows.length + 5;
  worksheet.getCell(noteRow, 1).value = `ერთეული: ${readable.unitLabelKa}`;
  readable.sources.forEach((source, index) => {
    const rowNumber = noteRow + index + 1;
    worksheet.getCell(rowNumber, 1).value = source.years.join(", ");
    worksheet.getCell(rowNumber, 2).value = source.titleKa;
    worksheet.getCell(rowNumber, 3).value = source.organizationKa;
    worksheet.getCell(rowNumber, 4).value = source.retrievedAt;
    worksheet.getCell(rowNumber, SOURCE_LINK_COLUMN).value = {
      text: source.absoluteUrl,
      hyperlink: source.absoluteUrl,
      tooltip: source.titleKa,
    };
  });

  worksheet.getColumn(1).width = 42;
  for (let column = 2; column <= Math.max(lastColumn, SOURCE_LINK_COLUMN); column += 1) worksheet.getColumn(column).width = 18;
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

  writeReadableSheet(readable, model.readable);
  writeAnalysisSheet(analysis, model.analysis);

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
