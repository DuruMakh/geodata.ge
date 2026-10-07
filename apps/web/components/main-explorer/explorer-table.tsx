"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { ExplorerTableRow } from "../../lib/explorer/types";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { formatInUnit, formatShare, MISSING, type ValueUnit } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { SwatchBar } from "../ui/editorial";

// Table mode per DESIGN.md §8.4: newspaper anatomy — 2px ink rules on the header and
// total row, mono right-aligned numerals.

type ExplorerTableRowLike = Pick<ExplorerTableRow, "itemId" | "kaLabel" | "color" | "valuesByYear"> & {
  basisByYear?: ExplorerTableRow["basisByYear"];
  preliminaryByYear?: Record<number, boolean>;
  change?: ExplorerTableRow["change"];
};

type ExplorerTableProps<Row extends ExplorerTableRowLike> = {
  caption: string;
  rows: Row[];
  totalRow: Row | null;
  showTotal: boolean;
  totalFirst?: boolean;
  wrapRowLabels?: boolean;
  years: number[];
  firstColumnLabel: string;
  unit: ValueUnit;
  share: boolean;
  showChangeColumn?: boolean;
  shareColumnLabel?: string;
  forecastYears?: number[];
  forecastLabel?: string;
  preliminaryYears?: number[];
  preliminaryLabel?: string;
  /** Each row's `kaLabel` already holds its label in the page language, with no catalogue entry to look up. */
  rowLabelsLocalized?: boolean;
  shareValueForYear: (row: Row, year: number) => number | null;
};

const headCellClass =
  "border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-[9px] text-right text-[11px] font-semibold text-[var(--muted)] whitespace-nowrap";
const numericCellClass =
  "px-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap @max-[768px]:px-2.5";
// On phones a status mark (preliminary, planned, forecast) drops under its number
// rather than widening every year column.
const STATUS_MARK_CLASS = "ml-1 text-[9px] font-medium text-[var(--faint)] @max-[768px]:ml-0 @max-[768px]:block";

// Below 768px of table width (DESIGN.md §12) the sticky label column wraps and is capped at
// 40% of the scroller, and the change/share columns scroll with the years instead of
// staying pinned: on a phone the pinned columns together were wider than the scroller
// and left no room for a single year.
const MOBILE_LABEL_CLASS =
  "@max-[768px]:pr-1.5 @max-[768px]:w-[40cqw] @max-[768px]:min-w-[40cqw] @max-[768px]:max-w-[40cqw] @max-[768px]:whitespace-normal @max-[768px]:[overflow-wrap:anywhere]";
const PIN_RIGHT_CLASS = "sticky @max-[768px]:static";

function changeColor(change: number | null): string {
  if (change === null) return "var(--muted)";
  return change >= 0 ? POSITIVE : NEGATIVE;
}

