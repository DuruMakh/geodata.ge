import * as XLSX from "xlsx";

/** The only text Geostat prints where a number is missing. Any other text in a numeric cell stops preparation. */
export const REVIEWED_MISSING_MARKERS: readonly string[] = ["-"];

/**
 * A stored cell may sit this far from a whole number of persons. Geostat's cells carry float noise
 * (3930.4279999999999 thousand) of about 2e-9 persons; a real fraction of a person would be far larger.
 */
const WHOLE_PERSON_TOLERANCE = 1e-6;

export class UnexpectedCellError extends Error {
  constructor(
    readonly sheetName: string,
    readonly cellRef: string,
    readonly value: unknown,
  ) {
    super(`Unexpected cell ${sheetName}!${cellRef}: ${JSON.stringify(value)}`);
    this.name = "UnexpectedCellError";
  }
}

export class NotWholePersonError extends Error {
  constructor(
    readonly sheetName: string,
    readonly cellRef: string,
    readonly persons: number,
  ) {
    super(`Cell ${sheetName}!${cellRef} holds ${persons} persons, which is not a whole number`);
    this.name = "NotWholePersonError";
  }
}

export type YearBlock = { year: number; headerRow: number; firstRow: number; lastRow: number };

/**
 * One worksheet read at its **stored** values. The workbook's number format may display a
 * rounded value (Tbilisi 2025 shows 1,335.7 and stores 1335.671); nothing here uses that text.
 */
export class StoredSheet {
  readonly lastRow: number;
  /** Zero-based index of the last used column (A is 0). */
  readonly lastColumn: number;

  constructor(
    readonly name: string,
    private readonly sheet: XLSX.WorkSheet,
  ) {
    const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
    this.lastRow = range.e.r + 1;
    this.lastColumn = range.e.c;
  }

  /** A1-style reference from a column letter or a zero-based column index. */
  ref(column: number | string, row: number): string {
    return `${typeof column === "number" ? XLSX.utils.encode_col(column) : column}${row}`;
  }

  private cell(ref: string): XLSX.CellObject | undefined {
    return this.sheet[ref] as XLSX.CellObject | undefined;
  }

  isBlank(ref: string): boolean {
    const cell = this.cell(ref);
    return !cell || cell.v === undefined || cell.v === null || String(cell.v).trim() === "";
  }

  /** Trimmed text of a text or numeric cell (a numeric age label 0 reads as "0"); null for a blank cell. */
  label(ref: string): string | null {
    if (this.isBlank(ref)) return null;
    const cell = this.cell(ref)!;
    if (cell.t === "n" || cell.t === "s") return String(cell.v).trim();
    throw new UnexpectedCellError(this.name, ref, cell.v);
  }

  /** The stored number; null for a blank cell or the reviewed missing marker; any other text throws. */
  number(ref: string): number | null {
    if (this.isBlank(ref)) return null;
    const cell = this.cell(ref)!;
    if (cell.t === "n") return cell.v as number;
    if (cell.t === "s" && REVIEWED_MISSING_MARKERS.includes(String(cell.v).trim())) return null;
    throw new UnexpectedCellError(this.name, ref, cell.v);
  }

  private whole(ref: string, scale: number): number | null {
    const value = this.number(ref);
    if (value === null) return null;
    const scaled = value * scale;
    const whole = Math.round(scaled);
    if (Math.abs(scaled - whole) > WHOLE_PERSON_TOLERANCE) throw new NotWholePersonError(this.name, ref, scaled);
    return whole + 0;
  }

  /** A value published in thousands, as a whole number of persons. */
  persons(ref: string): number | null {
    return this.whole(ref, 1000);
  }

  /** A value published as a count, checked to be a whole number. */
  count(ref: string): number | null {
    return this.whole(ref, 1);
  }

  /** A published rate as its shortest decimal text (70.099999999999994 reads as "70.1"). */
  published(ref: string): string | null {
    const value = this.number(ref);
    if (value === null) return null;
    const text = String(value);
    if (/e/i.test(text)) throw new UnexpectedCellError(this.name, ref, value);
    return text;
  }

