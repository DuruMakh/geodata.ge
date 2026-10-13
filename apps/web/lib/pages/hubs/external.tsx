import { loadServedCurrentAccountFacts, toClientCurrentAccountFacts } from "../../data/externalFlows/importCurrentAccount";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../../data/externalFlows/importForeignInvestment";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../../data/externalFlows/importMoneyTransfers";
import { buildExternalHubCards } from "../../explorer/externalHubCards";
import { getPresentation } from "../../i18n/presentation.server";
import { getMessages } from "../../i18n/messages.server";
import { message } from "../../i18n/messages";
import type { Locale } from "../../i18n/types";
import { fiscalMetadata } from "../../seo/metadata";
import { TopicHub } from "../hub";

export async function externalHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["external"]);
  return fiscalMetadata({ locale, path: "/explorer/external", title: message(messages, "external.metaTitle"), description: message(messages, "external.metaDescription") });
}

export async function renderExternalHub(locale: Locale) {
  const [transfers, investment, account, presentation] = await Promise.all([loadServedMoneyTransfersData(), loadServedForeignInvestmentData(), loadServedCurrentAccountFacts(), getPresentation(locale, ["external", "common"], [])]);
  const title = message(presentation.messages, "external.hubTitle");
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "external.hubSummary")} path={"/explorer/external"} coverage="" cards={buildExternalHubCards(toClientMoneyTransfersData(transfers), toClientForeignInvestmentData(investment), toClientCurrentAccountFacts(account), presentation)} testId="external-hub" />;
}
