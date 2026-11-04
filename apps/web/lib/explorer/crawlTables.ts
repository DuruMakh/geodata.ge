import { message } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/types";
import { workbookMessage } from "../i18n/workbook";
import { MISSING } from "./format";
import { readableRowLabel, type WorkbookBasis, type WorkbookExportModel, type WorkbookReadableRow } from "./workbookModel";

export const CRAWL_CELL_CAP = 3000;
/** The most months a monthly view's crawl tables carry; its crawl states choose the window (`lastPeriodsRange`). */
export const CRAWL_MONTH_COLUMNS = 36;

export type CrawlTable = { caption: string; columns: string[]; rows: { label: string; cells: string[] }[] };

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
  const minimum = (decimalPart.match(/0/g) ?? []).length;
  const maximum = minimum + (decimalPart.match(/#/g) ?? []).length;
  const percent = section.includes("%");
  const digits = numberFormatter(minimum, maximum, integerPart.includes(",")).format(Math.abs(percent ? value * 100 : value));
  const sign = value < 0 ? "−" : section.trimStart().startsWith("+") ? "+" : "";
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
    let caption = `${readable.title} · ${readable.subtitle}`;
    if (allRows.length > maxRows) {
      const totals = allRows.length - items.length;
      const itemSlots = Math.max(0, maxRows - totals);
      const ranked: Candidate[] = items.map((row) => ({ row, latest: latestMagnitude(row, years) }));
      const top = new Set(ranked.map((candidate, order) => ({ ...candidate, order })).sort((a, b) => b.latest - a.latest || a.order - b.order).slice(0, itemSlots).map((candidate) => candidate.row));
      kept = allRows.filter((row) => row.kind === "total" || top.has(row));
      caption += ` · ${message(messages, "controls.crawlTop", { kept: Math.min(itemSlots, items.length), of: items.length })}`;
    }
    remaining -= kept.length * years.length;
    const fallback = defaultFormat(readable);
    tables.push({
      caption,
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
