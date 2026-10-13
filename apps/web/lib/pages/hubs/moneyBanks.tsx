import { loadServedMoneyBanksData, toClientMoneyBanksFact } from "../../data/moneyBanks/importMoneyBanks";
import { buildMoneyBanksHubCards } from "../../explorer/moneyBanksHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function moneyBanksHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["moneyBanks"]);
  return fiscalMetadata({ locale, path: "/explorer/money", title: message(messages, "moneyBanks.metaTitle"), description: message(messages, "moneyBanks.metaDescription") });
}

export async function renderMoneyBanksHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedMoneyBanksData(), getPresentation(locale, ["moneyBanks", "common"], [])]);
  const title = message(presentation.messages, "moneyBanks.title"), years = facts.map(f => f.year);
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "moneyBanks.hubSummary")} path={"/explorer/money"} coverage={coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), facts.map(f => f.lastReviewedAt).sort().at(-1))} cards={buildMoneyBanksHubCards(facts.map(toClientMoneyBanksFact), presentation)} testId="money-hub" />;
}
