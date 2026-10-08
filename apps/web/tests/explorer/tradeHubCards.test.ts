import { expect, test } from "vitest";
import { tradeFixtureFacts } from "../data/tradeOverview/fixtures";
import { buildTradeHubCards } from "../../lib/explorer/tradeHubCards";
test("the hub has working Overview and Partners entries with their loaded coverage", () => {
  const cards = buildTradeHubCards(tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) })), { locale: "en", englishLabels: {}, messages: { "trade.title": "Trade Overview", "trade.summary": "Annual goods trade", "trade.annual": "Annual", "trade.partners.title": "Trading partners", "trade.partners.summary": "Countries and groups" } }, { min: 1995, max: 2025, years: [1995, 2025] });
  expect(cards).toHaveLength(2);
  expect(cards[0]).toMatchObject({ href: "/explorer/trade/overview", comingSoon: false, series: [230, 300.75] });
  expect(cards[0].footer).toContain("2024–2025");
  expect(cards[1]).toMatchObject({ href: "/explorer/trade/partners", comingSoon: false });
  expect(cards[1].footer).toContain("1995–2025");
});
