import type { ClientTradePartnersData } from "../data/tradePartners/importTradePartners";
import type { ClientTradeProductsData } from "../data/tradeProducts/importTradeProducts";
import type { ClientTradeOverviewFact, TradeChartIndicator } from "../data/tradeOverview/types";
import type { Presentation } from "../i18n/types";
import { message } from "../i18n/messages";
import { INK } from "./colors";
import { coverageRange } from "./coverageLabel";
import { formatInUnit, type ValueUnit } from "./format";
import type { HubCardModel } from "./hubCards";
import { annualSeries } from "./sparkline";
import type { CardLatest } from "./topicHub";
import { buildTradeOverviewModel } from "./tradeOverview";
import { DEFAULT_TRADE_OVERVIEW_STATE, tradeOverviewCoverage } from "./tradeOverviewState";
import { buildTradePartnersModel } from "./tradePartners";
import { DEFAULT_TRADE_PARTNERS_STATE, tradePartnersTotalId, type tradePartnersCoverage } from "./tradePartnersState";
import { buildTradeProductsModel } from "./tradeProducts";
import { DEFAULT_TRADE_PRODUCTS_STATE, TRADE_PRODUCT_TOTAL_ID, type tradeProductsCoverage } from "./tradeProductsState";

/**
 * Given the partners' data (`partners`), each card also carries its latest figure as its page states it: the total its
 * sparkline follows in the card's last year, in the Overview's unit, and on Partners the end year's largest country, whose own
 * turnover the line then follows. Given the Products and Composition pages' data (`products`, `composition`), those cards state
 * their pages' default figure, Georgia's total exports in the page's own unit, captioned as exports.
 */
export function buildTradeHubCards(facts: readonly ClientTradeOverviewFact[], presentation: Presentation, partnerCoverage: ReturnType<typeof tradePartnersCoverage>, productCoverage?: ReturnType<typeof tradeProductsCoverage>, domesticFacts?: readonly ClientTradeOverviewFact[], servicesFacts?: readonly ClientTradeOverviewFact[], compositionFacts?: readonly ClientTradeOverviewFact[], partners?: ClientTradePartnersData, products?: ClientTradeProductsData, composition?: ClientTradePartnersData): HubCardModel[] {
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
  const largestPartner = (): { latest: CardLatest; series: (number | null)[] } | null => {
    if (!partners) return null;
    const model = buildTradePartnersModel(partners, DEFAULT_TRADE_PARTNERS_STATE, presentation);
    const top = model.ranking[0];
    return top ? {
      latest: { value: `${formatInUnit(top.valueUsd, model.unit)} ${model.unit.label}`, period: String(model.range.end), caption: message(presentation.messages, "groups.caption.largest", { name: top.label }), headlineCaption: top.label },
      series: model.years.map(year => model.valuesByEntity[top.entityId][year]),
    } : null;
  };
  /** Georgia's total exports in a page model's last year and unit, as the Products and Composition pages open on them. */
  const totalExports = (model: { range: { end: number }; unit: ValueUnit; valuesByEntity: Record<string, Record<number, number | null>> }, totalId: string): CardLatest | null => {
    const value = model.valuesByEntity[totalId]?.[model.range.end];
    return value == null ? null : { value: `${formatInUnit(value, model.unit)} ${model.unit.label}`, period: String(model.range.end), caption: message(presentation.messages, "trade.indicator.trade.exports") };
  };
  const productsModel = products ? buildTradeProductsModel(products, DEFAULT_TRADE_PRODUCTS_STATE, presentation) : null;
  const compositionFigure = () => composition
    ? totalExports(buildTradePartnersModel(composition, { ...DEFAULT_TRADE_PARTNERS_STATE, measure: "trade.exports", selectedIds: [tradePartnersTotalId(composition)] }, presentation), tradePartnersTotalId(composition))
    : null;
  const partner = largestPartner();
  const annual = (rows: readonly ClientTradeOverviewFact[], indicatorId: TradeChartIndicator) => annualSeries(rows.filter(f => f.indicatorId === indicatorId).map(f => ({ year: f.year, value: f.valueUsd })));
  const cards: Omit<HubCardModel, "index">[] = [
    { title: message(presentation.messages, "trade.title"), description: message(presentation.messages, "trade.summary"), href: "/explorer/trade/overview", comingSoon: false, series: years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${min}–${max} · ${message(presentation.messages, "trade.annual")}`, latest: figure(facts, "trade.turnover", max), years: coverageRange(min, max) },
    { title: message(presentation.messages, "trade.partners.title"), description: message(presentation.messages, "trade.partners.summary"), href: "/explorer/trade/partners", comingSoon: false, series: partner?.series ?? partnerCoverage.years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${partnerCoverage.min}–${partnerCoverage.max} · ${message(presentation.messages, "trade.annual")}`, latest: partner?.latest ?? null, years: coverageRange(partnerCoverage.min, partnerCoverage.max) },
    ...(productCoverage ? [{ title: message(presentation.messages, "trade.products.title"), description: message(presentation.messages, "trade.products.summary"), href: "/explorer/trade/products", comingSoon: false, series: productsModel ? productsModel.years.map(year => productsModel.valuesByEntity[TRADE_PRODUCT_TOTAL_ID][year]) : productCoverage.years.map(year => turnover.get(year) ?? null), seriesColor: INK, footer: `${productCoverage.min}–${productCoverage.max} · ${message(presentation.messages, "trade.annual")}`, latest: productsModel ? totalExports(productsModel, TRADE_PRODUCT_TOTAL_ID) : figure(facts, "trade.turnover", productCoverage.max), years: coverageRange(productCoverage.min, productCoverage.max) }] : []),
    ...(domesticFacts?.length ? [{ title: message(presentation.messages, "trade.domestic.title"), description: message(presentation.messages, "trade.domestic.summary"), href: "/explorer/trade/domestic-exports", comingSoon: false, series: annual(domesticFacts, "trade.domestic_exports"), seriesColor: INK, footer: `${span(domesticFacts)} · ${message(presentation.messages, "trade.annual")}`, latest: figure(domesticFacts, "trade.domestic_exports", tradeOverviewCoverage(domesticFacts).max), years: yearsOf(domesticFacts) }] : []),
    ...(servicesFacts?.length ? [{ title: message(presentation.messages, "trade.services.title"), description: message(presentation.messages, "trade.services.summary"), href: "/explorer/trade/services", comingSoon: false, series: annual(servicesFacts, "trade.turnover"), seriesColor: INK, footer: `${span(servicesFacts)} · ${message(presentation.messages, "trade.annual")}`, latest: figure(servicesFacts, "trade.turnover", tradeOverviewCoverage(servicesFacts).max), years: yearsOf(servicesFacts) }] : []),
    ...(compositionFacts?.length ? [{ title: message(presentation.messages, "trade.composition.title"), description: message(presentation.messages, "trade.composition.summary"), href: "/explorer/trade/composition", comingSoon: false, series: annual(compositionFacts, "trade.exports"), seriesColor: INK, footer: `${span(compositionFacts)} · ${message(presentation.messages, "trade.annual")}`, latest: composition ? compositionFigure() : figure(compositionFacts, "trade.exports", tradeOverviewCoverage(compositionFacts).max), years: yearsOf(compositionFacts) }] : []),
  ];
  // Numbered in order, so a dataset without data leaves no gap in the numbering.
  return cards.map((card, index) => ({ index: String(index + 1).padStart(2, "0"), ...card }));
}
