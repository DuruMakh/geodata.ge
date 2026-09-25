import * as XLSX from "xlsx";
import type { ProductFileRole, ProductLanguage, VerifiedProductFile } from "./productSourceFiles";
import type { PairedProductRow, ProductSourceCell, ProductSourceRow } from "./productTypes";

const MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const HEADERS = {
  en: ["N", "COICOP Code", "Items"],
  ka: ["N", "COICOP კოდი", "დასახელება"],
} as const;
const TITLES = {
  en: { mom: "Previous month=100", yoy: "Same month of the previous year=100" },
  ka: { mom: "წინა თვე=100", yoy: "წინა წლის შესაბამისი თვე=100" },
} as const;
const NOTE_PREFIX = { en: "Note:", ka: "შენიშვნა:" } as const;

function text(raw: unknown): string {
  return raw === null || raw === undefined ? "" : String(raw).trim();
}

function period(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function cellLocator(sheet: string, row: number, col: number): string {
  return `${sheet}!${XLSX.utils.encode_cell({ r: row, c: col })}`;
}

function sourceCell(sheet: XLSX.WorkSheet, sheetName: string, year: number, row: number, col: number, month: number): ProductSourceCell {
  const locator = cellLocator(sheetName, row, col);
  const raw = sheet[XLSX.utils.encode_cell({ r: row, c: col })] as XLSX.CellObject | undefined;
  if (raw?.f) throw new Error(`Product source formula at ${locator}`);
  if (typeof raw?.v === "number") {
    if (!Number.isFinite(raw.v) || raw.v <= 0) throw new Error(`Product index must be finite and positive at ${locator}`);
    return { period: period(year, month), index100: String(raw.v), marker: null, locator };
  }
  const marker = text(raw?.v);
  if (marker === "..." || marker === "…") return { period: period(year, month), index100: null, marker, locator };
  throw new Error(`Product source has unexpected value or missing marker at ${locator}: ${JSON.stringify(raw?.v ?? null)}`);
}

export function readGeostatProducts(content: Buffer, role: ProductFileRole, language: ProductLanguage): ProductSourceRow[] {
  const book = XLSX.read(content, { type: "buffer", cellFormula: true });
  const years = book.SheetNames.map((name) => Number(name));
  if (years.length === 0 || years[0] !== 2011 || years.some((year, index) => !Number.isInteger(year) || year !== 2011 + index)) {
    throw new Error(`Product source year sheets must run consecutively from 2011: ${book.SheetNames.join(", ")}`);
  }
  const latestYear = years.at(-1)!;
  const output: ProductSourceRow[] = [];

  for (const year of years) {
    const sheetName = String(year);
    const sheet = book.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true });
    if (!text(rows[0]?.[0]).includes(TITLES[language][role])) throw new Error(`Product source title does not match ${language} ${role} in ${sheetName}`);
    for (const [address, cell] of Object.entries(sheet)) {
      if (!address.startsWith("!") && (cell as XLSX.CellObject).f) throw new Error(`Product source formula at ${sheetName}!${address}`);
    }

    const headerRows = rows.flatMap((values, index) =>
      HEADERS[language].every((label, col) => text(values[col]) === label) ? [index] : [],
    );
    if (headerRows.length !== 1) throw new Error(`Product source item header missing or repeated in ${sheetName}`);
    const headerRow = headerRows[0]!;
    const header = rows[headerRow]!;
    let monthCount = 0;
    while (text(header[3 + monthCount]) !== "") {
      if (monthCount >= 12 || text(header[3 + monthCount]) !== MONTHS[monthCount]) {
        throw new Error(`Product source month header changed at ${cellLocator(sheetName, headerRow, 3 + monthCount)}`);
      }
      monthCount += 1;
    }
    if (monthCount === 0 || header.slice(3 + monthCount).some((value) => text(value) !== "")) {
      throw new Error(`Product source month header has a gap or extra column in ${sheetName}`);
    }
    if (year !== latestYear && monthCount !== 12) throw new Error(`Product source month header ends early in ${sheetName}`);

    const seenNames = new Set<string>();
    let ordinal = 0;
    let noteSeen = false;
    for (let row = headerRow + 1; row < rows.length; row += 1) {
      const values = rows[row] ?? [];
      const itemNumber = values[0];
      if (itemNumber === null || itemNumber === undefined || itemNumber === "") {
        if (values.every((value) => text(value) === "")) continue;
        if (text(values[0]) === "" && text(values[1]) === "" && text(values[2]).startsWith(NOTE_PREFIX[language]) &&
            values.slice(3).every((value) => text(value) === "") && !noteSeen) {
          noteSeen = true;
          continue;
        }
        throw new Error(`Product source unexpected row at ${sheetName}!${row + 1}`);
      }
      if (noteSeen || typeof itemNumber !== "number" || !Number.isInteger(itemNumber) || itemNumber !== ordinal + 1) {
        throw new Error(`Product source item number/ordinal changed at ${sheetName}!A${row + 1}`);
      }
      ordinal = itemNumber;
      const code = Number(values[1]);
      if (!Number.isInteger(code) || code < 1 || code > 12) throw new Error(`Product source invalid COICOP group at ${sheetName}!B${row + 1}`);
      const coicopCode = String(code).padStart(2, "0");
      const label = text(values[2]);
      if (!label) throw new Error(`Product source empty label at ${sheetName}!C${row + 1}`);
      const nameKey = `${coicopCode}:${label.replace(/\s+/g, " ").toLocaleLowerCase()}`;
      if (seenNames.has(nameKey)) throw new Error(`Product source duplicate group/name in ${sheetName}: ${label}`);
      seenNames.add(nameKey);
      if (values.slice(3 + monthCount).some((value) => text(value) !== "")) throw new Error(`Product source extra value beyond month header at ${sheetName}!${row + 1}`);
      const cells = Array.from({ length: monthCount }, (_, month) => sourceCell(sheet, sheetName, year, row, 3 + month, month + 1));
      output.push({ year, ordinal, coicopCode, label, cells });
    }
    if (ordinal === 0) throw new Error(`Product source has no item rows in ${sheetName}`);
  }
  return output;
}

