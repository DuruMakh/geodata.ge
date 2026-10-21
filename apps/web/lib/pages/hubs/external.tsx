import { loadServedCurrentAccountFacts, toClientCurrentAccountFacts } from "../../data/externalFlows/importCurrentAccount";
import { loadServedForeignInvestmentData, toClientForeignInvestmentData } from "../../data/externalFlows/importForeignInvestment";
import { loadServedExternalPositionData, toClientExternalPositionFact } from "../../data/externalPosition/importExternalPosition";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../../data/externalFlows/importMoneyTransfers";
import { buildExternalHubCards } from "../../explorer/externalHubCards";
import { coverageLabel } from "../../explorer/coverageLabel";
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
  const [transfers, investment, account, position, presentation] = await Promise.all([loadServedMoneyTransfersData(), loadServedForeignInvestmentData(), loadServedCurrentAccountFacts(), loadServedExternalPositionData(), getPresentation(locale, ["external"], [])]);
  const title = message(presentation.messages, "external.hubTitle");
  const all = [...transfers.facts, ...investment.facts, ...account, ...position.facts];
  const years = [...new Set(all.map(f => f.year))];
  // The header's coverage label spans the five external datasets (U28-06).
  const coverage = coverageLabel(presentation.messages, locale, Math.min(...years), Math.max(...years), all.reduce((latest, f) => f.lastReviewedAt > latest ? f.lastReviewedAt : latest, ""));
  return <TopicHub locale={locale} presentation={presentation} title={title} summary={message(presentation.messages, "external.hubSummary")} path={"/explorer/external"} coverage={coverage} cards={buildExternalHubCards(toClientMoneyTransfersData(transfers), toClientForeignInvestmentData(investment), toClientCurrentAccountFacts(account), position.facts.map(toClientExternalPositionFact), presentation)} testId="external-hub" />;
}
