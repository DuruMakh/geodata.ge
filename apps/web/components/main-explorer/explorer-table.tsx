import type { ExplorerScope, ExplorerTableRow } from "../../lib/explorer/types";
import { formatBn, formatShare, MISSING } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { SwatchBar } from "../ui/editorial";

// Table mode per DESIGN.md §8.4: newspaper anatomy — 2px ink rules on the header and
// total row, mono right-aligned numerals, sticky label/change/share columns.

type ExplorerTableProps = {
  rows: ExplorerTableRow[];
  totalRow: ExplorerTableRow | null;
  years: number[];
  scope: ExplorerScope;
  share: boolean;
};

const FIRST_COL_LABEL: Record<ExplorerScope, string> = {
  fields: "სფერო",
  ministries: "უწყება",
  revenue: "საბიუჯეტო მუხლი",
};

const headCellClass =
  "border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-[9px] text-right text-[11px] font-semibold text-[var(--muted)] whitespace-nowrap";
const numericCellClass = "px-3 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap";

function changeColor(change: number | null): string {
  if (change === null) return "var(--muted)";
  return change >= 0 ? POSITIVE : NEGATIVE;
}

export function ExplorerTable({ rows, totalRow, years, scope, share }: ExplorerTableProps) {
  const endYear = years.at(-1);
  const lastIndex = years.length - 1;
  const totalsByYear = new Map(years.map((year) => [year, totalRow?.valuesByYear[year] ?? null]));

  const cellValue = (row: ExplorerTableRow, year: number): string => {
    const amount = row.valuesByYear[year];
    if (amount === null || amount === undefined) return MISSING;
    if (!share) return formatBn(amount);
    const total = totalsByYear.get(year);
    return total ? formatShare(amount / total) : MISSING;
  };

  const cellPad = { paddingTop: 11, paddingBottom: 11 };
  const minWidth = 320 + years.length * 78 + 208;

  return (
    <div data-testid="explorer-table" className="mt-[18px] overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-[2] border-b-2 border-[var(--ink)] bg-[var(--paper)] pr-3 pt-1.5 pb-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] whitespace-nowrap shadow-[1px_0_0_var(--hairline-soft)]">
              {FIRST_COL_LABEL[scope]}
            </th>
            {years.map((year) => (
              <th key={year} className={`${headCellClass} font-[family-name:var(--font-numeric)] tracking-[0.04em]`}>
                {year}
              </th>
            ))}
            <th className={`${headCellClass} sticky right-24 z-[2] w-28 min-w-28 bg-[var(--paper)] uppercase tracking-[0.06em] shadow-[-1px_0_0_var(--hairline-soft)]`}>
              ცვლილება
            </th>
            <th className={`${headCellClass} sticky right-0 z-[2] w-24 min-w-24 bg-[var(--paper)] pr-0 uppercase tracking-[0.06em]`}>
              წილი {endYear}
            </th>
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
              <td
                className={`${numericCellClass} sticky right-24 z-[1] bg-[var(--paper)] shadow-[-1px_0_0_var(--hairline-soft)]`}
                style={{ ...cellPad, color: changeColor(row.change) }}
              >
                {formatShare(row.change, true)}
              </td>
              <td className={`${numericCellClass} sticky right-0 z-[1] bg-[var(--paper)] pr-0 text-[var(--muted)]`} style={cellPad}>
                {formatShare(row.shareEndYear)}
              </td>
            </tr>
          ))}
          {totalRow ? (
            <tr className="border-t-2 border-[var(--ink)]">
              <td className="sticky left-0 z-[1] bg-[var(--paper)] pr-3 text-[13px] font-semibold whitespace-nowrap shadow-[1px_0_0_var(--hairline-soft)]" style={cellPad}>
                სულ
              </td>
              {years.map((year) => (
                <td key={year} className={`${numericCellClass} font-semibold text-[var(--ink)]`} style={cellPad}>
                  {share ? "100.0%" : formatBn(totalRow.valuesByYear[year] ?? null)}
                </td>
              ))}
              <td
                className={`${numericCellClass} sticky right-24 z-[1] bg-[var(--paper)] font-semibold shadow-[-1px_0_0_var(--hairline-soft)]`}
                style={{ ...cellPad, color: changeColor(totalRow.change) }}
              >
                {formatShare(totalRow.change, true)}
              </td>
              <td className={`${numericCellClass} sticky right-0 z-[1] bg-[var(--paper)] pr-0 font-semibold text-[var(--ink)]`} style={cellPad}>
                100.0%
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
