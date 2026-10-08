"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  /** Years re-based by the publisher: a 2px rule is drawn left of the column and `breakLabel` is printed on its header. In the year-rows layout the rule runs under the year's row, between it and the year before, and the label sits in the row's header. */
  breakYears?: number[];
  breakLabel?: string;
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
const STATUS_MARK_CLASS = "ml-1 text-[11px] min-[768px]:text-[9px] font-medium text-[var(--faint)] @max-[768px]:top-0 @max-[768px]:ml-0 @max-[768px]:block @max-[768px]:leading-tight";

// Below 768px of table width (DESIGN.md §12) the sticky label column wraps and is capped at
// 40% of the scroller, and the change/share columns scroll with the years instead of
// staying pinned: on a phone the pinned columns together were wider than the scroller
// and left no room for a single year.
const MOBILE_LABEL_CLASS =
  "@max-[768px]:pr-1.5 @max-[768px]:w-[40cqw] @max-[768px]:min-w-[40cqw] @max-[768px]:max-w-[40cqw] @max-[768px]:whitespace-normal @max-[768px]:break-words";
const PIN_RIGHT_CLASS = "sticky @max-[768px]:static";
// A value cell of the year-rows layout: flush right under its series header.
const ROWS_VALUE_CELL_CLASS = "pl-2 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap";

// Owner decision D5 (2026-10-07): below 768px a table of up to three series turns into
// one row per year, newest first, with the series as columns (the inflation month
// grid's layout), so a phone scrolls down instead of sideways. Wider selections keep
// the year columns above.
export const ROWS_LAYOUT_MAX_SERIES = 3;

