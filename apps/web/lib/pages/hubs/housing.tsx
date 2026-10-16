import { loadServedHousingData, toClientHousingFact } from "../../data/housing/importHousing";
import { HOUSING_HUB_PATH } from "../../explorer/housing";
import { buildHousingHubCards } from "../../explorer/housingHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function housingHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["housing"]);
  return fiscalMetadata({ locale, path: HOUSING_HUB_PATH, title: message(messages, "housing.metaTitle"), description: message(messages, "housing.metaDescription") });
}

export async function renderHousingHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedHousingData(), getPresentation(locale, ["housing"], [])]);
  const title = message(presentation.messages, "housing.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "housing.hubSummary")} path={HOUSING_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildHousingHubCards(facts.map(toClientHousingFact), presentation)} testId="housing-hub" />;
}
