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
  { key: "share", label: "\u10ec\u10d8\u10da\u10d8" },
  { key: "change", label: "\u10ea\u10d5\u10da\u10d8\u10da\u10d4\u10d1\u10d0" },
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
    <section data-testid="single-year-ranking" className="min-w-0 rounded-[20px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--ink)]">{"\u10e1\u10e0\u10e3\u10da\u10d8 \u10e0\u10d4\u10d8\u10e2\u10d8\u10dc\u10d2\u10d8"}</h3>
        <div className="flex flex-wrap gap-2" aria-label="Sort full ranking">
          {sortOptions.map((option) => {
            const active = sortKey === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSortKey(option.key)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]"
                    : "border-[var(--hairline)] bg-[var(--surface)] text-[var(--body)] hover:border-[var(--primary)]",
                ].join(" ")}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="max-w-full overflow-x-auto rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)]">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="border-b border-[var(--hairline)] bg-[var(--soft)] text-xs uppercase text-[var(--mute)]">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">{"\u10db\u10e3\u10ee\u10da\u10d8"}</th>
              <th className="px-3 py-3">GEL</th>
              <th className="px-3 py-3">{"\u10ec\u10d8\u10da\u10d8"}</th>
              <th className="px-3 py-3">{"\u10ea\u10d5\u10da\u10d8\u10da\u10d4\u10d1\u10d0"}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={row.itemId} className="border-b border-[var(--hairline-soft)] last:border-b-0">
                <td className="px-3 py-3 text-[var(--mute)]">{index + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full border border-[var(--surface)]" style={{ backgroundColor: row.color }} />
                    <span className="truncate text-[var(--ink)]">{row.kaLabel}</span>
                  </div>
                </td>
                <td className="px-3 py-3 font-semibold text-[var(--primary)]">{formatGel(row.amountGel)}</td>
                <td className="px-3 py-3 text-[var(--body)]">{formatPercent(row.shareOfTotal)}</td>
                <td className="px-3 py-3 text-[var(--body)]">{formatSignedPercent(row.changeFromPreviousYear)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