export function pairProductEditions(files: VerifiedProductFile[]): PairedProductRow[] {
  const byEdition = new Map<string, ProductSourceRow[]>();
  const vintages = new Set(files.map((file) => file.vintage));
  if (files.length !== 4 || vintages.size !== 1) throw new Error("Product source editions have a missing file or mismatched vintage");
  for (const file of files) {
    const key = `${file.language}/${file.file_role}`;
    if (byEdition.has(key)) throw new Error(`Duplicate product source edition ${key}`);
    byEdition.set(key, readGeostatProducts(file.content, file.file_role, file.language));
  }
  const enMom = byEdition.get("en/mom")!;
  const kaMom = byEdition.get("ka/mom")!;
  const enYoy = byEdition.get("en/yoy")!;
  const kaYoy = byEdition.get("ka/yoy")!;
  if (!enMom || !kaMom || !enYoy || !kaYoy) throw new Error("Product source editions incomplete");
  if ([kaMom, enYoy, kaYoy].some((rows) => rows.length !== enMom.length)) throw new Error("Product source inventories have different item counts");
  const paired = enMom.map((mom, index) => {
    const momKa = kaMom[index]!;
    const yoy = enYoy[index]!;
    const yoyKa = kaYoy[index]!;
    for (const other of [momKa, yoy, yoyKa]) {
      if (other.year !== mom.year || other.ordinal !== mom.ordinal || other.coicopCode !== mom.coicopCode) {
        throw new Error(`Product source inventory row mismatch at ${mom.year} item ${mom.ordinal}`);
      }
    }
    if (yoy.label !== mom.label || yoyKa.label !== momKa.label) throw new Error(`Product source label inventory mismatch at ${mom.year} item ${mom.ordinal}`);
    for (const [left, right, role] of [[mom.cells, momKa.cells, "mom"], [yoy.cells, yoyKa.cells, "yoy"]] as const) {
      if (left.length !== right.length) throw new Error(`Product source ${role} month inventory mismatch at ${mom.year} item ${mom.ordinal}`);
      left.forEach((cell, month) => {
        const twin = right[month]!;
        if (cell.period !== twin.period || cell.index100 !== twin.index100 || (cell.marker === null) !== (twin.marker === null)) {
          throw new Error(`Product source language value mismatch at ${mom.year} item ${mom.ordinal} ${cell.period}`);
        }
      });
    }
    if (mom.cells.length !== yoy.cells.length || mom.cells.some((cell, month) => cell.period !== yoy.cells[month]?.period)) {
      throw new Error(`Product source measure month inventory mismatch at ${mom.year} item ${mom.ordinal}`);
    }
    return { year: mom.year, ordinal: mom.ordinal, coicopCode: mom.coicopCode, labelEn: mom.label, labelKa: momKa.label, momCells: mom.cells, yoyCells: yoy.cells };
  });
  const lastPeriod = paired.at(-1)?.momCells.at(-1)?.period;
  if (lastPeriod !== files[0]!.vintage) throw new Error(`Product source vintage ${files[0]!.vintage} does not match last month ${lastPeriod}`);
  return paired;
}
