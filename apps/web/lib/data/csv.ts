import { parse } from "csv-parse/sync";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type CsvRecord = Record<string, string>;

export async function readCsvRecords(relativePath: string): Promise<CsvRecord[]> {
  const filePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
  const content = await readFile(filePath, "utf8");

  return parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];
}
