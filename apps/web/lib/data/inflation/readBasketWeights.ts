import Decimal from "decimal.js";
import * as XLSX from "xlsx";

export type ParsedWeightRow = { coicopCode: string; level: 2 | 3; label: string; byYear: Map<number, string> };

const SHEET = "Weights";
const TITLE = "consumer basket weights";

function text(raw: unknown): string {
  return raw === null || raw === undefined ? "" : String(raw).replace(/\s+/g, " ").trim();
}

// Geostat publishes weights as fractions of one, one column per year from 2012.
// They are stored as percentages with six decimals, so the yearly sums are checked
// against 100 with a tolerance rather than for equality (spec §3.5).
export function readGeostatBasketWeights(content: Buffer): ParsedWeightRow[] {
  const book = XLSX.read(content, { type: "buffer" });
  const sheet = book.Sheets[SHEET];
  if (!sheet) throw new Error(`Basket weights: sheet "${SHEET}" not found`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  if (!text(rows[0]?.[0]).toLowerCase().includes(TITLE)) throw new Error("Basket weights: unexpected title row");
  const headerRow = rows.findIndex((row) => text(row?.[1]) === "Level" && text(row?.[2]) === "COICOP code");
  if (headerRow === -1) throw new Error("Basket weights: Level / COICOP code header not found");
  const yearRow = rows[headerRow + 1] ?? [];
  const years: Array<{ year: number; col: number }> = [];
  for (let col = 4; col < yearRow.length; col += 1) {
    const year = yearRow[col];
    if (typeof year === "number" && Number.isInteger(year) && year > 2000 && year < 2100) years.push({ year, col });
  }
  if (years.length === 0) throw new Error("Basket weights: no year columns");

  const parsed: ParsedWeightRow[] = [];
  let sawTotal = false;
  for (let row = headerRow + 2; row < rows.length; row += 1) {
    const values = rows[row] ?? [];
    const level = values[1];
    if (typeof level !== "number") continue;
    if (level === 0) {
      sawTotal = true;
      continue;
    }
    if (level !== 2 && level !== 3) throw new Error(`Basket weights: unexpected level ${level} at row ${row + 1}`);
    const code = text(values[2]);
    if (!/^\d{1,3}$/.test(code)) throw new Error(`Basket weights: row ${row + 1} has no COICOP code`);
    const byYear = new Map<number, string>();
    for (const { year, col } of years) {
      const raw = values[col];
      if (typeof raw !== "number") continue;
      byYear.set(year, new Decimal(String(raw)).times(100).toFixed(6));
    }
    if (byYear.size === 0) throw new Error(`Basket weights: category ${code} has no values`);
    parsed.push({ coicopCode: code, level, label: text(values[3]), byYear });
  }
  if (!sawTotal) throw new Error("Basket weights: the Total row is missing");
  if (parsed.filter((row) => row.level === 2).length !== 12) throw new Error("Basket weights: expected 12 COICOP divisions");
  return parsed;
}
