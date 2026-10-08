import type { ClientTradeOverviewFact } from "../data/tradeOverview/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import type { HubCardModel } from "./hubCards";
import { tradeOverviewCoverage } from "./tradeOverviewState";

export function buildTradeHubCards(facts: readonly ClientTradeOverviewFact[], presentation: Presentation): HubCardModel[] {
  const { min, max, years } = tradeOverviewCoverage(facts);
  const turnover = new Map(facts.filter(f => f.indicatorId === "trade.turnover").map(f => [f.year, f.valueUsd]));
  return [{ index: "01", title: message(presentation.messages, "trade.title"), description: message(presentation.messages, "trade.summary"), href: "/explorer/trade/overview", comingSoon: false, series: years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${min}–${max} · ${message(presentation.messages, "trade.annual")}` }];
}
