"use client";
import type { toClientTradeDomesticData } from "../../lib/data/tradeDomestic/importTradeDomestic";
import type { WorkbookPublicSource } from "../../lib/explorer/workbookModel";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { ExplorerHeading } from "../explorer-shell/explorer-heading";
import { TextTab } from "../ui/editorial";
import { TradeOverview } from "./trade-overview";
import { TradePartners } from "./trade-partners";
import { TradeProducts } from "./trade-products";
import { useTradeSectionsState } from "./use-trade-sections-state";

type Section = "overview" | "countries" | "products";
const sections: Section[] = ["overview", "countries", "products"];
export function TradeDomesticExports({ data, sources, lastReviewedAt, siteOrigin }: { data: Omit<ReturnType<typeof toClientTradeDomesticData>, "englishLabels">; sources: WorkbookPublicSource[]; lastReviewedAt: string; siteOrigin: string }) {
  const { messages } = useI18n(), t = (key: string) => message(messages, `trade.domestic.${key}`);
  const { section, changeSection } = useTradeSectionsState(sections, "overview", "trade-domestic-state");
  const props = { sources, lastReviewedAt, siteOrigin };
  return <div data-testid="trade-domestic" data-section={section} className="@container">
    <ExplorerHeading>{t("title")}</ExplorerHeading>
    <div role="group" aria-label={t("views")} className="mb-5 flex flex-wrap items-center gap-5">
      {sections.map(id => <TextTab key={id} label={t(id)} active={section === id} onClick={() => changeSection(id)} testId={`trade-domestic-section-${id}`} />)}
    </div>
    {section === "overview" ? <TradeOverview facts={data.national} {...props} /> : section === "countries" ? <TradePartners data={data.countries} {...props} /> : <TradeProducts data={data.products} {...props} />}
  </div>;
}
