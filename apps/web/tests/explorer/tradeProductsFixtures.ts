import { toClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import type { Presentation } from "../../lib/i18n/types";
import { tradeProductEntities, tradeProductFacts, tradeProductNationalFacts } from "../data/tradeProducts/fixtures";

export const productData = () => toClientTradeProductsData({ entities: tradeProductEntities(), facts: tradeProductFacts() }, tradeProductNationalFacts(), "a".repeat(64));
export function productPresentation(locale: "en" | "ka" = "en"): Presentation {
  return { locale, englishLabels: Object.fromEntries(tradeProductEntities().map(entity => [entity.id, entity.sourceLabelEn])), messages: { "trade.partners.total": locale === "en" ? "Georgia total" : "საქართველოს ჯამი", "trade.unit.million": locale === "en" ? "Million USD" : "მლნ აშშ დოლარი", "trade.unit.billion": locale === "en" ? "Billion USD" : "მლრდ აშშ დოლარი" } };
}
