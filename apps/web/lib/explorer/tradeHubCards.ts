import type { ClientTradePartnersData } from "../data/tradePartners/importTradePartners";
import type { ClientTradeOverviewFact, TradeChartIndicator } from "../data/tradeOverview/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { coverageRange } from "./coverageLabel";
import { formatInUnit } from "./format";
import type { HubCardModel } from "./hubCards";
import type { CardLatest } from "./topicHub";
import { buildTradeOverviewModel } from "./tradeOverview";
import { DEFAULT_TRADE_OVERVIEW_STATE, tradeOverviewCoverage } from "./tradeOverviewState";
import { buildTradePartnersModel } from "./tradePartners";
import { DEFAULT_TRADE_PARTNERS_STATE, type tradePartnersCoverage } from "./tradePartnersState";
import type { tradeProductsCoverage } from "./tradeProductsState";

/**
 * Given the partners' data (`partners`), each card also carries its latest figure as its page states it: the total its
 * sparkline follows in the card's last year, in the Overview's unit, and on Partners the end year's largest country.
 */
export function buildTradeHubCards(facts: readonly ClientTradeOverviewFact[], presentation: Presentation, partnerCoverage: ReturnType<typeof tradePartnersCoverage>, productCoverage?: ReturnType<typeof tradeProductsCoverage>, domesticFacts?: readonly ClientTradeOverviewFact[], servicesFacts?: readonly ClientTradeOverviewFact[], compositionFacts?: readonly ClientTradeOverviewFact[], partners?: ClientTradePartnersData): HubCardModel[] {
  const { min, max, years } = tradeOverviewCoverage(facts);
  const turnover = new Map(facts.filter(f => f.indicatorId === "trade.turnover").map(f => [f.year, f.valueUsd]));
  const span = (rows: readonly ClientTradeOverviewFact[]) => {
    const coverage = tradeOverviewCoverage(rows);
    return `${coverage.min}–${coverage.max}`;
  };
  const yearsOf = (rows: readonly ClientTradeOverviewFact[]) => {
    const coverage = tradeOverviewCoverage(rows);
    return coverageRange(coverage.min, coverage.max);
  };
  const figure = (rows: readonly ClientTradeOverviewFact[], indicatorId: TradeChartIndicator, year: number): CardLatest | null => {
    if (!partners) return null;
    const model = buildTradeOverviewModel(rows, { ...DEFAULT_TRADE_OVERVIEW_STATE, selectedIds: [indicatorId] }, presentation);
    const value = model.valuesByIndicator[indicatorId]?.[year];
    return value == null ? null : { value: `${formatInUnit(value, model.unit)} ${model.unit.label}`, period: String(year) };
  };
  const largestPartner = (): CardLatest | null => {
    if (!partners) return null;
    const model = buildTradePartnersModel(partners, DEFAULT_TRADE_PARTNERS_STATE, presentation);
    const top = model.ranking[0];
    return top ? { value: `${formatInUnit(top.valueUsd, model.unit)} ${model.unit.label}`, period: String(model.range.end), caption: message(presentation.messages, "groups.caption.largest", { name: top.label }) } : null;
  };
  const cards: Omit<HubCardModel, "index">[] = [
    { title: message(presentation.messages, "trade.title"), description: message(presentation.messages, "trade.summary"), href: "/explorer/trade/overview", comingSoon: false, series: years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${min}–${max} · ${message(presentation.messages, "trade.annual")}`, latest: figure(facts, "trade.turnover", max), years: coverageRange(min, max) },
    { title: message(presentation.messages, "trade.partners.title"), description: message(presentation.messages, "trade.partners.summary"), href: "/explorer/trade/partners", comingSoon: false, series: partnerCoverage.years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${partnerCoverage.min}–${partnerCoverage.max} · ${message(presentation.messages, "trade.annual")}`, latest: largestPartner(), years: coverageRange(partnerCoverage.min, partnerCoverage.max) },
    ...(productCoverage ? [{ title: message(presentation.messages, "trade.products.title"), description: message(presentation.messages, "trade.products.summary"), href: "/explorer/trade/products", comingSoon: false, series: productCoverage.years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${productCoverage.min}–${productCoverage.max} · ${message(presentation.messages, "trade.annual")}`, latest: figure(facts, "trade.turnover", productCoverage.max), years: coverageRange(productCoverage.min, productCoverage.max) }] : []),
    ...(domesticFacts?.length ? [{ title: message(presentation.messages, "trade.domestic.title"), description: message(presentation.messages, "trade.domestic.summary"), href: "/explorer/trade/domestic-exports", comingSoon: false, series: domesticFacts.filter(f => f.indicatorId === "trade.domestic_exports").sort((a, b) => a.year - b.year).map(f => f.valueUsd), seriesColor: INK, footer: `${span(domesticFacts)} · ${message(presentation.messages, "trade.annual")}`, latest: figure(domesticFacts, "trade.domestic_exports", tradeOverviewCoverage(domesticFacts).max), years: yearsOf(domesticFacts) }] : []),
    ...(servicesFacts?.length ? [{ title: message(presentation.messages, "trade.services.title"), description: message(presentation.messages, "trade.services.summary"), href: "/explorer/trade/services", comingSoon: false, series: servicesFacts.filter(f => f.indicatorId === "trade.turnover").sort((a, b) => a.year - b.year).map(f => f.valueUsd), seriesColor: INK, footer: `${span(servicesFacts)} · ${message(presentation.messages, "trade.annual")}`, latest: figure(servicesFacts, "trade.turnover", tradeOverviewCoverage(servicesFacts).max), years: yearsOf(servicesFacts) }] : []),
    ...(compositionFacts?.length ? [{ title: message(presentation.messages, "trade.composition.title"), description: message(presentation.messages, "trade.composition.summary"), href: "/explorer/trade/composition", comingSoon: false, series: compositionFacts.filter(f => f.indicatorId === "trade.exports").sort((a, b) => a.year - b.year).map(f => f.valueUsd), seriesColor: INK, footer: `${span(compositionFacts)} · ${message(presentation.messages, "trade.annual")}`, latest: figure(compositionFacts, "trade.exports", tradeOverviewCoverage(compositionFacts).max), years: yearsOf(compositionFacts) }] : []),
  ];
  // Numbered in order, so a dataset without data leaves no gap in the numbering.
  return cards.map((card, index) => ({ index: String(index + 1).padStart(2, "0"), ...card }));
}
