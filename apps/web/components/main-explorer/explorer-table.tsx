import type { ExplorerTableRow } from "../../lib/explorer/types";
import { formatInUnit, formatShare, MISSING, type ValueUnit } from "../../lib/explorer/format";
import { SwatchBar } from "../ui/editorial";
import { HorizontalScrollHint } from "../ui/horizontal-scroll-hint";

// Table mode per DESIGN.md §8.4: newspaper anatomy — 2px ink rules on the header and
// total row, mono right-aligned numerals.

type ExplorerTableProps = {
  caption: string;
  rows: ExplorerTableRow[];
  totalRow: ExplorerTableRow | null;
  showTotal: boolean;
  years: number[];
  firstColumnLabel: string;
  unit: ValueUnit;
  share: boolean;
  shareValueForYear: (row: ExplorerTableRow, year: number) => number | null;
};

const headCellClass =
  "border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-[9px] text-right text-[11px] font-semibold text-[var(--muted)] whitespace-nowrap";
const numericCellClass = "px-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap";

export function ExplorerTable({ caption, rows, totalRow, showTotal, years, firstColumnLabel, unit, share, shareValueForYear }: ExplorerTableProps) {
  const lastIndex = years.length - 1;
  const cellValue = (row: ExplorerTableRow, year: number): string => {
    const amount = row.valuesByYear[year];
    if (amount === null || amount === undefined) return MISSING;
    if (!share) return formatInUnit(amount, unit);
    return formatShare(shareValueForYear(row, year));
  };

  const cellPad = { paddingTop: 11, paddingBottom: 11 };
  const minWidth = 320 + years.length * 78;

  return (
    <div className="mt-[18px]">
      <HorizontalScrollHint testId="table-scroll-hint" />
      <div
        data-testid="explorer-table"
        role="region"
        tabIndex={0}
        aria-label="მრავალწლიანი ცხრილი — ჰორიზონტალურად გადაადგილებადი"
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <table className="w-full border-collapse" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th className="sticky left-0 z-[2] border-b-2 border-[var(--ink)] bg-[var(--paper)] pr-3 pt-1.5 pb-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] whitespace-nowrap shadow-[1px_0_0_var(--hairline-soft)]">
              {firstColumnLabel}
            </th>
            {years.map((year) => (
              <th key={year} className={`${headCellClass} font-[family-name:var(--font-numeric)] tracking-[0.04em]`}>
                {year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId} className="border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)]">
              <td
                className="sticky left-0 z-[1] bg-[var(--paper)] pr-3 whitespace-nowrap shadow-[1px_0_0_var(--hairline-soft)]"
                style={cellPad}
                title={row.kaLabel}
              >
                <span className="inline-flex items-center gap-[9px]">
                  <SwatchBar color={row.color} />
                  <span className="text-[13px] font-medium text-[var(--ink)]">{row.kaLabel}</span>
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
                  {row.basisByYear[year] === "planned" ? (
                    <sup className="ml-1 text-[9px] font-medium text-[var(--faint)]">გეგმა</sup>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
          {showTotal && totalRow ? (
            <tr className="border-t-2 border-[var(--ink)]">
              <td className="sticky left-0 z-[1] bg-[var(--paper)] pr-3 text-[13px] font-semibold whitespace-nowrap shadow-[1px_0_0_var(--hairline-soft)]" style={cellPad}>
                {totalRow.kaLabel}
              </td>
              {years.map((year) => (
                <td key={year} className={`${numericCellClass} font-semibold text-[var(--ink)]`} style={cellPad}>
                  {cellValue(totalRow, year)}
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
        </table>
      </div>
    </div>
  );
}
