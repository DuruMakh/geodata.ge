import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { createGzip } from "node:zlib";
import ExcelJS from "exceljs";
import { csvEscape } from "../csvEscape";
import { PURCHASE_COLUMNS, TENDER_COLUMNS, type SourceColumn } from "./columns";
import { maskPersonalNumbers, partyKey } from "./privacy";
import type { SourceFile } from "./paths";

export type CleanStats = { file: string; rows: number; duplicateIds: number; wonWithoutSupplier: number; currencies: Record<string, number> };

const SIGNED = "ხელშეკრულება დადებულია";
const PARTY_FIELDS = new Set(["supplier_code", "buyer_code"]);

function cellText(value: ExcelJS.CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map(part => part.text).join("");
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    return null;
  }
  return String(value);
}

/**
 * Streams the first worksheet's rows (styles are read so that date cells come back as dates, not serial numbers) as text cells, padded to the header's length. Throws, naming the file, when the
 * trimmed header differs from the expected columns.
 */
export async function* readSheetRows(xlsxPath: string, expected: readonly { source: string }[]): AsyncGenerator<(string | null)[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(xlsxPath, { sharedStrings: "cache", hyperlinks: "ignore", styles: "cache", worksheets: "emit" });
  for await (const worksheet of reader) {
    let headerChecked = false;
    for await (const row of worksheet) {
      const values = (row.values as ExcelJS.CellValue[]).slice(1);
      if (!headerChecked) {
        const found = Array.from(values, value => (cellText(value) ?? "").trim());
        const wanted = expected.map(column => column.source);
        if (found.join("\u0001") !== wanted.join("\u0001")) {
          throw new Error(`${xlsxPath}: unexpected header.\nExpected: ${wanted.join(" | ")}\nFound:    ${found.join(" | ")}`);
        }
        headerChecked = true;
        continue;
      }
      yield Array.from({ length: expected.length }, (_, i) => cellText(values[i]));
    }
    return;
  }
}

/** Cleans one yearly file into clean/{tenders|purchases}_{YEAR}.csv.gz and returns what it counted. */
export async function cleanFile(file: SourceFile, dataDir: string, secret: string): Promise<CleanStats> {
  const columns: readonly SourceColumn[] = file.kind === "tenders" ? TENDER_COLUMNS : PURCHASE_COLUMNS;
  const kept = columns.map((column, index) => ({ field: column.field, index })).filter((c): c is { field: string; index: number } => c.field !== null);
  const at = (cells: (string | null)[], field: string) => cells[kept.find(c => c.field === field)!.index]?.trim() ?? "";
  const idField = file.kind === "tenders" ? "tender_number" : "registration_number";

  const outDir = path.join(dataDir, "clean");
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, `${file.kind}_${file.year}.csv.gz`);
  const gzip = createGzip();
  const output = fs.createWriteStream(`${target}.part`);
  gzip.pipe(output);
  const write = async (line: string) => {
    if (!gzip.write(line)) await once(gzip, "drain");
  };

  const stats: CleanStats = { file: file.xlsxPath, rows: 0, duplicateIds: 0, wonWithoutSupplier: 0, currencies: {} };
  const seen = new Set<string>();
  try {
    await write(`﻿${kept.map(c => c.field).join(",")}\n`);
    for await (const cells of readSheetRows(path.join(dataDir, file.xlsxPath), columns)) {
      stats.rows += 1;
      const id = at(cells, idField);
      if (seen.has(id)) stats.duplicateIds += 1;
      seen.add(id);
      if (file.kind === "tenders" && at(cells, "status") === SIGNED && !at(cells, "supplier_code")) stats.wonWithoutSupplier += 1;
      const currency = at(cells, "currency");
      if (currency) stats.currencies[currency] = (stats.currencies[currency] ?? 0) + 1;
      const fields = kept.map(({ field, index }) => {
        const text = cells[index]?.trim() ?? "";
        return PARTY_FIELDS.has(field) && text ? partyKey(text, secret) : maskPersonalNumbers(text);
      });
      await write(`${fields.map(csvEscape).join(",")}\n`);
    }
    gzip.end();
    await once(output, "finish");
  } catch (error) {
    gzip.destroy();
    output.destroy();
    fs.rmSync(`${target}.part`, { force: true });
    throw error;
  }
  fs.renameSync(`${target}.part`, target);
  return stats;
}
