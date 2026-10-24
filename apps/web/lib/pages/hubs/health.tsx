import { HEALTH_HUB_PATH } from "../../explorer/health";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function healthHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["health"]);
  return fiscalMetadata({ locale, path: HEALTH_HUB_PATH, title: message(messages, "health.metaTitle"), description: message(messages, "health.metaDescription") });
}

/** The hub: Health's three cards, then the four social protection cards, each from served facts. */
export async function renderHealthHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.health(locale), getPresentation(locale, ["health", "social"], [])]);
  const title = message(presentation.messages, "health.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "health.hubSummary")} path={HEALTH_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="health-hub" />;
}
