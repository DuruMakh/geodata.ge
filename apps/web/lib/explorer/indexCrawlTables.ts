import type { CrawlTable } from "./crawlTables";
import { MISSING } from "./format";

/**
 * Every-year crawl tables for the map index pages (DESIGN.md §8.4): each place the map and list show, with every year of
 * its figure, so a reader that runs no page code gets the years the map's single year leaves out. Never trimmed.
 */

/** One place's figure by year; a year it has no figure for is absent or null and prints as a dash. */
export type HistoryRow = { label: string; valuesByYear: Readonly<Record<number, number | null>> };

export function historyCrawlTable({ caption, years, columns, rows, format, category }: {
  caption: string;
  years: readonly number[];
  /** The year headers as the page writes them (`2015/16` for a school year). */
  columns: readonly string[];
  rows: readonly HistoryRow[];
  format: (value: number) => string;
  category?: string;
}): CrawlTable {
  return {
    caption,
    ...(category === undefined ? {} : { category }),
    columns: [...columns],
    rows: rows.map((row) => ({
      label: row.label,
      cells: years.map((year) => {
        const value = row.valuesByYear[year];
        return value === null || value === undefined ? MISSING : format(value);
      }),
    })),
  };
}

/** The caption's parts, then the first and last column: `Schools · Pupils · 2005/06–2025/26`. */
export function historyCaption(parts: readonly string[], columns: readonly string[]): string {
  const period = columns.length > 1 ? `${columns[0]}–${columns.at(-1)}` : (columns[0] ?? "");
  return [...parts, period].filter((part) => part !== "").join(" · ");
}

/** A municipal index's two tables for one figure, as its list's two tabs: municipalities, then regions, Georgia first in each. */
export function municipalHistoryTables({ caption, levels, years, columns, country, municipalities, regions, format }: {
  caption: (level: string) => string;
  levels: { municipalities: string; regions: string };
  years: readonly number[];
  columns: readonly string[];
  country: HistoryRow;
  municipalities: readonly HistoryRow[];
  regions: readonly HistoryRow[];
  format: (value: number) => string;
}): CrawlTable[] {
  return [
    historyCrawlTable({ caption: caption(levels.municipalities), years, columns, rows: [country, ...municipalities], format }),
    historyCrawlTable({ caption: caption(levels.regions), years, columns, rows: [country, ...regions], format }),
  ];
}
