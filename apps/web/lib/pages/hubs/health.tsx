import { loadServedHealthData, toClientHealthFact } from "../../data/health/importHealth";
import { loadServedSocialData, toClientSocialFact } from "../../data/social/importSocial";
import { HEALTH_HUB_PATH } from "../../explorer/health";
import { buildHealthHubCards } from "../../explorer/healthHubCards";
import { buildSocialHubCards } from "../../explorer/socialHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function healthHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["health"]);
  return fiscalMetadata({ locale, path: HEALTH_HUB_PATH, title: message(messages, "health.metaTitle"), description: message(messages, "health.metaDescription") });
}

/** The hub: Health's three cards, then the four social protection cards, each from served facts. */
export async function renderHealthHub(locale: Locale) {
  const [{ facts }, { facts: social }, presentation] = await Promise.all([loadServedHealthData(), loadServedSocialData(), getPresentation(locale, ["health", "social"], [])]);
  const title = message(presentation.messages, "health.title"), years = [...facts, ...social].map(f => f.year);
  const lastReviewedAt = [...facts, ...social].map(f => f.lastReviewedAt).sort().at(-1);
  const cards = [...buildHealthHubCards(facts.map(toClientHealthFact), presentation), ...buildSocialHubCards(social.map(toClientSocialFact), presentation)];
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "health.hubSummary")} path={HEALTH_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), lastReviewedAt)} cards={cards} testId="health-hub" />;
}
