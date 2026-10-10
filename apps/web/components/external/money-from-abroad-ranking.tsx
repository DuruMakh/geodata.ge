"use client";
import { useState } from "react";
import type { MoneyTransferMeasure } from "../../lib/data/externalFlows/types";
import type { MoneyTransferRankingRow, MoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { formatInUnit, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SectionTitle } from "../ui/editorial";

export function MoneyFromAbroadRanking({ model, measure }: { model: MoneyTransfersModel; measure: MoneyTransferMeasure }) {
  const [expanded, setExpanded] = useState(false);
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string | number>) => message(messages, `external.money.${key}`, values);
  const rows = expanded ? model.ranking : model.ranking.slice(0, 10);
  const title = t("rankingTitle", { measure: message(messages, `external.measure.${measure}`), year: model.range.end });
  const max = Math.max(...model.ranking.map(row => row.valueUsd!), 1);
  const heading = (text: string) => <tr><td colSpan={4} className="pt-5 pb-2 text-[11px] font-semibold text-[var(--muted)]">{text}</td></tr>;
  const row = (item: MoneyTransferRankingRow, kind: "ranking" | "remainder" | "unavailable") => <tr key={item.entityId} data-testid={`money-from-abroad-${kind}-row`} data-entity-id={item.entityId} className="border-b border-[var(--row-border)]">
    <td className="py-3 pr-2 align-top font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{item.rank ?? "—"}</td>
    <th scope="row" className="py-3 pr-3 text-left align-top text-[12px] font-medium leading-relaxed text-[var(--ink)]">{item.label}
      {kind === "ranking" ? <div aria-hidden className="relative mt-2 h-1.5 bg-[var(--tint)]"><span className="absolute top-0 left-0 h-full" style={{ backgroundColor: item.color, width: `${item.valueUsd! / max * 100}%` }} /></div> : null}
    </th>
    <td className="py-3 text-right align-top font-[family-name:var(--font-numeric)] text-[12px] whitespace-nowrap text-[var(--ink)]">{formatInUnit(item.valueUsd, model.unit)}{item.monthsReported !== null ? <span data-testid="money-from-abroad-partial" className="block text-[10px] text-[var(--muted)]">{t("months", { count: item.monthsReported })}</span> : null}</td>
    <td className="py-3 pl-3 text-right align-top font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{formatShare(item.share)}</td>
  </tr>;
  return <section data-testid="money-from-abroad-ranking" data-end-year={model.range.end} data-measure={measure} className="mt-10 border-t-2 border-[var(--ink)] pt-5">
    <SectionTitle>{title}</SectionTitle>
    <p className="mt-2 text-[11px] text-[var(--muted)]">{model.unit.label} · {t("shareNote")}</p>
    <table className="mt-5 w-full table-fixed border-collapse">
      <caption className="sr-only">{title} · {model.unit.label}</caption>
      <colgroup><col className="w-[6%]" /><col className="w-[49%]" /><col className="w-[30%] min-[640px]:w-[23%]" /><col className="w-[15%] min-[640px]:w-[22%]" /></colgroup>
      <thead><tr className="border-b border-[var(--ink)] text-[10px] text-[var(--muted)]"><th className="py-2 text-left font-normal">{t("rank")}</th><th className="py-2 text-left font-normal">{t("country")}</th><th className="py-2 text-right font-normal">{model.unit.label}</th><th className="py-2 pl-3 text-right font-normal leading-tight [overflow-wrap:anywhere]">{t("share")}</th></tr></thead>
      <tbody>
        {rows.map(item => row(item, "ranking"))}
        {model.remainders.length ? <>{heading(t("remainders"))}{model.remainders.map(item => row(item, "remainder"))}</> : null}
        {expanded && model.missingRanking.length ? <>{heading(t("unavailable"))}{model.missingRanking.map(item => row(item, "unavailable"))}</> : null}
      </tbody>
    </table>
    {!model.ranking.length ? <p className="mt-3 text-[12px] text-[var(--muted)]">{t("noRanking")}</p> : null}
    {!expanded && (model.ranking.length > 10 || model.missingRanking.length > 0) ? <button type="button" data-testid="money-from-abroad-show-all" onClick={() => setExpanded(true)} className="mt-4 cursor-pointer text-[12px] font-semibold text-[var(--accent)] underline underline-offset-4">{t("showAll")}</button> : null}
  </section>;
}
