import { expect, test } from "vitest";
import { tradeFixtureFacts } from "../data/tradeOverview/fixtures";
import { buildTradeHubCards } from "../../lib/explorer/tradeHubCards";
test("the hub has one working Overview entry with turnover sparkline and loaded coverage", () => {
  const cards = buildTradeHubCards(tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) })), { locale: "en", englishLabels: {}, messages: { "trade.title": "Trade Overview", "trade.summary": "Annual goods trade", "trade.annual": "Annual" } });
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({ href: "/explorer/trade/overview", comingSoon: false, series: [230, 300.75] });
  expect(cards[0].footer).toContain("2024–2025");
});
