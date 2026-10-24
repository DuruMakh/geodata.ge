import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function tradeHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["trade"]);
  return fiscalMetadata({ locale, path: "/explorer/trade", title: message(messages, "trade.hubMetaTitle"), description: message(messages, "trade.hubMetaDescription") });
}
export async function renderTradeHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.trade(locale), getPresentation(locale, ["trade"], [])]);
  const title = message(presentation.messages, "trade.hubTitle");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "trade.hubSummary")} path={"/explorer/trade"} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="trade-hub" />;
}
