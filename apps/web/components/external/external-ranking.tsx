"use client";
import { formatInUnit, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SectionTitle } from "../ui/editorial";

export type ExternalRankingRow = { entityId: string; label: string; valueUsd: number | null; share: number | null; rank: number | null; color: string; monthsReported?: number | null };

/** The end-year ranking under the External flows pages: ranked rows, then one unranked remainder row. A negative value keeps its sign and gets an empty bar. */
export function ExternalRanking({ testId, title, itemLabel, shareLabel, note, empty, rows, other, monthsLabel, data }: { testId: string; data?: Record<string, string | number>; title: string; itemLabel: string; shareLabel: string; note: string; empty: string; rows: ExternalRankingRow[]; other: ExternalRankingRow | null; monthsLabel?: (count: number) => string }) {
  const { messages } = useI18n();
  // Amounts read in millions (USD 683 million), whatever scale the chart above uses.
  const unit = { divisor: 1_000_000, decimals: 1, label: message(messages, "external.unit.million") };
  const max = Math.max(...rows.map(row => row.valueUsd!), 1);
  const row = (item: ExternalRankingRow, kind: "ranking" | "other") => <tr key={item.entityId} data-testid={`${testId}-${kind}-row`} data-entity-id={item.entityId} className="border-b border-[var(--row-border)]">
    <td className="py-3 pr-2 align-top font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{item.rank ?? "—"}</td>
    <th scope="row" className="py-3 pr-3 text-left align-top text-[12px] font-medium leading-relaxed text-[var(--ink)]">{item.label}
      {kind === "ranking" ? <div aria-hidden className="relative mt-2 h-1.5 bg-[var(--tint)]"><span data-testid={`${testId}-bar`} className="absolute top-0 left-0 h-full" style={{ backgroundColor: item.color, width: `${Math.max(item.valueUsd!, 0) / max * 100}%` }} /></div> : null}
    </th>
    <td className="py-3 text-right align-top font-[family-name:var(--font-numeric)] text-[12px] whitespace-nowrap text-[var(--ink)]">{formatInUnit(item.valueUsd, unit)}{item.monthsReported != null && monthsLabel ? <span data-testid={`${testId}-partial`} className="block text-[10px] text-[var(--muted)]">{monthsLabel(item.monthsReported)}</span> : null}</td>
    <td className="py-3 pl-3 text-right align-top font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{formatShare(item.share)}</td>
  </tr>;
  return <section data-testid={`${testId}-ranking`} {...Object.fromEntries(Object.entries(data ?? {}).map(([key, value]) => [`data-${key}`, value]))} className="mt-10 border-t-2 border-[var(--ink)] pt-5">
    <SectionTitle>{title}</SectionTitle>
    <p className="mt-2 text-[11px] text-[var(--muted)]">{unit.label} · {note}</p>
    <table className="mt-5 w-full table-fixed border-collapse">
      <caption className="sr-only">{title} · {unit.label}</caption>
      <colgroup><col className="w-[6%]" /><col className="w-[49%]" /><col className="w-[30%] min-[640px]:w-[23%]" /><col className="w-[15%] min-[640px]:w-[22%]" /></colgroup>
      <thead><tr className="border-b border-[var(--ink)] text-[10px] text-[var(--muted)]"><th className="py-2 text-left font-normal">#</th><th className="py-2 text-left font-normal">{itemLabel}</th><th className="py-2 text-right font-normal">{unit.label}</th><th className="py-2 pl-3 text-right font-normal leading-tight [overflow-wrap:anywhere]">{shareLabel}</th></tr></thead>
      <tbody>
        {rows.map(item => row(item, "ranking"))}
        {other ? row(other, "other") : null}
      </tbody>
    </table>
    {!rows.length ? <p className="mt-3 text-[12px] text-[var(--muted)]">{empty}</p> : null}
  </section>;
}
