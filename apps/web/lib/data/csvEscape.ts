/**
 * Canonical CSV field escaping for every CSV the app generates: quote a value containing
 * a double quote, comma, or line break (\n or \r), doubling embedded quotes; null renders
 * as an empty field. Kept dependency-free so client-side exports can import it too.
 */
export function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

type CsvCell = string | number | boolean | null;

/**
 * A generated CSV: UTF-8 with a BOM (Excel then opens Georgian text correctly),
 * every cell escaped, and a line ending after the last row. Canonical imports use
 * "\n"; the public downloads keep "\r\n".
 */
export function serializeBomCsvRows(rows: ReadonlyArray<ReadonlyArray<CsvCell>>, lineEnding: "\n" | "\r\n" = "\n"): string {
  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join(lineEnding)}${lineEnding}`;
}

/** The same from records keyed by header; a missing cell is written empty. */
export function serializeBomCsv(
  headers: readonly string[],
  records: ReadonlyArray<Partial<Record<string, CsvCell>>>,
  lineEnding: "\n" | "\r\n" = "\n",
): string {
  return serializeBomCsvRows([headers, ...records.map((record) => headers.map((header) => record[header] ?? ""))], lineEnding);
}
