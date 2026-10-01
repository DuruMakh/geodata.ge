import { describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { loadServedProductData } from "../../lib/data/inflation/importProducts";
import { periodFromKey } from "../../lib/data/inflation/periods";
import { cityFactInput } from "../../lib/data/inflation/types";
import { buildInflationHubCards, buildLatestProductHubSummary } from "../../lib/explorer/inflationHubCards";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { formatShare } from "../../lib/explorer/format";
import { getMessages } from "../../lib/i18n/messages.server";

describe("inflation hub", () => {
  it("links all four delivered sections", async () => {
    const { facts, categories, weights, cities } = await loadServedInflationData();
    const products = await loadServedProductData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} }, categories, weights, buildLatestProductHubSummary(products), cities.map(cityFactInput));
    expect(cards.map((card) => card.href)).toEqual([
      "/explorer/inflation/overview",
      "/explorer/inflation/categories",
      "/explorer/inflation/products",
      "/explorer/inflation/cities",
    ]);
    expect(cards.map((card) => card.title)).toEqual([
      "Inflation overview",
      "Categories",
      "Products",
      "Cities",
    ]);
    expect(cards.every((card) => !card.comingSoon)).toBe(true);
    expect(cards[2]!.footer).toMatch(/Tomato.*57\.5%/);
    expect(cards[2]!.series?.length ?? 0).toBeGreaterThan(100);
    const yoy = facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct");
    const last = yoy.reduce((latest, fact) => (fact.period > latest.period ? fact : latest));
    expect(cards[0]!.footer).toBe(
      `${periodLabel(messages, periodFromKey(last.period), "long")} · ${formatShare(Number(last.value) / 100)}`,
    );
    expect(cards[0]!.series).toHaveLength(yoy.length);
  });

  it("leads the categories card with the largest contributor", async () => {
    const { facts, categories, weights, cities } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} }, categories, weights, null, cities.map(cityFactInput));
    const card = cards[1]!;
    expect(card.comingSoon).toBe(false);
    expect(card.series?.length ?? 0).toBeGreaterThan(100);
    expect(card.footer).toMatch(/ pp$/);
  });

  // Weights refresh annually and CPI monthly, so a January vintage can carry
  // categories with no contribution yet. The card then stays a plain link.
  it("stays a plain link when no contribution can be derived", async () => {
    const { facts, categories, cities } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} }, categories, [], null, cities.map(cityFactInput));
    expect(cards[1]!.href).toBe("/explorer/inflation/categories");
    expect(cards[1]!.series).toBeNull();
    expect(cards[1]!.footer).toBeNull();
  });

  it("leads the cities card with the highest city", async () => {
    const { facts, categories, weights, cities } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} }, categories, weights, null, cities.map(cityFactInput));
    expect(cards[3]!.comingSoon).toBe(false);
    expect(cards[3]!.footer).toMatch(/Batumi 7\.1%$/);
  });
});
