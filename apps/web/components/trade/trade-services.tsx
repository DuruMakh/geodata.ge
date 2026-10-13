"use client";
import { useEffect, useRef } from "react";
import type { toClientTradeServicesData } from "../../lib/data/tradeServices/importTradeServices";
import { TRADE_OVERVIEW_INDICATORS, type TradeChartIndicator } from "../../lib/data/tradeOverview/types";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { TextTab } from "../ui/editorial";
import { TradeOverview } from "./trade-overview";
import { TradePartners } from "./trade-partners";
import { useTradeSectionsState } from "./use-trade-sections-state";

const sections = ["overview", "types"] as const;
export function TradeServices({ data, sources, lastReviewedAt, siteOrigin }: { data: Omit<ReturnType<typeof toClientTradeServicesData>, "englishLabels">; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const { messages } = useI18n(), t = (key: string) => message(messages, `trade.services.${key}`);
  const { section, changeSection } = useTradeSectionsState(sections, "overview", "trade-services-state");
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [section]);
  const changeView = (next: typeof section, measure?: TradeChartIndicator) => {
    if (next !== section) pendingFocus.current = `trade-services-section-${measure ?? "overview"}`;
    changeSection(next, measure ? { measure } : undefined);
  };
  const props = { sources, lastReviewedAt, siteOrigin, dataset: "services" as const };
  // Below 768px the five tabs are one row that scrolls sideways instead of five stacked rows above the chart (U22-14).
  const tabs = (measure?: TradeChartIndicator, changeMeasure?: (next: TradeChartIndicator) => void) => <div role="group" aria-label={t("views")} data-testid="trade-services-tabs" className="mb-5 flex flex-wrap items-center gap-5 max-[1099px]:flex-nowrap max-[1099px]:overflow-x-auto max-[1099px]:whitespace-nowrap">
    <TextTab label={t("overview")} active={section === "overview"} onClick={() => changeView("overview")} id="trade-services-section-overview" testId="trade-services-section-overview" />
    {(data.types.measures ?? TRADE_OVERVIEW_INDICATORS).map(id => <TextTab key={id} label={t(`indicator.${id}`)} active={section === "types" && measure === id} onClick={() => changeMeasure ? changeMeasure(id) : changeView("types", id)} id={`trade-services-section-${id}`} testId={`trade-services-section-${id}`} />)}
  </div>;
  return <div data-testid="trade-services" data-section={section} className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    {section === "overview" ? <>{tabs()}<TradeOverview facts={data.national} {...props} /></> : <TradePartners data={data.types} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={siteOrigin} navigation={tabs} />}
  </div>;
}
