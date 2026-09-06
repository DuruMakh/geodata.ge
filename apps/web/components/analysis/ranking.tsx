import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import type { ExpenditureGrouping, ExplorerSide, SnapshotItem } from "../../lib/explorer/types";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { formatBn, formatShare } from "../../lib/explorer/format";
import { SwatchBar } from "../ui/editorial";

// Full ranking per DESIGN.md §9.7: mono rank index, swatch, amount, share bar,
// and colored change. The compact table also fits the narrow mobile layout.

type FullRankingProps = {
  rows: SnapshotItem[];
  side: ExplorerSide;
  grouping: ExpenditureGrouping;
  year: number;
};

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function compactLabel(text: string): string {
  const words = text.trim().split(/\s+/);
  return words.length > 2 ? `${words.slice(0, 2).join(" ")}…` : text;
}

export function FullRanking({ rows, side, grouping, year }: FullRankingProps) {
  const { locale, messages, englishLabels } = useI18n();
  const labelFor = (item: Pick<SnapshotItem, "itemId" | "kaLabel">) => publicLabel(locale, item.itemId, item.kaLabel, englishLabels);
  const header = message(messages, side === "revenue" ? "analysis.category" : grouping === "ministries" ? "analysis.institution" : "analysis.field");
  const caption = message(messages, side === "revenue" ? "analysis.rankingRevenue" : grouping === "ministries" ? "analysis.rankingMinistries" : "analysis.rankingFields", { year });
  const maxShare = Math.max(...rows.map((row) => row.shareOfTotal), 0.001);
  const headCell =
    "border-b-2 border-[var(--ink)] px-1.5 pt-1.5 pb-[9px] text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] min-[768px]:whitespace-nowrap min-[768px]:px-3";

  return (
    <div data-testid="single-year-ranking" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h2 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">{message(messages, "analysis.ranking")}</h2>
      <p className="mb-3 text-xs text-[var(--muted)]">{message(messages, "analysis.rankingOrder")}</p>
      <div>
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            <col className="w-[36%] min-[768px]:w-[39%]" />
            <col className="w-[22%] min-[768px]:w-[18%]" />
            <col className="w-[21%] min-[768px]:w-[26%]" />
            <col className="w-[21%] min-[768px]:w-[17%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-b-2 border-[var(--ink)] pr-1.5 pt-1.5 pb-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] min-[768px]:pr-3">
                {header}
              </th>
              <th className={`${headCell} whitespace-nowrap text-[10px] min-[768px]:text-[11px]`}>{message(messages, "analysis.billionUnit")}</th>
              <th className={`${headCell} w-[220px]`}>{message(messages, "analysis.share")}</th>
              <th className={`${headCell} pr-0`}>
                <span className="min-[768px]:hidden">{message(messages, "analysis.changeShort")}</span>
                <span className="hidden min-[768px]:inline">{message(messages, "analysis.change")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.itemId} className="border-b border-[var(--hairline-soft)] transition-colors duration-100 hover:bg-[var(--tint)]">
                <td className="py-[11px] pr-1.5 min-[768px]:pr-3" title={labelFor(row)}>
                  <span className="flex min-w-0 items-start gap-1.5 min-[768px]:items-center min-[768px]:gap-[9px]">
                    <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <SwatchBar color={row.color} className="mt-[5px] flex-none min-[768px]:mt-0" />
                    <span className="min-w-0 text-[11.5px] font-medium leading-[1.25] text-[var(--ink)] min-[768px]:text-[13px] min-[768px]:leading-normal">
                      <span className="min-[768px]:hidden">{compactLabel(labelFor(row))}</span>
                      <span className="hidden min-[768px]:inline">{truncate(labelFor(row), 52)}</span>
                    </span>
                  </span>
                </td>
                <td className="px-1.5 py-[11px] text-right font-[family-name:var(--font-numeric)] text-[11.5px] font-semibold whitespace-nowrap text-[var(--ink)] min-[768px]:px-3 min-[768px]:text-[12.5px]">
                  {formatBn(row.amountGel)}
                </td>
                <td className="px-1.5 py-[11px] text-right min-[768px]:px-3">
                  <span className="inline-flex w-full items-center justify-end gap-1 min-[768px]:gap-2.5">
                    <span data-testid="ranking-share-bar" className="hidden h-[3px] w-[120px] overflow-hidden bg-[var(--hairline-soft)] min-[768px]:inline-block">
                      <span
                        className="block h-full"
                        style={{
                          background: row.color,
                          // Negative shares (real data) get no bar rather than a fake sliver.
                          width: `${row.shareOfTotal > 0 ? Math.max(2, Math.round((row.shareOfTotal / maxShare) * 100)) : 0}%`,
                        }}
                      />
                    </span>
                    <span className="min-w-[45px] font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)] min-[768px]:min-w-[52px] min-[768px]:text-[12.5px]">
                      {formatShare(row.shareOfTotal)}
                    </span>
                  </span>
                </td>
                <td
                  className="py-[11px] pl-1.5 pr-0 text-right font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap min-[768px]:pl-3 min-[768px]:text-[12.5px]"
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
