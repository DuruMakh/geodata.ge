// apps/web/lib/factQuery/topics/breaks.ts
//
// The reviewed series-break registers (data/imports/*-series-breaks.csv) for the topic datasets, and the one rule for
// whether a change between two periods crosses a break. Build-time only: it reads files, so runtime code never imports it
// (tests/factQuery/purity.test.ts).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { TopicBreak, TopicPage } from "./types";

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

/**
 * The stored year of the period a date falls in: a calendar year Y runs from Y-01-01, a school year Y (`2020/21`) from
 * Y-09-01. A break dated inside a period starts in that period, as the money-and-banks register reads its dates.
 */
function periodOf(date: string, periodKind: TopicPage["periodKind"]): number {
  const year = Number(date.slice(0, 4));
  return periodKind === "school_year" && date.slice(5) < "09-01" ? year - 1 : year;
}

/** The first break on a series that separates `fromYear` and `toYear` (either order): the period it starts in lies after the earlier year and no later than the later one. */
export function breakBetween(breaks: readonly TopicBreak[], seriesId: string, fromYear: number, toYear: number, periodKind: TopicPage["periodKind"]): TopicBreak | null {
  const [early, late] = fromYear <= toYear ? [fromYear, toYear] : [toYear, fromYear];
  return breaks.find((entry) => {
    if (!entry.seriesIds.includes(seriesId)) return false;
    const starts = periodOf(entry.referenceDate, periodKind);
    return early < starts && starts <= late;
  }) ?? null;
}