  /** A four-digit year in a number or text cell, else null. */
  yearAt(ref: string): number | null {
    const cell = this.cell(ref);
    if (!cell) return null;
    if (cell.t === "n" && Number.isInteger(cell.v) && (cell.v as number) >= 1900 && (cell.v as number) <= 2100) return cell.v as number;
    if (cell.t === "s" && /^\d{4}$/.test(String(cell.v).trim())) return Number(String(cell.v).trim());
    return null;
  }

  /** The row holding `label` in `column`. A label that is missing or repeated stops preparation. */
  findRow(label: string, options: { column?: string; fromRow?: number; toRow?: number } = {}): number {
    const { column = "A", fromRow = 1, toRow = this.lastRow } = options;
    const rows: number[] = [];
    for (let row = fromRow; row <= toRow; row += 1) {
      if (this.label(this.ref(column, row)) === label) rows.push(row);
    }
    if (rows.length === 0) throw new Error(`Row label not found in sheet ${this.name}: ${label}`);
    if (rows.length > 1) throw new Error(`Row label appears more than once in sheet ${this.name}: ${label}`);
    return rows[0]!;
  }
}

/** Opens a workbook that must hold exactly one sheet, optionally with a required name. */
export function readStoredSheet(bytes: Buffer, expectedSheet?: string): StoredSheet {
  const workbook = XLSX.read(bytes, { type: "buffer", cellText: false, cellNF: false });
  if (workbook.SheetNames.length !== 1) {
    throw new Error(`A Geostat demography workbook must hold exactly one sheet, found ${workbook.SheetNames.length}`);
  }
  const name = workbook.SheetNames[0]!;
  if (expectedSheet !== undefined && name !== expectedSheet) throw new Error(`Missing sheet ${expectedSheet}; found ${name}`);
  return new StoredSheet(name, workbook.Sheets[name]!);
}

/**
 * Year → the columns under that year's header. A year heads one column in the population table
 * and three (both sexes, males, females) in the age table: blank header cells to its right
 * belong to it. Text that is neither a year nor blank stops preparation.
 */
export function findYearColumns(sheet: StoredSheet, headerRow: number): Map<number, number[]> {
  const columns = new Map<number, number[]>();
  let current: number[] | null = null;
  for (let column = 1; column <= sheet.lastColumn; column += 1) {
    const ref = sheet.ref(column, headerRow);
    const year = sheet.yearAt(ref);
    if (year !== null) {
      if (columns.has(year)) throw new Error(`Year ${year} appears twice in header row ${headerRow} of sheet ${sheet.name}`);
      current = [column];
      columns.set(year, current);
    } else if (sheet.isBlank(ref)) {
      current?.push(column);
    } else {
      throw new UnexpectedCellError(sheet.name, ref, sheet.label(ref));
    }
  }
  if (columns.size === 0) throw new Error(`No year header found in row ${headerRow} of sheet ${sheet.name}`);
  return columns;
}

/**
 * The year blocks of a table stacked by year (migration): a header row carries the year in
 * column B and nothing else, and its block runs to the row before the next header.
 */
export function findYearBlocks(sheet: StoredSheet): YearBlock[] {
  const starts: Array<{ year: number; row: number }> = [];
  for (let row = 1; row <= sheet.lastRow; row += 1) {
    const year = sheet.yearAt(sheet.ref("B", row));
    if (year === null) continue;
    let alone = sheet.isBlank(sheet.ref("A", row));
    for (let column = 2; column <= sheet.lastColumn && alone; column += 1) alone = sheet.isBlank(sheet.ref(column, row));
    if (alone) starts.push({ year, row });
  }
  if (starts.length === 0) throw new Error(`No year blocks found in sheet ${sheet.name}`);
  const seen = new Set<number>();
  for (const start of starts) {
    if (seen.has(start.year)) throw new Error(`Year ${start.year} has two blocks in sheet ${sheet.name}`);
    seen.add(start.year);
  }
  return starts.map((start, index) => ({
    year: start.year,
    headerRow: start.row,
    firstRow: start.row + 1,
    lastRow: (starts[index + 1]?.row ?? sheet.lastRow + 1) - 1,
  }));
}
