import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import { getPresentation } from "../../i18n/presentation.server";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";
import { INFLATION_HUB_PATH } from "../inflation-shared";

export async function inflationHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["inflation"]);
  return fiscalMetadata({ locale, path: INFLATION_HUB_PATH, title: message(messages, "inflation.hubMetaTitle"), description: message(messages, "inflation.hubDescription") });
}

export async function renderInflationHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS.inflation(locale), getPresentation(locale, ["inflation"], [])]);
  const t = (key: string) => message(presentation.messages, key);
  return (
    <TopicHub locale={locale} presentation={presentation} title={t("inflation.hubHeading")} crumbLabel={t("common.inflation")} summary={t("inflation.hubLead")} path={INFLATION_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="inflation-hub" />
  );
}
