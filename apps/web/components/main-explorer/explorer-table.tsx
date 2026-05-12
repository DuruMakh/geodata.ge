import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";
import type { ExplorerTableRow } from "../../lib/explorer/types";

type ExplorerTableProps = {
  rows: ExplorerTableRow[];
  years: number[];
};

export function ExplorerTable({ rows, years }: ExplorerTableProps) {
  if (rows.length === 0) {
    return (
      <div className="border border-cyan-400/20 bg-black/40 p-6 text-sm text-zinc-400">
        არჩეული მწკრივი არ არის.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-cyan-400/20 bg-black/40">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-3 py-3">საბიუჯეტო მუხლი</th>
            {years.map((year) => (
              <th key={year} className="px-3 py-3">
                {year}
              </th>
            ))}
            <th className="px-3 py-3">ცვლილება</th>
            <th className="px-3 py-3">წილი {years.at(-1)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId} className="border-b border-zinc-900">
              <td className="px-3 py-3 font-medium text-zinc-100">{row.kaLabel}</td>
              {years.map((year) => (
                <td key={year} className="whitespace-nowrap px-3 py-3 text-zinc-300">
                  {formatGel(row.valuesByYear[year] ?? null)}
                  {row.basisByYear[year] === "planned" ? (
                    <span className="ml-2 border border-amber-300/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                      გეგმა
                    </span>
                  ) : null}
                </td>
              ))}
              <td className="px-3 py-3 text-zinc-300">{formatSignedPercent(row.change)}</td>
              <td className="px-3 py-3 text-zinc-300">{formatPercent(row.shareEndYear)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
