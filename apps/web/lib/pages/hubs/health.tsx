import { loadServedHealthData, toClientHealthFact } from "../../data/health/importHealth";
import { HEALTH_HUB_PATH } from "../../explorer/health";
import { buildHealthHubCards } from "../../explorer/healthHubCards";
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

export async function renderHealthHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedHealthData(), getPresentation(locale, ["health"], [])]);
  const title = message(presentation.messages, "health.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "health.hubSummary")} path={HEALTH_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildHealthHubCards(facts.map(toClientHealthFact), presentation)} testId="health-hub" />;
}
