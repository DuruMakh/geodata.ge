"use client";
import { useEffect, useRef } from "react";
import type { toClientTradeCompositionData } from "../../lib/data/tradeComposition/importTradeComposition";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { TextTab } from "../ui/editorial";
import { TradePartners } from "./trade-partners";
import { useTradeSectionsState } from "./use-trade-sections-state";

const sections = ["sitc", "bec"] as const;
export function TradeComposition({ data, sources, lastReviewedAt, siteOrigin }: { data: ReturnType<typeof toClientTradeCompositionData>; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const { messages } = useI18n(), t = (key: string) => message(messages, `trade.composition.${key}`);
  const { section, changeSection } = useTradeSectionsState(sections, "sitc", "trade-composition-state");
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [section]);
  const changeView = (next: typeof section) => {
    if (next !== section) pendingFocus.current = `trade-composition-section-${next}`;
    changeSection(next);
  };
  return <div data-testid="trade-composition" data-section={section} className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <p className="mb-4 max-w-[850px] text-[13px] leading-relaxed text-[var(--body)]">{t("summary")}</p>
    <div role="group" aria-label={t("views")} data-testid="trade-composition-tabs" className="mb-5 flex flex-wrap items-center gap-5">
      {sections.map(id => <TextTab key={id} label={t(id)} active={section === id} onClick={() => changeView(id)} id={`trade-composition-section-${id}`} testId={`trade-composition-section-${id}`} />)}
    </div>
    <TradePartners key={section} data={data[section]} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={siteOrigin} />
  </div>;
}
