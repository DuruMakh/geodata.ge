import { expect, it } from "vitest";
import { buildEconomyHubCards } from "../../lib/explorer/economyHubCards";
import { getMessages } from "../../lib/i18n/messages.server";
import { prepareGdpOverview } from "../../lib/data/gdpOverview/prepareGdpOverview";
it("only links the delivered GDP overview", async () => {
  const facts = (await prepareGdpOverview()).facts.map((f) => ({
    ...f,
    value: Number(f.value),
  }));
  const cards = buildEconomyHubCards(facts, {
    locale: "en",
    messages: await getMessages("en", ["gdp"]),
    englishLabels: {},
  });
  expect(cards.map((c) => c.href)).toEqual([
    "/explorer/economy/gdp",
    null,
    null,
  ]);
  expect(cards[0].footer).toContain("27.1");
  expect(cards[0].footer).toContain("2025: 27.1 bn (Constant 2015 USD)");
  expect(cards.slice(1).every((c) => c.comingSoon && c.series === null)).toBe(
    true,
  );
});
