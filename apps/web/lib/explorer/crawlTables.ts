import { message } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import { MISSING } from "./format";
import { readableBasisLabel, readableRowLabel, type WorkbookBasis, type WorkbookExportModel, type WorkbookReadableRow } from "./workbookModel";

/** The most cells a page's first tables hold: the ones before the block's fold. */
export const CRAWL_CELL_CAP = 3000;
/**
 * The most text a page's first tables hold, as a reader prints them (`crawlReaderChars`): what a reader with a short window
 * has left for them. Claude's web fetch passed on roughly the first 40,000 characters of a page (measured on production,
 * 2026-11-21), and the pages spend up to 10,000 of them above their tables.
 */
export const CRAWL_WINDOW_CHARS = 30_000;
/**
 * The cells a page holds in all: the first tables, then the rest (the series and periods they leave out), folded below them.
 * The largest page, Inflation by category, holds about 30,300 (three views of 55 categories, every month since 2004) and
 * gains about 1,500 a year.
 */
export const CRAWL_PAGE_CELL_CAP = 40_000;
/** The most months a monthly view's crawl tables carry; its crawl states choose the window (`lastPeriodsRange`). */
export const CRAWL_MONTH_COLUMNS = 36;
/** The most decimals a crawl cell prints: enough for any figure a reader quotes, whatever digits the workbook keeps. */
export const CRAWL_MAX_DECIMALS = 3;
/** The most decimals a figure too small for its format gains, so it does not read as zero (`formatCrawlCell`). */
const CRAWL_SMALL_DECIMALS = 8;

/**
 * `category` heads the label column when the workbook names it (`headerLabels.category`); otherwise the page writes "Category".
 * `rest` marks a table that follows the first 3,000 cells: the block folds it (`crawlBlockHtml`).
 */
export type CrawlTable = { caption: string; category?: string; columns: string[]; rows: { label: string; cells: string[] }[]; rest?: true };

const STATUS_KEYS = {
  planned: "workbook.planned",
  preliminary: "workbook.preliminary",
  forecast: "workbook.forecast",
} as const;

