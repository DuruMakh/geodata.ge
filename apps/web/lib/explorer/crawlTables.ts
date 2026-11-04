import { message } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import { MISSING } from "./format";
import { readableBasisLabel, readableRowLabel, type WorkbookBasis, type WorkbookExportModel, type WorkbookReadableRow } from "./workbookModel";

export const CRAWL_CELL_CAP = 3000;
/** The most months a monthly view's crawl tables carry; its crawl states choose the window (`lastPeriodsRange`). */
export const CRAWL_MONTH_COLUMNS = 36;
/** The most decimals a crawl cell prints: enough for any figure a reader quotes, whatever digits the workbook keeps. */
export const CRAWL_MAX_DECIMALS = 3;

/** `category` heads the label column when the workbook names it (`headerLabels.category`); otherwise the page writes "Category". */
export type CrawlTable = { caption: string; category?: string; columns: string[]; rows: { label: string; cells: string[] }[] };

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
  const digits = numberFormatter(minimum, maximum, integerPart.includes(",")).format(Math.abs(percent ? value * 100 : value));
  // A negative that rounds to zero digits reads "0.0", not "−0.0".
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

export function crawlTables(models: readonly WorkbookExportModel[], messages: Messages): CrawlTable[] {
  const withRows = models.filter((model) => model.readable.rows.length > 0);
  const tables: CrawlTable[] = [];
  let remaining = CRAWL_CELL_CAP;
  withRows.forEach((model, index) => {
    const { readable, locale } = model;
    // Every column is kept: a monthly workbook has a row per year and at most 13 columns, and its crawl state already
    // narrows it to the last months, so trimming columns here would only cut the early years of a yearly table.
    const years = readable.years;
    const columns = readable.headerLabels ? readable.headerLabels.columns : years.map(String);
    const budget = Math.floor(remaining / (withRows.length - index));
    const maxRows = Math.max(1, Math.floor(budget / Math.max(1, years.length)));
    const allRows = readable.rows;
    const items = allRows.filter((row) => row.kind !== "total");
    let kept = allRows;
    let caption = crawlCaption(model);
    if (allRows.length > maxRows) {
      const totals = allRows.length - items.length;
      const itemSlots = Math.max(0, maxRows - totals);
      // A series with no figure in any year never takes a slot from one that has figures.
      const ranked: Candidate[] = items.filter((row) => hasFigure(row, years)).map((row) => ({ row, latest: latestMagnitude(row, years) }));
      const top = new Set(ranked.map((candidate, order) => ({ ...candidate, order })).sort((a, b) => b.latest - a.latest || a.order - b.order).slice(0, itemSlots).map((candidate) => candidate.row));
      kept = allRows.filter((row) => row.kind === "total" || top.has(row));
      caption += ` · ${message(messages, "controls.crawlTop", { kept: Math.min(itemSlots, ranked.length), of: items.length })}`;
    }
    remaining -= kept.length * years.length;
    const fallback = defaultFormat(readable);
    tables.push({
      caption,
      ...(readable.headerLabels ? { category: readable.headerLabels.category } : {}),
      columns,
      rows: kept.map((row) => ({
        label: readableRowLabel(row),
        cells: years.map((year) => formatCrawlCell(
          row.valuesByYear[year] ?? null,
          row.basisByYear[year] ?? null,
          row.numberFormatByYear?.[year] ?? row.numberFormat ?? readable.numberFormat ?? fallback,
          locale,
        )),
      })),
    });
  });
  return tables;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };
// React's own text escaping, so the string is byte for byte the markup React rendered from the same tables.
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!);

/** The crawl tables as the HTML inside their hidden wrapper; `category` heads the label column of a table that names none. */
export function crawlTablesHtml(tables: readonly CrawlTable[], category: string): string {
  return tables.map((table) =>
    `<table><caption>${escapeHtml(table.caption)}</caption>` +
    `<thead><tr><th>${escapeHtml(table.category ?? category)}</th>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>` +
    `<tbody>${table.rows.map((row) => `<tr><th>${escapeHtml(row.label)}</th>${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
  ).join("");
}
