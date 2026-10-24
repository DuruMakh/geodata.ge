import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function externalHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["external"]);
  return fiscalMetadata({ locale, path: "/explorer/external", title: message(messages, "external.metaTitle"), description: message(messages, "external.metaDescription") });
}

export async function renderExternalHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.external(locale), getPresentation(locale, ["external"], [])]);
  const title = message(presentation.messages, "external.hubTitle");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "external.hubSummary")} path={"/explorer/external"} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="external-hub" />;
}
