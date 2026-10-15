import { expect, test } from "vitest";
import { toClientForeignInvestmentData } from "../../lib/data/externalFlows/importForeignInvestment";
import { toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { buildExternalHubCards } from "../../lib/explorer/externalHubCards";
import type { ClientCurrentAccountFact } from "../../lib/data/externalFlows/importCurrentAccount";
import type { ClientExternalPositionFact } from "../../lib/data/externalPosition/types";
import { foreignInvestmentEntities, foreignInvestmentFacts, moneyTransferEntities, moneyTransferFacts } from "../data/externalFlows/fixtures";
test("the hub has working Money from abroad, Foreign investment, Current account, Foreign debt and Reserves cards", () => {
  const money = toClientMoneyTransfersData({ entities: moneyTransferEntities(), facts: moneyTransferFacts() });
  const investment = toClientForeignInvestmentData({ entities: foreignInvestmentEntities(), facts: foreignInvestmentFacts() });
  const messages = { "external.money.title": "Money from abroad", "external.money.summary": "Transfers", "external.annual": "annual", "external.investment.title": "Foreign investment", "external.investment.summary": "FDI", "external.account.title": "Current account", "external.account.summary": "BoP", "external.debt.title": "Foreign debt", "external.debt.summary": "Debt", "external.reserves.title": "Reserves", "external.reserves.summary": "Reserves held", "external.position.latestMonth.06": "Jun", "external.position.latestMonth.09": "Sep" };
  const account: ClientCurrentAccountFact[] = [{ seriesId: "ca.balance", flow: "net", year: 2000, valueUsd: -176 }, { seriesId: "ca.balance", flow: "net", year: 2001, valueUsd: -197 }, { seriesId: "ca.balance", flow: "credit", year: 2001, valueUsd: 900 }, { seriesId: "ca.goods", flow: "net", year: 2001, valueUsd: -500 }];
  const point = (indicatorId: ClientExternalPositionFact["indicatorId"], year: number, value: number, periodEnd = `${year}-12-31`): ClientExternalPositionFact => ({ year, indicatorId, value, periodEnd, latestPeriod: !periodEnd.endsWith("-12-31"), sourceId: "nbg" });
  const position = [
    point("ext_debt.total", 2006, 3e9), point("ext_debt.total", 2007, 4e9), point("ext_debt.total", 2025, 5e9), point("ext_debt.total", 2026, 6e9, "2026-06-30"), point("ext_debt.banks", 2005, 1),
    point("reserves.total", 1995, 1e8), point("reserves.total", 1996, 2e8), point("reserves.total", 2026, 7e9, "2026-09-30"), point("reserves.gold", 1990, 1),
  ];
  const cards = buildExternalHubCards(money, investment, account, position, { locale: "en", englishLabels: {}, messages });
  expect(cards.map(card => [card.href, card.comingSoon])).toEqual([["/explorer/external/money-from-abroad", false], ["/explorer/external/foreign-investment", false], ["/explorer/external/current-account", false], ["/explorer/external/foreign-debt", false], ["/explorer/external/reserves", false]]);
  expect(cards.map(card => card.index)).toEqual(["01", "02", "03", "04", "05"]);
  expect(cards[0].series).toEqual([...Array(12).fill(null), 1000]);
  expect(cards[0].footer).toBe("2007–2019 · annual");
  expect(cards[1].series).toEqual([1000]);
  expect(cards[1].footer).toBe("2015–2015 · annual");
  expect(cards[2].series).toEqual([-176, -197]);
  expect(cards[2].footer).toBe("2000–2001 · annual");
  expect(cards.slice(1).map(card => card.title)).toEqual(["Foreign investment", "Current account", "Foreign debt", "Reserves"]);
  // Each new card follows its page's total only, over the total's own years, and names the month of its latest point.
  expect(cards[3].series).toEqual([3e9, 4e9, ...Array(17).fill(null), 5e9, 6e9]);
  expect(cards[3].footer).toBe("2006–2026 (Jun) · annual");
  expect(cards[3].description).toBe("Debt");
  expect(cards[4].series).toEqual([1e8, 2e8, ...Array(29).fill(null), 7e9]);
  expect(cards[4].footer).toBe("1995–2026 (Sep) · annual");
});
