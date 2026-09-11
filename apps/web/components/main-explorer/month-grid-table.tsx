"use client";

import type { ReactNode } from "react";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { MISSING } from "../../lib/explorer/format";
import { GRID_TINTS, type GridCell, type GridRow } from "../../lib/explorer/inflationGrid";
import { HorizontalScrollHint } from "../ui/horizontal-scroll-hint";

// The ცხრილი view for monthly data (spec §7.1). ExplorerTable's anatomy — 2px ink
// header rule, hairline rows, mono right-aligned numerals, sticky first column,
// horizontal scroll — on a years × months grid.

type MonthGridTableProps = {
  caption: string;
  yearLabel: string;
  monthLabels: readonly string[];
  monthNames: readonly string[];
  summaryLabel?: string;
  rows: GridRow[];
  formatValue: (value: number) => string;
  legend: Array<{ label: string; tint: number }> | null;
  legendLabel: string;
  picker?: ReactNode;
};

const headCell = "border-b-2 border-[var(--ink)] px-2 pt-1.5 pb-[9px] text-right align-bottom text-[11px] font-semibold text-[var(--muted)]";
const numericCell = "px-2 py-[9px] text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap";

export function MonthGridTable({ caption, yearLabel, monthLabels, monthNames, summaryLabel, rows, formatValue, legend, legendLabel, picker }: MonthGridTableProps) {
  const { messages } = useI18n();
  const hasSummary = rows.some((row) => row.summary !== null);

  const cell = (entry: GridCell, key: string, title: (formatted: string) => string) => {
    if (entry.kind === "empty") return <td key={key} className={numericCell} />;
    if (entry.kind === "missing") return <td key={key} className={`${numericCell} text-[var(--faint)]`}>{MISSING}</td>;
    const formatted = formatValue(entry.value);
    const tint = entry.bin === null ? null : GRID_TINTS[entry.bin]!;
    return (
      <td
        key={key}
        data-testid="month-grid-cell"
        data-bin={entry.bin ?? undefined}
        title={title(formatted)}
        className={numericCell}
        style={tint ? { backgroundColor: tint.background, color: tint.text } : { color: "var(--body)" }}
      >
        {formatted}
      </td>
    );
  };

  return (
    <div className="mt-[18px]">
      {picker ? <div className="mb-4">{picker}</div> : null}
      <HorizontalScrollHint testId="table-scroll-hint" />
      <div
        data-testid="month-grid"
        role="region"
        tabIndex={0}
        aria-label={message(messages, "controls.tableScrollable")}
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        {/* Sized to fit the 1440px workspace (~808px) with the summary column; narrower screens scroll. */}
        <table className="w-full border-collapse" style={{ minWidth: 64 + 12 * 54 + (hasSummary ? 76 : 0) }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[2] border-b-2 border-[var(--ink)] bg-[var(--paper)] pr-3 pt-1.5 pb-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] shadow-[1px_0_0_var(--hairline-soft)]">
                {yearLabel}
              </th>
              {monthLabels.map((label) => (
                <th key={label} scope="col" className={`${headCell} whitespace-nowrap`}>{label}</th>
              ))}
              {hasSummary ? <th scope="col" className={`${headCell} uppercase tracking-[0.06em]`}>{summaryLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} data-testid="month-grid-row" data-year={row.year} className="border-b border-[var(--hairline-soft)]">
                <th scope="row" className="sticky left-0 z-[1] bg-[var(--paper)] pr-3 text-left font-[family-name:var(--font-numeric)] text-[12.5px] font-semibold text-[var(--ink)] shadow-[1px_0_0_var(--hairline-soft)]">
                  {row.year}
                </th>
                {row.cells.map((entry, index) => cell(entry, String(index), (formatted) => `${monthNames[index]} ${row.year}: ${formatted}`))}
                {hasSummary ? cell(row.summary ?? { kind: "empty" }, "summary", (formatted) => `${summaryLabel} ${row.year}: ${formatted}`) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {legend ? (
        <div data-testid="month-grid-legend" aria-label={legendLabel} role="group" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--muted)]">
          {legend.map((step) => (
            <span key={step.label} data-testid="month-grid-legend-step" className="inline-flex items-center gap-1.5 font-[family-name:var(--font-numeric)]">
              <span aria-hidden className="inline-block size-3" style={{ backgroundColor: GRID_TINTS[step.tint]!.background }} />
              {step.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
