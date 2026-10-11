"use client";
import type { toClientTradeServicesData } from "../../lib/data/tradeServices/importTradeServices";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { TextTab } from "../ui/editorial";
import { TradeOverview } from "./trade-overview";
import { TradePartners } from "./trade-partners";
import { useTradeSectionsState } from "./use-trade-sections-state";

const sections = ["overview", "types"] as const;
export function TradeServices({ data, sources, lastReviewedAt, siteOrigin }: { data: ReturnType<typeof toClientTradeServicesData>; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const { messages } = useI18n(), t = (key: string) => message(messages, `trade.services.${key}`);
  const { section, changeSection } = useTradeSectionsState(sections, "overview", "trade-services-state");
  const props = { sources, lastReviewedAt, siteOrigin, dataset: "services" as const };
  return <div data-testid="trade-services" data-section={section} className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <p className="mb-4 max-w-[850px] text-[13px] leading-relaxed text-[var(--body)]">{t("summary")}</p>
    <div role="group" aria-label={t("views")} className="mb-5 flex flex-wrap items-center gap-5">
      {sections.map(id => <TextTab key={id} label={t(id)} active={section === id} onClick={() => changeSection(id)} testId={`trade-services-section-${id}`} />)}
    </div>
    {section === "overview" ? <TradeOverview facts={data.national} {...props} /> : <TradePartners data={data.types} sources={sources} lastReviewedAt={lastReviewedAt} siteOrigin={siteOrigin} />}
  </div>;
}
