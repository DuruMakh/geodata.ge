import type { ExpenditureGrouping, ExplorerSide, SnapshotItem } from "../../lib/explorer/types";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { formatBn, formatShare } from "../../lib/explorer/format";
import { SwatchBar } from "../ui/editorial";

// Full ranking per DESIGN.md §9.7: mono rank index, swatch, amount, 120px share bar,
// colored change; sticky first column on horizontal scroll.

type FullRankingProps = {
  rows: SnapshotItem[];
  side: ExplorerSide;
  grouping: ExpenditureGrouping;
};

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function FullRanking({ rows, side, grouping }: FullRankingProps) {
  const header = side === "revenue" ? "კატეგორია" : grouping === "ministries" ? "უწყება" : "სფერო";
  const maxShare = Math.max(...rows.map((row) => row.shareOfTotal), 0.001);
  const headCell =
    "border-b-2 border-[var(--ink)] px-3 pt-1.5 pb-[9px] text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] whitespace-nowrap";

  return (
    <div data-testid="single-year-ranking" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h3 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">სრული რეიტინგი</h3>
      <p className="mb-3 text-xs text-[var(--muted)]">დალაგებულია მოცულობით, კლებადობით</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-[2] border-b-2 border-[var(--ink)] bg-[var(--paper)] pr-3 pt-1.5 pb-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] shadow-[1px_0_0_var(--hairline-soft)]">
                {header}
              </th>
              <th className={headCell}>მლრდ ₾</th>
              <th className={`${headCell} w-[220px]`}>წილი</th>
              <th className={`${headCell} pr-0`}>ცვლილება</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.itemId} className="border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)]">
                <td className="sticky left-0 z-[1] bg-[var(--paper)] py-[11px] pr-3 shadow-[1px_0_0_var(--hairline-soft)]">
                  <span className="inline-flex min-w-0 items-center gap-[9px]">
                    <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <SwatchBar color={row.color} />
                    <span className="text-[13px] font-medium text-[var(--ink)]">{truncate(row.kaLabel, 52)}</span>
                  </span>
                </td>
                <td className="px-3 py-[11px] text-right font-[family-name:var(--font-numeric)] text-[12.5px] font-semibold whitespace-nowrap text-[var(--ink)]">
                  {formatBn(row.amountGel)}
                </td>
                <td className="px-3 py-[11px] text-right">
                  <span className="inline-flex w-full items-center justify-end gap-2.5">
                    <span className="inline-block h-[3px] w-[120px] overflow-hidden bg-[var(--hairline-soft)]">
                      <span
                        className="block h-full"
                        style={{
                          background: row.color,
                          width: `${Math.max(2, Math.round((row.shareOfTotal / maxShare) * 100))}%`,
                        }}
                      />
                    </span>
                    <span className="min-w-[52px] font-[family-name:var(--font-numeric)] text-[12.5px] text-[var(--muted)]">
                      {formatShare(row.shareOfTotal)}
                    </span>
                  </span>
                </td>
                <td
                  className="py-[11px] pl-3 pr-0 text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap"
                  style={{
                    color:
                      row.changeFromPreviousYear === null
                        ? "var(--muted)"
                        : row.changeFromPreviousYear >= 0
                          ? POSITIVE
                          : NEGATIVE,
                  }}
                >
                  {formatShare(row.changeFromPreviousYear, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
