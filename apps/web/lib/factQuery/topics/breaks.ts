// apps/web/lib/factQuery/topics/breaks.ts
//
// The reviewed series-break registers (data/imports/*-series-breaks.csv) for the topic datasets. Build-time only: it reads
// files, so runtime code never imports it (tests/factQuery/purity.test.ts); the rule for whether a change crosses a break,
// breakBetween, lives in topics/store.ts.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { TopicBreak } from "./types";

const REQUIRED = ["break_id", "applies_to", "reference_date", "reason"];

/** One `data/imports/<file>` break register, in its own order (the columns every topic's register shares). */
export async function loadTopicBreaks(file: string): Promise<TopicBreak[]> {
  const csv = await readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports", file));
  const rows = parse(csv, { bom: true, columns: true, skip_empty_lines: true }) as Record<string, string>[];
  if (!rows.length || REQUIRED.some((field) => rows.some((row) => !(field in row)))) throw new Error(`${file}: break fields missing`);
  return rows.map((row) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.reference_date!)) throw new Error(`${file}: ${row.break_id} has no YYYY-MM-DD reference date`);
    return { breakId: row.break_id!, seriesIds: row.applies_to!.split(";"), referenceDate: row.reference_date!, reasonEn: row.reason! };
  });
}
