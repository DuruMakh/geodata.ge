import { expect, test } from "vitest";
import { toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { buildExternalHubCards } from "../../lib/explorer/externalHubCards";
import { foreignInvestmentEntities, foreignInvestmentFacts, moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
test("the hub has working Money from abroad and Foreign investment cards and a non-clickable coming-soon card", () => {
  const money = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() });
  const investment = toClientForeignInvestmentData({ entities: foreignInvestmentEntities(), facts: foreignInvestmentFacts() });
  const messages = { "external.money.title": "Money from abroad", "external.money.summary": "Transfers", "external.annual": "annual", "external.investment.title": "Foreign investment", "external.investment.summary": "FDI", "external.account.title": "Current account", "external.account.summary": "BoP" };
  const cards = buildExternalHubCards(money, investment, { locale: "en", englishLabels: {}, messages });
  expect(cards.map(card => [card.href, card.comingSoon])).toEqual([["/explorer/external/money-from-abroad", false], ["/explorer/external/foreign-investment", false], [null, true]]);
  expect(cards[0].series).toEqual([...Array(12).fill(null), 1000]);
  expect(cards[0].footer).toBe("2007–2019 · annual");
  expect(cards[1].series).toEqual([1000]);
  expect(cards[1].footer).toBe("2015–2015 · annual");
  expect(cards.slice(1).map(card => card.title)).toEqual(["Foreign investment", "Current account"]);
});
