import { INTERNET_HUB_PATH } from "../../explorer/internet";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function internetHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["internet"]);
  return fiscalMetadata({ locale, path: INTERNET_HUB_PATH, title: message(messages, "internet.metaTitle"), description: message(messages, "internet.metaDescription") });
}

export async function renderInternetHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.internet(locale), getPresentation(locale, ["internet"], [])]);
  const title = message(presentation.messages, "internet.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "internet.hubSummary")} path={INTERNET_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="internet-hub" />;
}
