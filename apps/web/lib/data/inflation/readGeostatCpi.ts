import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import { makePeriod } from "./periods";
import type { CpiMeasure, CpiSeriesId } from "./types";

// Reads the national table of one Geostat CPI workbook. Rows and columns are
// located by content — the I–XII month header, the year labels, the Total / სულ
// row, the two core rows — and anything unexpected throws: a changed Geostat
// layout must stop the refresh, never shift a column silently (spec §4.4).

export const CPI_FILE_ROLES = ["index_2010", "yoy", "mom", "avg12", "core_yoy", "core_mom"] as const;
export type CpiFileRole = (typeof CPI_FILE_ROLES)[number];
export type CpiLanguage = "en" | "ka";
export type ParsedCpiCell = { period: number; value: string; locator: string };
export type ParsedCpiSeries = { seriesId: CpiSeriesId; measure: CpiMeasure; cells: ParsedCpiCell[] };

type Rows = unknown[][];
type Layout = "yearRows" | "total" | "core";

const MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const NATIONAL_SHEET: Record<CpiLanguage, string> = { en: "Georgia", ka: "საქართველო" };
const TOTAL_LABEL: Record<CpiLanguage, string> = { en: "Total", ka: "სულ" };
const EN_CORE_LABELS = ["Core Inflation*", "Core Inflation without tobacco**"];

// Title fragments that prove an English file is the table the manifest names.
// Georgian files are proven by value parity with their English twin instead.
const EN_TITLES: Record<CpiFileRole, string> = {
  index_2010: "2010 average=100",
  yoy: "Same month of the previous year=100",
  mom: "Previous month=100",
  avg12: "12 month average over the previous 12 month average",
  core_yoy: "compared to the same month of the previous year",
  core_mom: "compared to the previous month",
};

// "=100" files publish an index against the comparison period. The canonical CSV
// stores percentage change, which is exactly the published index minus 100.
const ROLES: Record<CpiFileRole, { layout: Layout; rebase: boolean; series: Array<[CpiSeriesId, CpiMeasure]> }> = {
  index_2010: { layout: "yearRows", rebase: false, series: [["cpi.headline", "index_2010"]] },
  avg12: { layout: "yearRows", rebase: true, series: [["cpi.headline", "avg12_pct"]] },
  yoy: { layout: "total", rebase: true, series: [["cpi.headline", "yoy_pct"]] },
  mom: { layout: "total", rebase: true, series: [["cpi.headline", "mom_pct"]] },
  core_yoy: { layout: "core", rebase: false, series: [["cpi.core", "yoy_pct"], ["cpi.core_ex_tobacco", "yoy_pct"]] },
  core_mom: { layout: "core", rebase: false, series: [["cpi.core", "mom_pct"], ["cpi.core_ex_tobacco", "mom_pct"]] },
};

