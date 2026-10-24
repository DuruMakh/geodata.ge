import { ENERGY_FOOD_HUB_PATH } from "../../explorer/energyFood";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";
import { TOPIC_HUB_LOADERS, topicHubCoverage } from "../topicHubs.server";

export async function energyFoodHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["energyFood"]);
  return fiscalMetadata({ locale, path: ENERGY_FOOD_HUB_PATH, title: message(messages, "energyFood.metaTitle"), description: message(messages, "energyFood.metaDescription") });
}

export async function renderEnergyFoodHub(locale: Locale) {
  const [hub, presentation] = await Promise.all([TOPIC_HUB_LOADERS["energy-food"](locale), getPresentation(locale, ["energyFood"], [])]);
  const title = message(presentation.messages, "energyFood.title");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "energyFood.hubSummary")} path={ENERGY_FOOD_HUB_PATH} coverage={topicHubCoverage(presentation.messages, locale, hub)} cards={hub.cards} testId="energy-food-hub" />;
}
