import { loadServedHouseholdData, toClientHouseholdFact } from "../data/household/importHousehold";
import { loadServedPovertyData, toClientPovertyFact } from "../data/poverty/importPoverty";
import { buildHouseholdHubCards } from "../explorer/householdHubCards";
import { buildPovertyHubCards } from "../explorer/povertyHubCards";
import { LIVING_STANDARDS_HUB_PATH } from "../explorer/livingStandards";
import { coverageLabel } from "../explorer/coverageLabel";
import { getPresentation } from "../i18n/presentation.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import type { Locale } from "../i18n/types";
import { fiscalMetadata } from "../seo/metadata";
import { TopicHub } from "./hub";

export async function livingStandardsHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["household"]);
  return fiscalMetadata({ locale, path: LIVING_STANDARDS_HUB_PATH, title: message(messages, "household.hub.metaTitle"), description: message(messages, "household.hub.metaDescription") });
}

export async function renderLivingStandardsHub(locale: Locale) {
  const [household, poverty, presentation] = await Promise.all([loadServedHouseholdData(), loadServedPovertyData(), getPresentation(locale, ["household", "poverty"], [])]);
  const title = message(presentation.messages, "household.hub.title");
  const years = [...household.facts, ...poverty.facts].map(f => f.year);
  const lastReviewedAt = [...household.facts, ...poverty.facts].map(f => f.lastReviewedAt).sort().at(-1);
  // Income and Spending come first, then Poverty and Inequality; the cards are numbered across the hub.
  const cards = [...buildHouseholdHubCards(household.facts.map(toClientHouseholdFact), presentation), ...buildPovertyHubCards(poverty.facts.map(toClientPovertyFact), presentation)]
    .map((card, index) => ({ ...card, index: String(index + 1).padStart(2, "0") }));
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "household.hub.summary")} path={LIVING_STANDARDS_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), lastReviewedAt)} cards={cards} testId="living-standards-hub" />;
}