function numeric(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function text(raw: unknown): string {
  return raw === null || raw === undefined ? "" : String(raw).replace(/\s+/g, " ").trim();
}

function toValue(raw: number, rebase: boolean): string {
  const value = new Decimal(String(raw));
  return (rebase ? value.minus(100) : value).toFixed();
}

function locator(sheet: string, row: number, column: number): string {
  return `${sheet}!${XLSX.utils.encode_cell({ r: row, c: column })}`;
}

function findMonthHeader(rows: Rows): { row: number; col: number } {
  for (let row = 0; row < rows.length; row += 1) {
    const cells = rows[row] ?? [];
    for (let col = 0; col + MONTHS.length <= cells.length; col += 1) {
      if (MONTHS.every((label, offset) => text(cells[col + offset]) === label)) return { row, col };
    }
  }
  throw new Error("CPI layout: month header row (I–XII) not found");
}

// index_2010 and avg12: one row per year, January–December in columns B–M.
function readYearRows(rows: Rows, sheet: string, rebase: boolean): ParsedCpiCell[] {
  const header = findMonthHeader(rows);
  if (header.col !== 1) throw new Error("CPI layout: year-row table must start its months in column B");
  const cells: ParsedCpiCell[] = [];
  let ended = false;
  for (let row = header.row + 1; row < rows.length; row += 1) {
    const values = rows[row] ?? [];
    const year = numeric(values[0]);
    if (year === null) {
      if (values.slice(1, 13).some((value) => numeric(value) !== null)) throw new Error(`CPI layout: numeric row ${row + 1} has no year`);
      continue;
    }
    if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new Error(`CPI layout: invalid year ${year} at row ${row + 1}`);
    for (let month = 1; month <= 12; month += 1) {
      const raw = numeric(values[month]);
      if (raw === null) {
        ended = true;
        continue;
      }
      if (ended) throw new Error(`CPI layout: value after a gap at ${locator(sheet, row, month)}`);
      cells.push({ period: makePeriod(year, month), value: toValue(raw, rebase), locator: locator(sheet, row, month) });
    }
  }
  return cells;
}

// yoy, mom and core: years across a header row, I–XII beneath, one data row.
function readYearColumns(rows: Rows, sheet: string, header: { row: number; col: number }, dataRow: number, rebase: boolean): ParsedCpiCell[] {
  const years = rows[header.row - 1] ?? [];
  const months = rows[header.row] ?? [];
  const values = rows[dataRow] ?? [];
  const cells: ParsedCpiCell[] = [];
  let ended = false;
  for (let col = header.col; col < months.length; col += 1) {
    const label = text(months[col]);
    if (label === "") break;
    const offset = col - header.col;
    if (label !== MONTHS[offset % 12]) throw new Error(`CPI layout: unexpected month header "${label}" at ${locator(sheet, header.row, col)}`);
    const year = numeric(years[col - (offset % 12)]);
    if (year === null || !Number.isInteger(year)) throw new Error(`CPI layout: no year above ${locator(sheet, header.row, col)}`);
    const raw = numeric(values[col]);
    if (raw === null) {
      ended = true;
      continue;
    }
    if (ended) throw new Error(`CPI layout: value after a gap at ${locator(sheet, dataRow, col)}`);
    cells.push({ period: makePeriod(year, (offset % 12) + 1), value: toValue(raw, rebase), locator: locator(sheet, dataRow, col) });
  }
  return cells;
}

export function readGeostatCpiFile(content: Buffer, role: CpiFileRole, language: CpiLanguage): ParsedCpiSeries[] {
  const spec = ROLES[role];
  const book = XLSX.read(content, { type: "buffer" });
  let sheetName: string;
  if (spec.layout === "core") {
    if (book.SheetNames.length !== 1) throw new Error(`CPI layout: ${role} must have one sheet, found ${book.SheetNames.length}`);
    sheetName = book.SheetNames[0]!;
  } else {
    const found = book.SheetNames.find((name) => name.trim() === NATIONAL_SHEET[language]);
    if (!found) throw new Error(`CPI layout: national sheet "${NATIONAL_SHEET[language]}" not found in ${role}`);
    sheetName = found;
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName]!, { header: 1, raw: true, defval: null });
  if (language === "en" && !text(rows[0]?.[0]).toLowerCase().includes(EN_TITLES[role].toLowerCase())) {
    throw new Error(`CPI layout: ${role} title does not contain "${EN_TITLES[role]}"`);
  }
  const sheet = sheetName.trim();

  if (spec.layout === "yearRows") {
    const [[seriesId, measure]] = spec.series as [[CpiSeriesId, CpiMeasure]];
    return [{ seriesId, measure, cells: readYearRows(rows, sheet, spec.rebase) }];
  }

  const header = findMonthHeader(rows);
  if (spec.layout === "total") {
    const totals = rows.flatMap((row, index) => (index > header.row && text(row[2]) === TOTAL_LABEL[language] ? [index] : []));
    if (totals.length !== 1) throw new Error(`CPI layout: expected one "${TOTAL_LABEL[language]}" row in ${role}, found ${totals.length}`);
    const [[seriesId, measure]] = spec.series as [[CpiSeriesId, CpiMeasure]];
    return [{ seriesId, measure, cells: readYearColumns(rows, sheet, header, totals[0]!, spec.rebase) }];
  }

  const dataRows = rows.flatMap((row, index) =>
    index > header.row && row.filter((value) => numeric(value) !== null).length >= 12 ? [index] : [],
  );
  if (dataRows.length !== 2) throw new Error(`CPI layout: expected two core indicator rows in ${role}, found ${dataRows.length}`);
  if (language === "en") {
    dataRows.forEach((row, index) => {
      if (text(rows[row]?.[0]) !== EN_CORE_LABELS[index]) throw new Error(`CPI layout: unexpected core label "${text(rows[row]?.[0])}"`);
    });
  }
  return spec.series.map(([seriesId, measure], index) => ({
    seriesId,
    measure,
    cells: readYearColumns(rows, sheet, header, dataRows[index]!, spec.rebase),
  }));
}