const isNumberSection = (section: string | undefined): section is string => section !== undefined && /[0#]/.test(section);

// One shared formatter per shape: building an Intl.NumberFormat per cell dominated hydration on capped pages.
const formatters = new Map<string, Intl.NumberFormat>();
function numberFormatter(minimum: number, maximum: number, useGrouping: boolean): Intl.NumberFormat {
  const key = `${minimum}:${maximum}:${useGrouping}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: minimum, maximumFractionDigits: maximum, useGrouping });
    formatters.set(key, formatter);
  }
  return formatter;
}

// A deliberately small reading of an Excel format: decimals, grouping, percent and sign only.
export function formatCrawlCell(value: number | null, basis: WorkbookBasis | null, numberFormat: string, locale: Locale): string {
  if (value === null || basis === "not_available") return MISSING;
  const sections = numberFormat.split(";");
  const section = (value < 0 && sections[1] !== undefined ? sections[1] : value === 0 && isNumberSection(sections[2]) ? sections[2] : sections[0])
    .replace(/"[^"]*"|\[[^\]]*\]/g, "");
  const [integerPart, decimalPart = ""] = section.split(".");
  const zeros = (decimalPart.match(/0/g) ?? []).length;
  const minimum = Math.min(zeros, CRAWL_MAX_DECIMALS);
  const maximum = Math.min(zeros + (decimalPart.match(/#/g) ?? []).length, CRAWL_MAX_DECIMALS);
  const percent = section.includes("%");
  const grouping = integerPart.includes(",");
  const magnitude = Math.abs(percent ? value * 100 : value);
  let digits = numberFormatter(minimum, maximum, grouping).format(magnitude);
  // An amount that is not zero never reads as zero (a small trading partner in billions of dollars): it gains decimals
  // until two significant digits show. Past CRAWL_SMALL_DECIMALS it is rounding noise and stays zero. A percentage or a
  // signed change keeps its format's decimals, as the chart and the official release print it (inflation of 0.0%).
  const signed = sections[0].trimStart().startsWith("+");
  if (!percent && !signed && magnitude !== 0 && !/[1-9]/.test(digits)) {
    const small = numberFormatter(minimum, Math.min(CRAWL_SMALL_DECIMALS, Math.ceil(-Math.log10(magnitude)) + 1), grouping).format(magnitude);
    if (/[1-9]/.test(small)) digits = small;
  }
  // A negative that still rounds to zero digits reads "0.0", not "−0.0".
  const sign = value < 0 ? (/[1-9]/.test(digits) ? "−" : "") : section.trimStart().startsWith("+") ? "+" : "";
  const text = `${sign}${digits}${percent ? "%" : ""}`;
  const status = basis !== null && basis in STATUS_KEYS ? STATUS_KEYS[basis as keyof typeof STATUS_KEYS] : null;
  return status ? `${text} (${workbookMessage(locale, status).toLowerCase()})` : text;
}

function defaultFormat({ unitLabel, amountDecimals }: WorkbookExportModel["readable"]): string {
  if (unitLabel.includes("%")) return "0.0%";
  const decimals = amountDecimals ?? 1;
  return `#,##0${decimals ? `.${"0".repeat(decimals)}` : ""}`;
}

type Candidate = { row: WorkbookReadableRow; latest: number };

const hasFigure = (row: WorkbookReadableRow, years: readonly number[]) =>
  years.some((year) => row.valuesByYear[year] !== null && row.valuesByYear[year] !== undefined && row.basisByYear[year] !== "not_available");

/**
 * The caption's basis. A preliminary year beside published or actual ones is named with its years
 * (`Published · Preliminary: 2025`), as the cells mark it, rather than calling the whole table preliminary.
 */
function crawlBasis({ rows, years }: WorkbookExportModel["readable"], locale: WorkbookExportModel["locale"]): string | null {
  const preliminary = years.filter((year) => rows.some((row) => row.basisByYear[year] === "preliminary"));
  const settled = rows.map((row) => ({ basisByYear: Object.fromEntries(Object.entries(row.basisByYear).filter(([, basis]) => basis !== "preliminary")) }));
  const settledLabel = preliminary.length > 0 && settled.some((row) => Object.values(row.basisByYear).some((basis) => basis !== null && basis !== "not_available"))
    ? readableBasisLabel(settled, locale)
    : null;
  return settledLabel === null
    ? readableBasisLabel(rows, locale)
    : `${settledLabel} · ${workbookMessage(locale, "workbook.preliminary")}: ${preliminary.join(", ")}`;
}

/**
 * A table's caption (spec §3.1): title · view · unit · first–last period · basis. Notes and formulas stay in the Excel
 * subtitle. A view or unit the title already names as one of its parts is not repeated.
 */
export function crawlCaption(model: WorkbookExportModel): string {
  const { readable, locale } = model;
  const { years } = readable;
  const label = model.periodLabel ?? String;
  const period = readable.period ?? (years.length === 0 ? undefined : years.length === 1 ? label(years[0]!) : `${label(years[0]!)}–${label(years.at(-1)!)}`);
  const titleParts = readable.title.split(" · ");
  const named = (part: string | undefined) => part !== undefined && part !== "" && !titleParts.includes(part);
  return [readable.title, ...[readable.view, readable.longUnit ?? readable.unitLabel].filter(named), period, crawlBasis(readable, locale)]
    .filter((part): part is string => part !== undefined && part !== null && part !== "")
    .join(" · ");
}

function latestMagnitude(row: WorkbookReadableRow, years: number[]): number {
  for (let i = years.length - 1; i >= 0; i -= 1) {
    const value = row.valuesByYear[years[i]];
    if (value !== null && value !== undefined) return Math.abs(value);
  }
  return Number.NEGATIVE_INFINITY;
}

/** The largest `slots` of `rows` by latest value, in their own order; a row without a figure in any year is never one of them. */
function largestRows(rows: readonly WorkbookReadableRow[], years: number[], slots: number): { kept: Set<WorkbookReadableRow>; ranked: number } {
  const ranked: Candidate[] = rows.filter((row) => hasFigure(row, years)).map((row) => ({ row, latest: latestMagnitude(row, years) }));
  const kept = new Set(ranked.map((candidate, order) => ({ ...candidate, order })).sort((a, b) => b.latest - a.latest || a.order - b.order).slice(0, slots).map((candidate) => candidate.row));
  return { kept, ranked: ranked.length };
}

function crawlTable(model: WorkbookExportModel, rows: readonly WorkbookReadableRow[], caption: string, rest: boolean): CrawlTable {
  const { readable, locale } = model;
  // Every column is kept: a monthly workbook has a row per year and at most 13 columns, and its crawl state already
  // narrows it to its months, so trimming columns here would only cut the early years of a yearly table.
  const years = readable.years;
  const fallback = defaultFormat(readable);
  return {
    caption,
    ...(readable.headerLabels ? { category: readable.headerLabels.category } : {}),
    columns: readable.headerLabels ? readable.headerLabels.columns : years.map(String),
    rows: rows.map((row) => ({
      label: readableRowLabel(row),
      cells: years.map((year) => formatCrawlCell(
        row.valuesByYear[year] ?? null,
        row.basisByYear[year] ?? null,
        row.numberFormatByYear?.[year] ?? row.numberFormat ?? readable.numberFormat ?? fallback,
        locale,
      )),
    })),
    ...(rest ? { rest: true as const } : {}),
  };
}

/** About the characters a reader that turns tables into text spends on these: a caption, a header and its rule, and a line of cells per row. */
export function crawlReaderChars(tables: readonly CrawlTable[]): number {
  const line = (cells: readonly string[]) => cells.reduce((sum, cell) => sum + cell.length + 3, 2);
  return tables.reduce((sum, table) => sum + table.caption.length + 2 + 2 * line([table.category ?? "", ...table.columns])
    + table.rows.reduce((rows, row) => rows + line([row.label, ...row.cells]), 0), 0);
}

/**
 * A page's tables. First the ones a reader with a short window still reaches: each model with rows, sharing `CRAWL_CELL_CAP` cells and,
 * as text, `CRAWL_WINDOW_CHARS`; a table over its share keeps its totals and its largest series. Then the rest, marked `rest`: the other series of each cut
 * table, in workbook order, and the `earlier` models (the periods before a monthly page's window) whole. The page stops at
 * `CRAWL_PAGE_CELL_CAP`: a rest table that cannot be whole keeps its largest series, and its caption says so.
 */
export function crawlTables(models: readonly WorkbookExportModel[], messages: Messages, earlier: readonly WorkbookExportModel[] = []): CrawlTable[] {
  const withRows = models.filter((model) => model.readable.rows.length > 0);
  const firstWithin = (cellCap: number) => {
    const cuts: { model: WorkbookExportModel; at: number; others: WorkbookReadableRow[]; kept: number; of: number }[] = [];
    const first: { model: WorkbookExportModel; rows: readonly WorkbookReadableRow[] }[] = [];
    let remaining = cellCap;
    withRows.forEach((model, index) => {
      const { years, rows: allRows } = model.readable;
      const budget = Math.floor(remaining / (withRows.length - index));
      const maxRows = Math.max(1, Math.floor(budget / Math.max(1, years.length)));
      let kept: readonly WorkbookReadableRow[] = allRows;
      if (allRows.length > maxRows) {
        const items = allRows.filter((row) => row.kind !== "total");
        const itemSlots = Math.max(0, maxRows - (allRows.length - items.length));
        // A series with no figure in any year never takes a slot from one that has figures.
        const top = largestRows(items, years, itemSlots);
        kept = allRows.filter((row) => row.kind === "total" || top.kept.has(row));
        // The note counts the series that have figures, so it and the rest table's "the other N" add up. A table that
        // leaves out only series without any figure is complete, and gets no note.
        const others = items.filter((row) => !top.kept.has(row) && hasFigure(row, years));
        if (others.length > 0) cuts.push({ model, at: index, others, kept: Math.min(itemSlots, top.ranked), of: top.ranked });
      }
      remaining -= kept.length * years.length;
      first.push({ model, rows: kept });
    });
    return { cuts, first, cells: cellCap - remaining };
  };
  let { cuts, first, cells } = firstWithin(CRAWL_CELL_CAP);
  // A reader's window is counted in characters, and long labels fill it with fewer cells: the tables' share shrinks until
  // their text fits, a tenth or more at a time. A cut table is measured with the longer of the two notes its caption may get.
  for (let tries = 0; tries < 8; tries += 1) {
    const chars = crawlReaderChars(first.map(({ model, rows }, index) => {
      const cut = cuts.find((candidate) => candidate.at === index);
      return crawlTable(model, rows, `${crawlCaption(model)}${cut ? ` · ${message(messages, "controls.crawlTop", { kept: cut.kept, of: cut.of })}` : ""}`, false);
    }));
    if (chars <= CRAWL_WINDOW_CHARS) break;
    ({ cuts, first, cells } = firstWithin(Math.floor(cells * Math.min(0.9, CRAWL_WINDOW_CHARS / chars))));
  }

  let room = CRAWL_PAGE_CELL_CAP - cells;
  const captions = first.map(({ model }) => crawlCaption(model));
  const rest: CrawlTable[] = [];
  const fold = (model: WorkbookExportModel, rows: readonly WorkbookReadableRow[], caption: (whole: boolean, shown: number) => string): boolean => {
    const years = model.readable.years;
    const slots = Math.max(0, Math.floor(room / Math.max(1, years.length)));
    const whole = rows.length <= slots;
    const largest = whole ? null : largestRows(rows, years, slots).kept;
    const shown = largest ? rows.filter((row) => largest.has(row)) : rows;
    room -= shown.length * years.length;
    if (shown.length > 0) rest.push(crawlTable(model, shown, caption(whole, shown.length), true));
    return whole;
  };
  for (const cut of cuts) {
    const caption = captions[cut.at]!;
    const whole = fold(cut.model, cut.others, (complete, shown) => `${caption} · ${complete
      ? message(messages, "controls.crawlOthers", { count: shown })
      : message(messages, "controls.crawlTop", { kept: shown, of: cut.others.length })}`);
    captions[cut.at] = `${caption} · ${message(messages, whole ? "controls.crawlTopMore" : "controls.crawlTop", { kept: cut.kept, of: cut.of })}`;
  }
  for (const model of earlier) {
    const rows = model.readable.rows;
    if (rows.length === 0) continue;
    const caption = crawlCaption(model);
    fold(model, rows, (complete, shown) => (complete ? caption : `${caption} · ${message(messages, "controls.crawlTop", { kept: shown, of: rows.length })}`));
  }
  return [...first.map(({ model, rows }, index) => crawlTable(model, rows, captions[index]!, false)), ...rest];
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
// React's own text escaping, so the string is byte for byte the markup React rendered from the same tables.
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!);

/** Tables as HTML; `category` heads the label column of a table that names none. */
export function crawlTablesHtml(tables: readonly CrawlTable[], category: string): string {
  return tables.map((table) =>
    `<table><caption>${escapeHtml(table.caption)}</caption>` +
    `<thead><tr><th>${escapeHtml(table.category ?? category)}</th>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>` +
    `<tbody>${table.rows.map((row) => `<tr><th>${escapeHtml(row.label)}</th>${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
  ).join("");
}

/**
 * A page's data-table block, the inner HTML of its crawl-tables wrapper (DESIGN.md §8.4): a label, then one named region with
 * the first tables and the `rest` tables folded in a closed <details>. A closed <details> costs a visitor no rendering, and
 * readers that take the page's HTML keep its content. The block is not on screen (`globals.css` hides its wrapper), so
 * nothing in it is a keyboard stop: the region takes no tabindex and the summary leaves the tab order, while a screen
 * reader still opens it. Nothing here carries a class.
 */
export function crawlBlockHtml(tables: readonly CrawlTable[], labels: { category: string; heading: string; rest: string }): string {
  if (tables.length === 0) return "";
  const first = tables.filter((table) => !table.rest);
  const rest = tables.filter((table) => table.rest);
  const heading = escapeHtml(labels.heading);
  // The region's name carries its first caption, so two blocks on one page (a section each) are told apart.
  return `<p>${heading}</p><div role="region" aria-label="${heading}: ${escapeHtml(tables[0]!.caption)}">${crawlTablesHtml(first, labels.category)}` +
    `${rest.length > 0 ? `<details><summary tabindex="-1">${escapeHtml(labels.rest)}</summary>${crawlTablesHtml(rest, labels.category)}</details>` : ""}</div>`;
}
