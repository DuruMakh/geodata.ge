import { UnemploymentLegacyLink } from "../../../components/unemployment/unemployment-legacy-link";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function unemploymentHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["unemployment"]);
  return fiscalMetadata({ locale, path: "/explorer/unemployment", title: message(messages, "unemployment.metaTitle"), description: message(messages, "unemployment.metaDescription") });
}

export async function renderUnemploymentHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.unemployment(locale), getPresentation(locale, ["unemployment", "labour"], [])]);
  const title = message(presentation.messages, "unemployment.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "unemployment.hubSummary")} path={"/explorer/unemployment"} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="unemployment-hub" after={<UnemploymentLegacyLink locale={locale} />} />;
}
