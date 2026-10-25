import { expect, test } from "vitest";
import { tradeFixtureFacts } from "../data/tradeOverview/fixtures";
import { buildTradeHubCards } from "../../lib/explorer/tradeHubCards";
import { getMessages } from "../../lib/i18n/messages.server";
test("appends composition without changing the five existing cards", async () => {
  const facts = tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) }));
  const presentation = { locale: "en" as const, englishLabels: {}, messages: await getMessages("en", ["trade"]) };
  const coverage = { min: 2000, max: 2025, years: [2000, 2025] };
  const existing = buildTradeHubCards(facts, presentation, coverage, coverage, facts, facts);
  const composition = [2000, 2025].map((year, index) => ({ ...facts[0], year, indicatorId: "trade.exports" as const, valueUsd: [10, 50][index] }));
  const cards = buildTradeHubCards(facts, presentation, coverage, coverage, facts, facts, composition);
  expect(cards.slice(0, 5)).toEqual(existing);
  expect(cards).toHaveLength(6);
  expect(cards.at(-1)).toMatchObject({ index: "06", href: "/explorer/trade/composition", title: "Trade composition", series: [10, ...Array(24).fill(null), 50] });
  expect(cards.at(-1)?.footer).toContain("2000–2025");
  // A year without a value is a gap in the sparkline, never a join across it.
  expect(cards.at(-1)?.series).toHaveLength(26);
});
test("the hub has working Overview and Partners entries with their loaded coverage", () => {
  const cards = buildTradeHubCards(tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) })), { locale: "en", englishLabels: {}, messages: { "trade.title": "Trade Overview", "trade.summary": "Annual goods trade", "trade.annual": "Annual", "trade.partners.title": "Trading partners", "trade.partners.summary": "Countries and groups" } }, { min: 1995, max: 2025, years: [1995, 2025] });
  expect(cards).toHaveLength(2);
  expect(cards[0]).toMatchObject({ href: "/explorer/trade/overview", comingSoon: false, series: [230, 300.75] });
  expect(cards[0].footer).toContain("2024–2025");
  expect(cards[1]).toMatchObject({ href: "/explorer/trade/partners", comingSoon: false });
  expect(cards[1].footer).toContain("1995–2025");
});
test("Products becomes the third live card when its reviewed coverage is supplied", () => {
  const cards = buildTradeHubCards(tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) })), { locale: "en", englishLabels: {}, messages: { "trade.title": "Overview", "trade.summary": "Annual goods", "trade.annual": "Annual", "trade.partners.title": "Trading partners", "trade.partners.summary": "Partners", "trade.products.title": "Products", "trade.products.summary": "Historical products" } }, { min: 1995, max: 2025, years: [1995, 2025] }, { min: 1995, max: 2025, years: [1995, 2025] });
  expect(cards).toHaveLength(3);
  expect(cards[2]).toMatchObject({ href: "/explorer/trade/products", comingSoon: false, title: "Products" });
  expect(cards[2].footer).toContain("1995–2025");
});


test("Services is the fifth live card, with independent services turnover and coverage", () => {
  const facts = tradeFixtureFacts().map(f => ({ ...f, valueUsd: Number(f.valueUsd) }));
  const services = [2020, 2024].map((year, index) => ({ ...facts[0], year, indicatorId: "trade.turnover" as const, valueUsd: [345, 678][index] }));
  for (const locale of ["ka", "en"] as const) {
    const title = locale === "en" ? "Services trade" : "მომსახურებით ვაჭრობა";
    const presentation = { locale, englishLabels: {}, messages: { "trade.title": "Overview", "trade.summary": "Goods", "trade.annual": "Annual", "trade.partners.title": "Partners", "trade.partners.summary": "Countries", "trade.products.title": "Products", "trade.products.summary": "Goods", "trade.domestic.title": "Domestic exports", "trade.domestic.summary": "Goods", "trade.services.title": title, "trade.services.summary": "Annual services" } };
    const cards = buildTradeHubCards(facts, presentation, { min: 1995, max: 2025, years: [1995, 2025] }, { min: 2020, max: 2025, years: [2020, 2025] }, facts.map(f => ({ ...f, indicatorId: "trade.domestic_exports" as const })), services);
    expect(cards).toHaveLength(5);
    expect(cards[3].href).toBe("/explorer/trade/domestic-exports");
    expect(cards[4]).toMatchObject({ index: "05", title, href: "/explorer/trade/services", comingSoon: false, series: [345, null, null, null, 678] });
    expect(cards[4].footer).toContain("2020–2024");
    expect(buildTradeHubCards(facts, presentation, { min: 1995, max: 2025, years: [1995, 2025] }, { min: 2020, max: 2025, years: [2020, 2025] }, facts)).toHaveLength(4);
  }
});
