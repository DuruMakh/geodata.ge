import type { Locale } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";

import type { WorkbookView, Worksheet } from "exceljs";
import type { WorkbookExportModel, WorkbookReadableRow } from "./workbookModel";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PERCENTAGE_NUMBER_FORMAT = "0.0%;[Red](0.0%);–";
const PLANNED_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1EADC" } };
const GROUP_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFDF7EA" } };
const INK_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1E1B16" } };
const TITLE_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1EADC" } };
const INK_COLOR = { argb: "FF1E1B16" };
const PAPER_COLOR = { argb: "FFF7F2E9" };
// Two lines of 15 points, the line height `sourceRowHeight` uses.
const TWO_LINE_HEADER_HEIGHT = 30;

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

function readableNumberFormat(
  isPercentage: boolean,
  markerKey: "workbook.planned" | "workbook.forecast" | null,
  locale: Locale,
  amountDecimals: number,
): string {
  const amount = `#,##0${amountDecimals ? `.${"0".repeat(amountDecimals)}` : ""}`;
  if (markerKey) {
    const marker = workbookMessage(locale, markerKey);
    return isPercentage ? `0.0% "${marker}";[Red](0.0%) "${marker}";0.0% "${marker}"` : `${amount} "${marker}";[Red](${amount}) "${marker}";${amount.replace("#,##", "")} "${marker}"`;
  }
  return isPercentage ? PERCENTAGE_NUMBER_FORMAT : `${amount};[Red](${amount});–`;
}

function sourceRowHeight(title: string, organization: string): number {
  const lines = Math.max(Math.ceil(title.length / 36), Math.ceil(organization.length / 24));
  return Math.max(24, lines * 15);
}

// Readable-sheet column widths, in Excel's character units: the label column, then every value column.
const READABLE_LABEL_WIDTH = 46;
const READABLE_VALUE_WIDTH = 18;
// Georgian letters run wider than Excel's character unit; the demography workbooks size their columns with the same weight.
const GEORGIAN_WIDTH = 1.2;

/** Lines a wrapped text needs across `width` characters, counting Georgian letters as wider. An estimate, not a measurement. */
function wrappedLineCount(text: string, width: number): number {
  let units = 0;
  for (const character of text) units += /\p{Script=Georgian}/u.test(character) ? GEORGIAN_WIDTH : 1;
  return Math.max(1, Math.ceil(units / width));
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

function sourceFileFormat(absoluteUrl: string, locale: Locale): string {
  const filename = new URL(absoluteUrl).pathname.split("/").at(-1) ?? "";
  const extension = filename.includes(".") ? filename.split(".").at(-1) : undefined;
  return extension ? extension.toUpperCase() : workbookMessage(locale, "workbook.file");
}

function writeReadableRow(
  worksheet: Worksheet,
  rowNumber: number,
  row: WorkbookReadableRow,
  years: number[],
  isPercentage: boolean,
  locale: Locale,
  showChangeColumn = true,
  amountDecimals = 1,
  numberFormat?: string,
): void {
  const label = worksheet.getCell(rowNumber, 1);
  label.value = row.kind === "item" && row.parentLabel ? `${row.parentLabel} — ${row.label}` : row.label;
  label.alignment = { vertical: "middle", wrapText: true, indent: row.kind === "item" && row.parentLabel ? 1 : 0 };

  for (const [index, year] of years.entries()) {
    const cell = worksheet.getCell(rowNumber, index + 2);
    const value = row.valuesByYear[year];
    cell.value = value;
    cell.alignment = { horizontal: "right", vertical: "middle" };
    if (value !== null) {
      const basis = row.basisByYear[year];
      const isPlanned = basis === "planned";
      const markerKey = isPlanned ? "workbook.planned" : basis === "forecast" ? "workbook.forecast" : null;
      cell.numFmt = numberFormat ?? readableNumberFormat(isPercentage, markerKey, locale, amountDecimals);
      if (row.basisByYear[year] === "preliminary") {
        const marker = workbookMessage(locale, "workbook.preliminary");
        cell.numFmt = isPercentage ? `0.0% "${marker}"` : `#,##0${amountDecimals ? `.${"0".repeat(amountDecimals)}` : ""} "${marker}"`;
      }
      if (isPlanned) cell.fill = PLANNED_FILL;
    }
  }

  if (showChangeColumn) {
  const changeCell = worksheet.getCell(rowNumber, years.length + 2);
  changeCell.alignment = { horizontal: "right", vertical: "middle" };
  changeCell.numFmt = PERCENTAGE_NUMBER_FORMAT;
  if (row.change !== null && years.length > 1) {
    const firstValueCell = worksheet.getCell(rowNumber, 2).address;
    const lastValueCell = worksheet.getCell(rowNumber, years.length + 1).address;
    changeCell.value = { formula: `${lastValueCell}/${firstValueCell}-1`, result: row.change };
  }

  }
  if (row.kind === "total" || row.kind === "group") {
    for (let column = 1; column <= years.length + (showChangeColumn ? 2 : 1); column += 1) {
      const cell = worksheet.getCell(rowNumber, column);
      cell.font = { bold: true };
      if (row.kind === "total") cell.fill = PLANNED_FILL;
      if (row.kind === "group") cell.fill = GROUP_FILL;
    }
  }
  if (row.kind === "total") worksheet.getRow(rowNumber).border = { bottom: { style: "medium", color: { argb: "FF1E1B16" } } };
}

function writeReadableSheet(worksheet: Worksheet, readable: WorkbookExportModel["readable"], locale: Locale): void {
  const lastColumn = Math.max(readable.years.length + (readable.showChangeColumn === false ? 1 : 2), 4);
  const lastColumnLetter = columnLetter(lastColumn);
  const isPercentage = readable.unitLabel.includes("%");

  worksheet.mergeCells(`A1:${lastColumnLetter}1`);
  worksheet.mergeCells(`A2:${lastColumnLetter}2`);
  worksheet.getCell("A1").value = readable.title;
  worksheet.getCell("A2").value = readable.subtitle;
  for (let column = 1; column <= lastColumn; column += 1) {
    const titleCell = worksheet.getCell(1, column);
    titleCell.fill = TITLE_FILL;
    titleCell.font = { bold: true, size: 16, color: INK_COLOR };
  }
  worksheet.getCell("A2").alignment = { vertical: "middle", wrapText: true };
  if (readable.fitSubtitle) {
    const mergedWidth = READABLE_LABEL_WIDTH + READABLE_VALUE_WIDTH * (lastColumn - 1);
    worksheet.getRow(2).height = wrappedLineCount(readable.subtitle, mergedWidth) * 15;
  }

  const changeHeader = readable.years.length > 0
    ? workbookMessage(locale, "workbook.changeRange", { startYear: readable.years[0], endYear: readable.years.at(-1)! })
    : workbookMessage(locale, "workbook.change");
  const leading = readable.headerLabels
    ? [readable.headerLabels.category, ...readable.headerLabels.columns]
    : [workbookMessage(locale, "workbook.category"), ...readable.years];
  const headers = [...leading, ...(readable.showChangeColumn === false ? [] : [changeHeader])];
  // Opt-in: Excel cuts a right-aligned header that overruns its column at the start, so a label that long wraps instead.
  const wrapHeaders = readable.headerLabels?.wrap === true;
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(3, index + 1);
    cell.value = header;
    cell.fill = INK_FILL;
    cell.font = { bold: true, color: PAPER_COLOR };
    cell.alignment = { horizontal: index === 0 ? "left" : "right", vertical: "middle", ...(wrapHeaders ? { wrapText: true } : {}) };
  });
  if (wrapHeaders) worksheet.getRow(3).height = TWO_LINE_HEADER_HEIGHT;

  readable.rows.forEach((row, index) => writeReadableRow(worksheet, index + 4, row, readable.years, isPercentage, locale, readable.showChangeColumn !== false, readable.amountDecimals, readable.numberFormat));

  const noteRow = readable.rows.length + 4;
  worksheet.getCell(noteRow, 1).value = workbookMessage(locale, "workbook.unit", { unit: readable.unitLabel });

  worksheet.getColumn(1).width = READABLE_LABEL_WIDTH;
  for (let column = 2; column <= lastColumn; column += 1) worksheet.getColumn(column).width = READABLE_VALUE_WIDTH;
}

