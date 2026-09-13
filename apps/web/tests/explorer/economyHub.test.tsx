import { expect, it } from "vitest";
import { buildEconomyHubCards } from "../../lib/explorer/economyHubCards";
import { getMessages } from "../../lib/i18n/messages.server";
import { prepareGdpOverview } from "../../lib/data/gdpOverview/prepareGdpOverview";
import { loadEconomicSectorFacts } from "../../lib/data/economicSectors/importEconomicSectors";
import { loadRegionalEconomyFacts } from "../../lib/data/regionalEconomies/importRegionalEconomies";
it("links all three delivered Economy datasets and derives their coverage", async () => {
  const facts = (await prepareGdpOverview()).facts.map((f) => ({
    ...f,
    value: Number(f.value),
  }));
  const [sectors, regional] = await Promise.all([loadEconomicSectorFacts(), loadRegionalEconomyFacts()]);
  const cards = buildEconomyHubCards(facts, {
    locale: "en",
    messages: await getMessages("en", ["gdp"]),
    englishLabels: {},
  }, sectors.map((fact) => ({ ...fact, value: Number(fact.value) })), regional.map((fact) => ({ ...fact, value: Number(fact.value) })));
  expect(cards.map((c) => c.href)).toEqual([
    "/explorer/economy/gdp",
    "/explorer/economy/sectors",
    "/explorer/economy/regions",
  ]);
  expect(cards[0].footer).toContain("27.1");
  expect(cards[1].footer).toBe("2010–2025");
  expect(cards[2].footer).toBe("2010–2024");
  expect(cards.slice(1).every((c) => !c.comingSoon && c.series === null)).toBe(true);
});

it("keeps Regional economies unavailable when regional facts are absent", async () => {
  const facts = (await prepareGdpOverview()).facts.map((fact) => ({ ...fact, value: Number(fact.value) }));
  const cards = buildEconomyHubCards(facts, {
    locale: "en",
    messages: await getMessages("en", ["gdp"]),
    englishLabels: {},
  });
  expect(cards[2]).toMatchObject({ href: null, comingSoon: true, footer: null });
});
