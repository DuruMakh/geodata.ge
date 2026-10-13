import type { ClientTradeOverviewFact } from "../data/tradeOverview/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import type { HubCardModel } from "./hubCards";
import { tradeOverviewCoverage } from "./tradeOverviewState";
import type { tradePartnersCoverage } from "./tradePartnersState";
import type { tradeProductsCoverage } from "./tradeProductsState";

export function buildTradeHubCards(facts: readonly ClientTradeOverviewFact[], presentation: Presentation, partnerCoverage: ReturnType<typeof tradePartnersCoverage>, productCoverage?: ReturnType<typeof tradeProductsCoverage>, domesticFacts?: readonly ClientTradeOverviewFact[], servicesFacts?: readonly ClientTradeOverviewFact[]): HubCardModel[] {
  const { min, max, years } = tradeOverviewCoverage(facts);
  const turnover = new Map(facts.filter(f => f.indicatorId === "trade.turnover").map(f => [f.year, f.valueUsd]));
  const span = (rows: readonly ClientTradeOverviewFact[]) => {
    const coverage = tradeOverviewCoverage(rows);
    return `${coverage.min}–${coverage.max}`;
  };
  const cards: Omit<HubCardModel, "index">[] = [
    { title: message(presentation.messages, "trade.title"), description: message(presentation.messages, "trade.summary"), href: "/explorer/trade/overview", comingSoon: false, series: years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${min}–${max} · ${message(presentation.messages, "trade.annual")}` },
    { title: message(presentation.messages, "trade.partners.title"), description: message(presentation.messages, "trade.partners.summary"), href: "/explorer/trade/partners", comingSoon: false, series: partnerCoverage.years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${partnerCoverage.min}–${partnerCoverage.max} · ${message(presentation.messages, "trade.annual")}` },
    ...(productCoverage ? [{ title: message(presentation.messages, "trade.products.title"), description: message(presentation.messages, "trade.products.summary"), href: "/explorer/trade/products", comingSoon: false, series: productCoverage.years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${productCoverage.min}–${productCoverage.max} · ${message(presentation.messages, "trade.annual")}` }] : []),
    ...(domesticFacts?.length ? [{ title: message(presentation.messages, "trade.domestic.title"), description: message(presentation.messages, "trade.domestic.summary"), href: "/explorer/trade/domestic-exports", comingSoon: false, series: domesticFacts.filter(f => f.indicatorId === "trade.domestic_exports").sort((a, b) => a.year - b.year).map(f => f.valueUsd), seriesColor: INK, footer: `${span(domesticFacts)} · ${message(presentation.messages, "trade.annual")}` }] : []),
    ...(servicesFacts?.length ? [{ title: message(presentation.messages, "trade.services.title"), description: message(presentation.messages, "trade.services.summary"), href: "/explorer/trade/services", comingSoon: false, series: servicesFacts.filter(f => f.indicatorId === "trade.turnover").sort((a, b) => a.year - b.year).map(f => f.valueUsd), seriesColor: INK, footer: `${span(servicesFacts)} · ${message(presentation.messages, "trade.annual")}` }] : []),
  ];
  // Numbered in order, so a dataset without data leaves no gap in the numbering.
  return cards.map((card, index) => ({ index: String(index + 1).padStart(2, "0"), ...card }));
}
