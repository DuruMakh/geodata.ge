import { loadServedTradeDomesticData, toClientTradeDomesticData } from "../../data/tradeDomestic/importTradeDomestic";
import { loadServedTradeOverviewData, toClientTradeOverviewFact } from "../../data/tradeOverview/importTradeOverview";
import { loadServedTradePartnersData, toClientTradePartnersData } from "../../data/tradePartners/importTradePartners";
import { loadServedTradeProductsData, toClientTradeProductsData } from "../../data/tradeProducts/importTradeProducts";
import { loadServedTradeServicesData, toClientTradeServicesData } from "../../data/tradeServices/importTradeServices";
import { buildTradeHubCards } from "../../explorer/tradeHubCards";
import { tradePartnersCoverage } from "../../explorer/tradePartnersState";
import { tradeProductsCoverage } from "../../explorer/tradeProductsState";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

/** The source block the Products pages show; the hub reports the same coverage. */
export const PRODUCT_SOURCE_BLOCK = "2020-2025";

export async function tradeHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["trade"]);
  return fiscalMetadata({ locale, path: "/explorer/trade", title: message(messages, "trade.hubMetaTitle"), description: message(messages, "trade.hubMetaDescription") });
}
export async function renderTradeHub(locale: Locale) {
  const [{ facts }, partners, products, domestic, services, presentation] = await Promise.all([loadServedTradeOverviewData(), loadServedTradePartnersData(), loadServedTradeProductsData(), loadServedTradeDomesticData(), loadServedTradeServicesData(), getPresentation(locale, ["trade"], [])]);
  const title = message(presentation.messages, "trade.hubTitle");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "trade.hubSummary")} path={"/explorer/trade"} coverage="" cards={buildTradeHubCards(facts.map(toClientTradeOverviewFact), presentation, tradePartnersCoverage(toClientTradePartnersData(partners, [])), tradeProductsCoverage(toClientTradeProductsData(products, [], "", PRODUCT_SOURCE_BLOCK)), toClientTradeDomesticData(domestic, []).national, toClientTradeServicesData(services).national)} testId="trade-hub" />;
}
