import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function wagesHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["wages"]);
  return fiscalMetadata({ locale, path: "/explorer/wages", title: message(messages, "wages.metaTitle"), description: message(messages, "wages.metaDescription") });
}

export async function renderWagesHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.wages(locale), getPresentation(locale, ["wages"], [])]);
  const title = message(presentation.messages, "wages.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "wages.hubSummary")} path={"/explorer/wages"} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="wages-hub" />;
}