/** Whether a table of `seriesCount` series, `tableWidth` px wide, renders as year rows. */
export function usesRowsLayout(seriesCount: number, tableWidth: number): boolean {
  return seriesCount > 0 && seriesCount <= ROWS_LAYOUT_MAX_SERIES && tableWidth > 0 && tableWidth < 768;
}

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
  breakYears,
  breakLabel,
  rowLabelsLocalized = false,
  shareValueForYear,
}: ExplorerTableProps<Row>) {
  const { locale, messages, englishLabels } = useI18n();
  const rowLabel = (row: Row) => (rowLabelsLocalized ? row.kaLabel : publicLabel(locale, row.itemId, row.kaLabel, englishLabels));
  const endYear = years.at(-1);
  const lastIndex = years.length - 1;
  const breakSet = new Set((breakYears ?? []).filter((year) => years.indexOf(year) > 0));
  const breakStyle = (year: number) => (breakSet.has(year) ? { borderLeft: "2px solid var(--ink)" } : undefined);
  // The label rides on its year's header in both layouts; on phones it drops under the year at 11px, as the status marks do.
  const breakMark = (year: number) =>
    breakLabel && breakSet.has(year) ? <sup className={`${STATUS_MARK_CLASS} normal-case tracking-normal`}>{breakLabel}</sup> : null;
  const cellValue = (row: Row, year: number): string => {
    const amount = row.valuesByYear[year];
    if (amount === null || amount === undefined) return MISSING;
    if (!share) return formatInUnit(amount, unit);
    return formatShare(shareValueForYear(row, year));
  };

  const cellPad = { paddingTop: 11, paddingBottom: 11 };
  const minWidth = (wrapRowLabels ? 180 : 320) + years.length * 78 + (showChangeColumn ? 128 : 0) + (shareColumnLabel ? 96 : 0);
  const labelClass = `${wrapRowLabels ? "w-[180px] min-w-[180px] max-w-[180px] whitespace-normal break-words" : "whitespace-nowrap"} ${MOBILE_LABEL_CLASS}`;

  // Narrow screens open on the latest year, the one the page headline talks about: the
  // scroller is moved so the last year column ends at its right edge (the change/share
  // columns stay one swipe further right).
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstYear = years[0];

  // The width decides the layout, so it is measured, not queried in CSS. It starts at 0
  // on the server and the client alike (hydration matches, year columns); the layout
  // effect swaps in the year rows before the first paint on a phone.
  const containerRef = useRef<HTMLDivElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => setTableWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const seriesRows = showTotal && totalRow ? (totalFirst ? [totalRow, ...rows] : [...rows, totalRow]) : rows;
  const rowsLayout = usesRowsLayout(seriesRows.length, tableWidth);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth >= 768) return;
    const latest = scroller.querySelector<HTMLElement>("thead th[data-latest-year]");
    if (!latest) return;
    const offset = latest.getBoundingClientRect().right - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollLeft = Math.max(0, offset - scroller.clientWidth);
  }, [firstYear, endYear, years.length, rowsLayout]);

  const statusMarks = (row: Row, year: number): ReactNode => (
    <>
      {(row.preliminaryByYear?.[year] ?? preliminaryYears?.includes(year)) ? <sup className={STATUS_MARK_CLASS}>{preliminaryLabel}</sup> : null}
      {row.basisByYear?.[year] === "planned" ? <sup className={STATUS_MARK_CLASS}>{message(messages, "controls.planned")}</sup> : null}
      {forecastLabel && forecastYears?.includes(year) ? <sup className={STATUS_MARK_CLASS}>{forecastLabel}</sup> : null}
    </>
  );

  if (rowsLayout) {
    const isTotal = (row: Row) => showTotal && row === totalRow;
    const summaryRows = [
      ...(showChangeColumn
        ? [{ key: "change", label: message(messages, "controls.change"), cell: (row: Row) => ({ text: formatShare(row.change ?? null, true), color: changeColor(row.change ?? null) }) }]
        : []),
      ...(shareColumnLabel
        ? [{ key: "share", label: `${shareColumnLabel} ${endYear ?? ""}`, cell: (row: Row) => ({ text: endYear === undefined ? MISSING : formatShare(shareValueForYear(row, endYear)), color: "var(--ink)" }) }]
        : []),
    ];
    return (
      <div ref={containerRef} className="@container mt-[18px]">
        <div ref={scrollerRef} data-testid="explorer-table" data-layout="rows" role="region" aria-label={caption} className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">{caption}</caption>
            <colgroup>
              <col className="w-[62px]" />
              {seriesRows.map((row) => <col key={row.itemId} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="border-b-2 border-[var(--ink)] pr-2 pt-1.5 pb-[9px] text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
                  {message(messages, "controls.year")}
                </th>
                {seriesRows.map((row) => (
                  <th
                    key={row.itemId}
                    scope="col"
                    data-series-id={row.itemId}
                    className={`border-b-2 border-[var(--ink)] pl-2 pt-1.5 pb-[9px] text-right align-bottom text-[11.5px] leading-[1.35] text-[var(--ink)] break-words ${isTotal(row) ? "font-semibold" : "font-medium"}`}
                  >
                    <SwatchBar color={row.color} className="mb-1.5 ml-auto block" />
                    {rowLabel(row)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((summary) => (
                <tr key={summary.key} data-summary={summary.key} className="border-b border-[var(--hairline)]">
                  <th scope="row" className="pr-2 text-left text-[11px] font-semibold leading-[1.3] text-[var(--muted)] break-words" style={cellPad}>
                    {summary.label}
                  </th>
                  {seriesRows.map((row) => {
                    const { text, color } = summary.cell(row);
                    return (
                      <td key={row.itemId} className={ROWS_VALUE_CELL_CLASS} style={{ ...cellPad, color, fontWeight: isTotal(row) ? 600 : 400 }}>
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {years.map((year, index) => ({ year, latest: index === lastIndex })).reverse().map(({ year, latest }) => (
                <tr
                  key={year}
                  data-year={year}
                  className="border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)]"
                  // Newest first, so the rule under a break year's row is the one between it and the year before.
                  style={breakSet.has(year) ? { borderBottom: "2px solid var(--ink)" } : undefined}
                >
                  <th scope="row" className="pr-2 text-left font-[family-name:var(--font-numeric)] text-[12.5px] font-semibold text-[var(--ink)]" style={cellPad}>
                    {year}
                    {breakMark(year)}
                  </th>
                  {seriesRows.map((row) => (
                    <td
                      key={row.itemId}
                      className={ROWS_VALUE_CELL_CLASS}
                      style={{ ...cellPad, fontWeight: latest || isTotal(row) ? 600 : 400, color: latest || isTotal(row) ? "var(--ink)" : "var(--body)" }}
                    >
                      {cellValue(row, year)}
                      {statusMarks(row, year)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const total = showTotal && totalRow ? (
    <tr className="border-t-2 border-[var(--ink)]">
      <td className={`sticky left-0 z-[1] bg-[var(--paper)] pr-3 text-[13px] font-semibold shadow-[1px_0_0_var(--hairline-soft)] @max-[768px]:text-[12px] @max-[768px]:leading-[1.35] ${labelClass}`} style={cellPad}>
        {rowLabel(totalRow)}
      </td>
      {years.map((year) => (
        <td key={year} className={`${numericCellClass} font-semibold text-[var(--ink)]`} style={{ ...cellPad, ...breakStyle(year) }}>
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
    <div ref={containerRef} className="@container mt-[18px]">
      <div
        ref={scrollerRef}
        data-testid="explorer-table"
        data-layout="columns"
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
              <th key={year} data-latest-year={index === lastIndex ? "" : undefined} style={breakStyle(year)} className={`${headCellClass} font-[family-name:var(--font-numeric)] tracking-[0.04em]`}>
                {year}
                {breakMark(year)}
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
                    ...breakStyle(year),
                    fontWeight: index === lastIndex ? 600 : 400,
                    color: index === lastIndex ? "var(--ink)" : "var(--body)",
                  }}
                >
                  {cellValue(row, year)}
                  {statusMarks(row, year)}
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
