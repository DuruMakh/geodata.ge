import { describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { periodFromKey } from "../../lib/data/inflation/periods";
import { buildInflationHubCards } from "../../lib/explorer/inflationHubCards";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { getMessages } from "../../lib/i18n/messages.server";

describe("inflation hub", () => {
  it("links only the delivered overview and marks the rest as coming soon", async () => {
    const { facts } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} });
    expect(cards.map((card) => card.href)).toEqual(["/explorer/inflation/overview", null, null, null, null]);
    expect(cards.map((card) => card.title)).toEqual(["Inflation overview", "Categories", "Consumer basket", "Cities", "Products"]);
    expect(cards.slice(1).every((card) => card.comingSoon && card.series === null && card.footer === null)).toBe(true);
    const yoy = facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct");
    const last = yoy.reduce((latest, fact) => (fact.period > latest.period ? fact : latest));
    expect(cards[0]!.footer).toBe(`${periodLabel(messages, periodFromKey(last.period), "long")} · ${(last.value).toFixed(1)}%`);
    expect(cards[0]!.series).toHaveLength(yoy.length);
  });
});
