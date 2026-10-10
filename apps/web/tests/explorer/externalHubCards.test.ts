import { expect, test } from "vitest";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { buildExternalHubCards } from "../../lib/explorer/externalHubCards";
import { moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
test("the hub has one working Money from abroad card and two non-clickable coming-soon cards", () => {
  const data = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() });
  const messages = { "external.money.title": "Money from abroad", "external.money.summary": "Transfers", "external.annual": "annual", "external.investment.title": "Foreign investment", "external.investment.summary": "FDI", "external.account.title": "Current account", "external.account.summary": "BoP" };
  const cards = buildExternalHubCards(data, { locale: "en", englishLabels: {}, messages });
  expect(cards.map(card => [card.href, card.comingSoon])).toEqual([["/explorer/external/money-from-abroad", false], [null, true], [null, true]]);
  expect(cards[0].series).toEqual([...Array(12).fill(null), 1000]);
  expect(cards[0].footer).toBe("2007–2019 · annual");
  expect(cards.slice(1).map(card => card.title)).toEqual(["Foreign investment", "Current account"]);
});
