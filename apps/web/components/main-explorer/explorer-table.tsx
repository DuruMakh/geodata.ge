import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";
import type { ExplorerTableRow } from "../../lib/explorer/types";
import { TableSurface } from "../ui/surfaces";

type ExplorerTableProps = {
  rows: ExplorerTableRow[];
  years: number[];
};

export function ExplorerTable({ rows, years }: ExplorerTableProps) {
  if (rows.length === 0) {
    return (
      <TableSurface testId="explorer-table">
        <div className="p-6 text-sm text-[var(--body)]">{"\u10d0\u10e0\u10e9\u10d4\u10e3\u10da\u10d8 \u10db\u10ec\u10d9\u10e0\u10d8\u10d5\u10d8 \u10d0\u10e0 \u10d0\u10e0\u10d8\u10e1."}</div>
      </TableSurface>
    );
  }

  return (
    <TableSurface testId="explorer-table">
      <table className="min-w-[760px] w-full border-collapse text-sm">
        <thead className="border-b border-[var(--hairline)] bg-[var(--soft)] text-xs uppercase text-[var(--mute)]">
          <tr>
            <th className="px-3 py-3">{"\u10e1\u10d0\u10d1\u10d8\u10e3\u10ef\u10d4\u10e2\u10dd \u10db\u10e3\u10ee\u10da\u10d8"}</th>
            {years.map((year) => (
              <th key={year} className="px-3 py-3">
                {year}
              </th>
            ))}
            <th className="px-3 py-3">{"\u10ea\u10d5\u10da\u10d8\u10da\u10d4\u10d1\u10d0"}</th>
            <th className="px-3 py-3">{"\u10ec\u10d8\u10da\u10d8"} {years.at(-1)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId} className="border-b border-[var(--hairline-soft)]">
              <td className="px-3 py-3 font-medium text-[var(--ink)]">{row.kaLabel}</td>
              {years.map((year) => (
                <td key={year} className="whitespace-nowrap px-3 py-3 text-[var(--body)]">
                  {formatGel(row.valuesByYear[year] ?? null)}
                  {row.basisByYear[year] === "planned" ? (
                    <span className="ml-2 rounded-full border border-[var(--orange)] px-1.5 py-0.5 text-[10px] text-[var(--orange)]">
                      {"\u10d2\u10d4\u10d2\u10db\u10d0"}
                    </span>
                  ) : null}
                </td>
              ))}
              <td className="px-3 py-3 text-[var(--body)]">{formatSignedPercent(row.change)}</td>
              <td className="px-3 py-3 text-[var(--body)]">{formatPercent(row.shareEndYear)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableSurface>
  );
}
