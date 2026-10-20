import { loadServedTransportData, toClientTransportFact } from "../../data/transport/importTransport";
import { TRANSPORT_HUB_PATH } from "../../explorer/transport";
import { buildTransportHubCards } from "../../explorer/transportHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function transportHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["transport"]);
  return fiscalMetadata({ locale, path: TRANSPORT_HUB_PATH, title: message(messages, "transport.metaTitle"), description: message(messages, "transport.metaDescription") });
}

export async function renderTransportHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedTransportData(), getPresentation(locale, ["transport"], [])]);
  const title = message(presentation.messages, "transport.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "transport.hubSummary")} path={TRANSPORT_HUB_PATH} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildTransportHubCards(facts.map(toClientTransportFact), presentation)} testId="transport-hub" />;
}
