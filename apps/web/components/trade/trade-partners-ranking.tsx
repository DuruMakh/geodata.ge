"use client";
import { useState } from "react";
import type { TradeOverviewIndicator } from "../../lib/data/tradeOverview/types";
import type { TradePartnersModel, TradePartnerRankingRow } from "../../lib/explorer/tradePartners";
import type { TradePartnersTab } from "../../lib/explorer/tradePartnersState";
import { formatInUnit, formatShare } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SectionTitle } from "../ui/editorial";

export function TradePartnersRanking({ model, tab, measure }: { model: TradePartnersModel; tab: TradePartnersTab; measure: TradeOverviewIndicator }) {
  const [expanded, setExpanded] = useState(false);
  const { messages } = useI18n();
  const t = (key: string) => message(messages, `trade.partners.${key}`);
  const balance = measure === "trade.balance", showAll = tab === "groups" || expanded;
  const rows = showAll ? model.ranking : model.ranking.slice(0, 10);
  const title = message(messages, "trade.partners.rankingTitle", { measure: message(messages, `trade.indicator.${measure}`), kind: t(tab === "countries" ? "countries" : "groups"), year: model.range.end });
  const max = Math.max(...model.ranking.map(row => Math.abs(row.valueUsd!)), 1);
  const row = (item: TradePartnerRankingRow, missing = false) => <tr key={item.entityId} data-testid={missing ? "trade-partners-unavailable-row" : "trade-partners-ranking-row"} data-entity-id={item.entityId} className="border-b border-[var(--row-border)]">
    <td className="py-3 pr-2 align-top font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{item.rank ?? "—"}</td>
    <th scope="row" className="py-3 pr-3 text-left align-top text-[12px] font-medium leading-relaxed text-[var(--ink)]">{item.label}
      {!missing ? <div aria-hidden className="relative mt-2 h-1.5 bg-[var(--tint)]">
        {balance ? <span data-testid="trade-partners-zero-axis" className="absolute -top-1 left-1/2 h-3.5 w-px bg-[var(--control)]" /> : null}
        <span className="absolute top-0 h-full" style={{ backgroundColor: item.color, left: balance ? item.valueUsd! < 0 ? `${50 - Math.abs(item.valueUsd!) / max * 50}%` : "50%" : 0, width: `${Math.abs(item.valueUsd!) / max * (balance ? 50 : 100)}%` }} />
      </div> : null}
    </th>
    <td className="py-3 text-right align-top font-[family-name:var(--font-numeric)] text-[12px] whitespace-nowrap text-[var(--ink)]">{formatInUnit(item.valueUsd, model.unit)}</td>
    {!balance ? <td className="py-3 pl-3 text-right align-top font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{formatShare(item.shareOfNational)}</td> : null}
  </tr>;
  return <section data-testid="trade-partners-ranking" data-end-year={model.range.end} data-has-share={String(!balance)} className="mt-10 border-t-2 border-[var(--ink)] pt-5">
    <SectionTitle>{title}</SectionTitle>
    <p className="mt-2 text-[11px] text-[var(--muted)]">{model.unit.label} · {t(balance ? "balanceRankingNote" : "shareNote")}</p>
    <table className="mt-5 w-full table-fixed border-collapse">
      <caption className="sr-only">{title} · {model.unit.label}</caption>
      <colgroup><col className="w-[6%]" /><col style={{ width: balance ? "64%" : "49%" }} /><col className="w-[30%] min-[640px]:w-[23%]" />{!balance ? <col className="w-[15%] min-[640px]:w-[22%]" /> : null}</colgroup>
      <thead><tr className="border-b border-[var(--ink)] text-[10px] text-[var(--muted)]"><th className="py-2 text-left font-normal">{t("rank")}</th><th className="py-2 text-left font-normal">{t(tab === "countries" ? "country" : "group")}</th><th className="py-2 text-right font-normal">{model.unit.label}</th>{!balance ? <th className="py-2 pl-3 text-right font-normal leading-tight [overflow-wrap:anywhere]">{t("share")}</th> : null}</tr></thead>
      <tbody>{rows.map(item => row(item))}{showAll && model.missingRanking.length ? <><tr><td colSpan={balance ? 3 : 4} className="pt-5 pb-2 text-[11px] font-semibold text-[var(--muted)]">{t("unavailable")}</td></tr>{model.missingRanking.map(item => row(item, true))}</> : null}</tbody>
    </table>
    {!rows.length ? <p className="mt-3 text-[12px] text-[var(--muted)]">{t("noRanking")}</p> : null}
    {!showAll && (model.ranking.length > 10 || model.missingRanking.length > 0) ? <button type="button" data-testid="trade-partners-show-all" onClick={() => setExpanded(true)} className="mt-4 cursor-pointer text-[12px] font-semibold text-[var(--accent)] underline underline-offset-4">{t("showAll")}</button> : null}
  </section>;
}