export function ExplorerTable<Row extends ExplorerTableRowLike>({
  caption,
  rows,
  totalRow,
  showTotal,
  totalFirst = false,
  wrapRowLabels = false,
  years,
  firstColumnLabel,
  unit,
  share,
  showChangeColumn = true,
  shareColumnLabel,
  forecastYears,
  forecastLabel,
  preliminaryYears,
  preliminaryLabel,
  rowLabelsLocalized = false,
  shareValueForYear,
}: ExplorerTableProps<Row>) {
  const { locale, messages, englishLabels } = useI18n();
  const rowLabel = (row: Row) => (rowLabelsLocalized ? row.kaLabel : publicLabel(locale, row.itemId, row.kaLabel, englishLabels));
  const endYear = years.at(-1);
  const lastIndex = years.length - 1;
  const cellValue = (row: Row, year: number): string => {
    const amount = row.valuesByYear[year];
    if (amount === null || amount === undefined) return MISSING;
    if (!share) return formatInUnit(amount, unit);
    return formatShare(shareValueForYear(row, year));
  };

  const cellPad = { paddingTop: 11, paddingBottom: 11 };
  const minWidth = (wrapRowLabels ? 180 : 320) + years.length * 78 + (showChangeColumn ? 128 : 0) + (shareColumnLabel ? 96 : 0);
  const labelClass = `${wrapRowLabels ? "w-[180px] min-w-[180px] max-w-[180px] whitespace-normal [overflow-wrap:anywhere]" : "whitespace-nowrap"} ${MOBILE_LABEL_CLASS}`;

  // Narrow screens open on the latest year, the one the page headline talks about: the
  // scroller is moved so the last year column ends at its right edge (the change/share
  // columns stay one swipe further right).
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstYear = years[0];
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth >= 768) return;
    const latest = scroller.querySelector<HTMLElement>("thead th[data-latest-year]");
    if (!latest) return;
    const offset = latest.getBoundingClientRect().right - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollLeft = Math.max(0, offset - scroller.clientWidth);
  }, [firstYear, endYear, years.length]);

  const total = showTotal && totalRow ? (
    <tr className="border-t-2 border-[var(--ink)]">
      <td className={`sticky left-0 z-[1] bg-[var(--paper)] pr-3 text-[13px] font-semibold shadow-[1px_0_0_var(--hairline-soft)] @max-[768px]:text-[12px] @max-[768px]:leading-[1.35] ${labelClass}`} style={cellPad}>
        {rowLabel(totalRow)}
      </td>
      {years.map((year) => (
        <td key={year} className={`${numericCellClass} font-semibold text-[var(--ink)]`} style={cellPad}>
          {cellValue(totalRow, year)}
          {totalRow.preliminaryByYear?.[year] ? <sup className={STATUS_MARK_CLASS}>{preliminaryLabel}</sup> : null}
          {forecastLabel && forecastYears?.includes(year) ? (
            <sup className={STATUS_MARK_CLASS}>{forecastLabel}</sup>
          ) : null}
        </td>
      ))}
      {showChangeColumn ? (
        <td
          className={`${numericCellClass} ${PIN_RIGHT_CLASS} ${shareColumnLabel ? "right-24" : "right-0"} z-[1] bg-[var(--paper)] font-semibold shadow-[-1px_0_0_var(--hairline-soft)]`}
          style={{ ...cellPad, color: changeColor(totalRow.change ?? null) }}
        >
          {formatShare(totalRow.change ?? null, true)}
        </td>
      ) : null}
      {shareColumnLabel ? (
        <td className={`${numericCellClass} ${PIN_RIGHT_CLASS} right-0 z-[1] bg-[var(--paper)] pr-0 font-semibold text-[var(--ink)]`} style={cellPad}>
          {endYear === undefined ? MISSING : formatShare(shareValueForYear(totalRow, endYear))}
        </td>
      ) : null}
    </tr>
  ) : null;

  return (
    <div className="@container mt-[18px]">
      <div
        ref={scrollerRef}
        data-testid="explorer-table"
        role="region"
        tabIndex={0}
        aria-label={message(messages, "controls.tableScrollable")}
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {/* The desktop minimum spreads columns over a wide frame; on phones it would only pad
            every year column and push the numbers off-screen, so columns size to content. */}
        <table
          className="w-full min-w-[var(--table-min-width)] border-collapse @max-[768px]:min-w-0"
          style={{ "--table-min-width": `${minWidth}px` } as CSSProperties}
        >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className={`sticky left-0 z-[2] border-b-2 border-[var(--ink)] bg-[var(--paper)] pr-3 pt-1.5 pb-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] shadow-[1px_0_0_var(--hairline-soft)] ${labelClass}`}>
              {firstColumnLabel}
            </th>
            {years.map((year, index) => (
              <th key={year} data-latest-year={index === lastIndex ? "" : undefined} className={`${headCellClass} font-[family-name:var(--font-numeric)] tracking-[0.04em]`}>
                {year}
              </th>
            ))}
            {showChangeColumn ? (
              <th className={`${headCellClass} ${PIN_RIGHT_CLASS} ${shareColumnLabel ? "right-24" : "right-0"} z-[2] w-28 min-w-28 bg-[var(--paper)] uppercase tracking-[0.06em] shadow-[-1px_0_0_var(--hairline-soft)]`}>
                {message(messages, "controls.change")}
              </th>
            ) : null}
            {shareColumnLabel ? (
              <th className={`${headCellClass} ${PIN_RIGHT_CLASS} right-0 z-[2] w-24 min-w-24 bg-[var(--paper)] pr-0 uppercase tracking-[0.06em]`}>
                {shareColumnLabel} {endYear}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {totalFirst ? total : null}
          {rows.map((row) => (
            <tr key={row.itemId} className="border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)]">
              <td
                className={`sticky left-0 z-[1] bg-[var(--paper)] pr-3 shadow-[1px_0_0_var(--hairline-soft)] ${labelClass}`}
                style={cellPad}
                title={rowLabel(row)}
              >
                <span className="inline-flex items-center gap-[9px] @max-[768px]:gap-1">
                  <SwatchBar color={row.color} />
                  <span className="text-[13px] font-medium text-[var(--ink)] @max-[768px]:text-[12px] @max-[768px]:leading-[1.35]">{rowLabel(row)}</span>
                </span>
              </td>
              {years.map((year, index) => (
                <td
                  key={year}
                  className={numericCellClass}
                  style={{
                    ...cellPad,
                    fontWeight: index === lastIndex ? 600 : 400,
                    color: index === lastIndex ? "var(--ink)" : "var(--body)",
                  }}
                >
                  {cellValue(row, year)}
                  {(row.preliminaryByYear?.[year] ?? preliminaryYears?.includes(year)) ? <sup className={STATUS_MARK_CLASS}>{preliminaryLabel}</sup> : null}
                  {row.basisByYear?.[year] === "planned" ? (
                    <sup className={STATUS_MARK_CLASS}>{message(messages, "controls.planned")}</sup>
                  ) : null}
                  {forecastLabel && forecastYears?.includes(year) ? (
                    <sup className={STATUS_MARK_CLASS}>{forecastLabel}</sup>
                  ) : null}
                </td>
              ))}
              {showChangeColumn ? (
                <td
                  className={`${numericCellClass} ${PIN_RIGHT_CLASS} ${shareColumnLabel ? "right-24" : "right-0"} z-[1] bg-[var(--paper)] shadow-[-1px_0_0_var(--hairline-soft)]`}
                  style={{ ...cellPad, color: changeColor(row.change ?? null) }}
                >
                  {formatShare(row.change ?? null, true)}
                </td>
              ) : null}
              {shareColumnLabel ? (
                <td className={`${numericCellClass} ${PIN_RIGHT_CLASS} right-0 z-[1] bg-[var(--paper)] pr-0 text-[var(--muted)]`} style={cellPad}>
                  {endYear === undefined ? MISSING : formatShare(shareValueForYear(row, endYear))}
                </td>
              ) : null}
            </tr>
          ))}
          {totalFirst ? null : total}
        </tbody>
        </table>
      </div>
    </div>
  );
}
