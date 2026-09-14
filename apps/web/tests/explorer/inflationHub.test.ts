import { describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { periodFromKey } from "../../lib/data/inflation/periods";
import { buildInflationHubCards } from "../../lib/explorer/inflationHubCards";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { formatShare } from "../../lib/explorer/format";
import { getMessages } from "../../lib/i18n/messages.server";

describe("inflation hub", () => {
  it("links the delivered sections and marks the rest as coming soon", async () => {
    const { facts, categories, weights } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} }, categories, weights);
    expect(cards.map((card) => card.href)).toEqual([
      "/explorer/inflation/overview",
      "/explorer/inflation/categories",
      null,
      null,
      null,
    ]);
    expect(cards.map((card) => card.title)).toEqual([
      "Inflation overview",
      "Categories",
      "Consumer basket",
      "Cities",
      "Products",
    ]);
    expect(cards.slice(2).every((card) => card.comingSoon && card.series === null && card.footer === null)).toBe(true);
    const yoy = facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct");
    const last = yoy.reduce((latest, fact) => (fact.period > latest.period ? fact : latest));
    expect(cards[0]!.footer).toBe(
      `${periodLabel(messages, periodFromKey(last.period), "long")} · ${formatShare(Number(last.value) / 100)}`,
    );
    expect(cards[0]!.series).toHaveLength(yoy.length);
  });

  it("leads the categories card with the largest contributor", async () => {
    const { facts, categories, weights } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} }, categories, weights);
    const card = cards[1]!;
    expect(card.comingSoon).toBe(false);
    expect(card.series?.length ?? 0).toBeGreaterThan(100);
    expect(card.footer).toMatch(/ pp$/);
  });

  // Weights refresh annually and CPI monthly, so a January vintage can carry
  // categories with no contribution yet. The card then stays a plain link.
  it("stays a plain link when no contribution can be derived", async () => {
    const { facts, categories } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} }, categories, []);
    expect(cards[1]!.href).toBe("/explorer/inflation/categories");
    expect(cards[1]!.series).toBeNull();
    expect(cards[1]!.footer).toBeNull();
  });
});
