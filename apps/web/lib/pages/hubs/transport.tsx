import { TRANSPORT_HUB_PATH } from "../../explorer/transport";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function transportHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["transport"]);
  return fiscalMetadata({ locale, path: TRANSPORT_HUB_PATH, title: message(messages, "transport.metaTitle"), description: message(messages, "transport.metaDescription") });
}

export async function renderTransportHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.transport(locale), getPresentation(locale, ["transport"], [])]);
  const title = message(presentation.messages, "transport.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "transport.hubSummary")} path={TRANSPORT_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="transport-hub" />;
}