function writeSourcesSheet(
  worksheet: Worksheet,
  sources: WorkbookExportModel["sources"],
  years: number[],
  locale: Locale,
): void {
  worksheet.mergeCells("A1:E1");
  worksheet.mergeCells("A2:E2");
  worksheet.getCell("A1").value = workbookMessage(locale, "workbook.sources");
  worksheet.getCell("A2").value = workbookMessage(locale, "workbook.originalSources", { years: formatYearRanges(years) });
  for (let column = 1; column <= 5; column += 1) {
    const titleCell = worksheet.getCell(1, column);
    titleCell.fill = TITLE_FILL;
    titleCell.font = { bold: true, size: 16, color: INK_COLOR };
  }
  worksheet.getCell("A2").alignment = { vertical: "middle", wrapText: true };

  (["workbook.period", "workbook.source", "workbook.organization", "workbook.file", "workbook.retrieved"] as const).forEach((key, index) => {
    const header = workbookMessage(locale, key);
    const cell = worksheet.getCell(3, index + 1);
    cell.value = header;
    cell.fill = INK_FILL;
    cell.font = { bold: true, color: PAPER_COLOR };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  sources.forEach((source, index) => {
    const rowNumber = index + 4;
    worksheet.getCell(rowNumber, 1).value = formatYearRanges(source.years);
    worksheet.getCell(rowNumber, 2).value = source.title;
    worksheet.getCell(rowNumber, 3).value = source.organization;
    worksheet.getCell(rowNumber, 4).value = {
      text: workbookMessage(locale, "workbook.downloadFile"),
      hyperlink: source.absoluteUrl,
      tooltip: `${source.title} · ${sourceFileFormat(source.absoluteUrl, locale)}`,
    };
    worksheet.getCell(rowNumber, 4).font = { color: { argb: "FF0563C1" }, underline: true };
    worksheet.getCell(rowNumber, 5).value = source.retrievedAt;
    for (let column = 1; column <= 5; column += 1) {
      worksheet.getCell(rowNumber, column).alignment = { vertical: "top", wrapText: true };
    }
    worksheet.getRow(rowNumber).height = sourceRowHeight(source.title, source.organization);
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
    worksheet.getColumn(column).width = analysis.columnWidths?.[index] ?? widths[index] ?? 18;
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

  writeReadableSheet(readable, model.readable, model.locale);
  writeAnalysisSheet(analysis, model.analysis);
  for (const [column, format] of Object.entries(model.analysis.numericFormats ?? {})) {
    for (let row=2; row<=model.analysis.rows.length+1; row++) analysis.getCell(row,Number(column)).numFmt=format;
  }
  writeSourcesSheet(sources, model.sources, model.sourceYears ?? model.readable.years, model.locale);

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
