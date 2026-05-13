"use client";

import { useMemo, useState } from "react";
import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type SingleYearRankingProps = {
  rows: SnapshotItem[];
};

type SortKey = "amount" | "share" | "change";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "amount", label: "GEL" },
  { key: "share", label: "წილი" },
  { key: "change", label: "ცვლილება" },
];

function sortableValue(row: SnapshotItem, sortKey: SortKey): number | null {
  if (sortKey === "amount") return row.amountGel;
  if (sortKey === "share") return row.shareOfTotal;
  return row.changeFromPreviousYear;
}

export function SingleYearRanking({ rows }: SingleYearRankingProps) {
  const [sortKey, setSortKey] = useState<SortKey>("amount");

  const sortedRows = useMemo(
    () =>
      [...rows].sort((left, right) => {
        const leftValue = sortableValue(left, sortKey);
        const rightValue = sortableValue(right, sortKey);

        if (leftValue === null && rightValue === null) return left.kaLabel.localeCompare(right.kaLabel);
        if (leftValue === null) return 1;
        if (rightValue === null) return -1;
        return rightValue - leftValue;
      }),
    [rows, sortKey],
  );

  return (
    <section data-testid="single-year-ranking" className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">სრული რეიტინგი</h3>
        <div className="flex flex-wrap gap-2" aria-label="Sort full ranking">
          {sortOptions.map((option) => {
            const active = sortKey === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSortKey(option.key)}
                className={[
                  "border px-3 py-1.5 font-mono text-xs uppercase transition",
                  active
                    ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                    : "border-cyan-400/20 bg-black/30 text-zinc-400 hover:border-cyan-300/50 hover:text-cyan-100",
                ].join(" ")}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="overflow-x-auto border border-cyan-400/20 bg-black/40">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-cyan-400/20 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-3 font-mono">Rank</th>
              <th className="px-3 py-3">მუხლი</th>
              <th className="px-3 py-3 font-mono">GEL</th>
              <th className="px-3 py-3 font-mono">წილი</th>
              <th className="px-3 py-3 font-mono">ცვლილება</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={row.itemId} className="border-b border-zinc-800/80 last:border-b-0">
                <td className="px-3 py-3 font-mono text-zinc-500">{index + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 border border-white/20" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-zinc-100">{row.kaLabel}</span>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-cyan-100">{formatGel(row.amountGel)}</td>
                <td className="px-3 py-3 font-mono text-zinc-300">{formatPercent(row.shareOfTotal)}</td>
                <td className="px-3 py-3 font-mono text-zinc-300">{formatSignedPercent(row.changeFromPreviousYear)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
