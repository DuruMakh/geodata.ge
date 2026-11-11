import type { CrawlTable } from "./crawlTables";
import { placeIdForMunicipalityCode } from "./demographyAreas";
import { MISSING } from "./format";
import type { MunicipalListRow } from "./municipalData";

/**
 * Every-year crawl tables for the map index pages (DESIGN.md §8.4): each place the map and list show, with every year of
 * its figure, so a reader that runs no page code gets the years the map's single year leaves out. Never trimmed.
 */

/**
 * Cells Births and deaths and Marriages and divorces keep free, under the page's cell cap, for Georgia's own national tables
 * on the same page (Marriages: 352 in 2026, about 11 more a year); their map tables keep the latest years that fit the rest.
 */
export const GEORGIA_TABLES_ROOM = 400;

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

/** The caption's parts, the first and last column, then the basis, as every crawl table ends: `Schools · Pupils · 2005/06–2025/26 · Published`. */
export function historyCaption(parts: readonly string[], columns: readonly string[], basis: string): string {
  const period = columns.length > 1 ? `${columns[0]}–${columns.at(-1)}` : (columns[0] ?? "");
  return [...parts, period, basis].filter((part) => part !== "").join(" · ");
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

/** One figure of a municipal index, by list row id (municipality code with Tbilisi as `04`, region id, `country.georgia`) and year. */
export type IndexHistoryFigure = { id: string; valueAt: (listRowId: string, year: number) => number | null };
/** Every year a municipal index's figures cover, and the figures. */
export type IndexHistory = { years: number[]; figures: IndexHistoryFigure[] };

/** A municipal index's history from facts already narrowed to each figure, keyed by fact place (`region.tbilisi` for Tbilisi). */
export function historyFromFacts(figures: ReadonlyArray<{ id: string; facts: ReadonlyArray<{ geographyId: string; year: number; value: number }> }>): IndexHistory {
  const years = [...new Set(figures.flatMap((figure) => figure.facts.map((fact) => fact.year)))].sort((a, b) => a - b);
  return {
    years,
    figures: figures.map(({ id, facts }) => {
      const values = new Map(facts.map((fact) => [`${fact.geographyId}|${fact.year}`, fact.value]));
      return { id, valueAt: (listRowId, year) => values.get(`${placeIdForMunicipalityCode(listRowId)}|${year}`) ?? null };
    }),
  };
}

/**
 * A municipal index's tables: for each figure of its history named in `figures`, a municipalities table and a regions
 * table, Georgia first, the places in the list's order. Each figure's columns are the years any municipality or region has it.
 * `maxCells` leaves room under the page's cell cap for its other tables: past it, the earliest years go first, from every figure alike.
 */
export function indexHistoryTables({ history, rows, label, levels, column, figures, basis, maxCells = Infinity }: {
  history: IndexHistory;
  rows: { country: MunicipalListRow; municipalities: readonly MunicipalListRow[]; regions: readonly MunicipalListRow[] };
  label: (row: MunicipalListRow) => string;
  levels: { municipalities: string; regions: string };
  /** A year as the page writes it (`2015/16` for a school year). */
  column: (year: number) => string;
  figures: Readonly<Record<string, { parts: readonly string[]; format: (value: number) => string }>>;
  /** The figures' basis, the caption's last part (`workbook.published` or `workbook.actual`). */
  basis: string;
  maxCells?: number;
}): CrawlTable[] {
  // Georgia's own longer series stays on Georgia's page: the columns are the years its places have, which keeps the
  // longest (Marriages, Georgia from 1994) under the page's cell cap.
  const places = [...rows.municipalities, ...rows.regions];
  const rowCount = places.length + 2;
  const shownFigures = history.figures.flatMap((figure) => {
    const shown = figures[figure.id];
    return shown ? [{ figure, shown, years: history.years.filter((year) => places.some((row) => figure.valueAt(row.id, year) !== null)) }] : [];
  });
  let from = -Infinity;
  const cells = () => shownFigures.reduce((total, entry) => total + entry.years.filter((year) => year >= from).length * rowCount, 0);
  while (cells() > maxCells) from = Math.min(...shownFigures.flatMap((entry) => entry.years.filter((year) => year >= from))) + 1;
  return shownFigures.flatMap(({ figure, shown, years: figureYears }) => {
    const years = figureYears.filter((year) => year >= from);
    const columns = years.map(column);
    const historyRow = (row: MunicipalListRow): HistoryRow => ({ label: label(row), valuesByYear: Object.fromEntries(years.map((year) => [year, figure.valueAt(row.id, year)])) });
    return municipalHistoryTables({
      caption: (level) => historyCaption([...shown.parts, level], columns, basis), levels, years, columns,
      country: historyRow(rows.country), municipalities: rows.municipalities.map(historyRow), regions: rows.regions.map(historyRow), format: shown.format,
    });
  });
}
