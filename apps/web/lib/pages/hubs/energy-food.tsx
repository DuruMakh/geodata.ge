import { loadServedEnergyFoodData, toClientEnergyFoodFact } from "../../data/energyFood/importEnergyFood";
import { ENERGY_FOOD_HUB_PATH } from "../../explorer/energyFood";
import { buildEnergyFoodHubCards } from "../../explorer/energyFoodHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function energyFoodHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["energyFood"]);
  return fiscalMetadata({ locale, path: ENERGY_FOOD_HUB_PATH, title: message(messages, "energyFood.metaTitle"), description: message(messages, "energyFood.metaDescription") });
}

export async function renderEnergyFoodHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedEnergyFoodData(), getPresentation(locale, ["energyFood", "common"], [])]);
  const title = message(presentation.messages, "energyFood.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "energyFood.hubSummary")} path={ENERGY_FOOD_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildEnergyFoodHubCards(facts.map(toClientEnergyFoodFact), presentation)} testId="energy-food-hub" />;
}
