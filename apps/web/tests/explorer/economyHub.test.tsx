import { expect, it } from "vitest";
import { buildEconomyHubCards } from "../../lib/explorer/economyHubCards";
import { getMessages } from "../../lib/i18n/messages.server";
import { prepareGdpOverview } from "../../lib/data/gdpOverview/prepareGdpOverview";
import { loadEconomicSectorFacts } from "../../lib/data/economicSectors/importEconomicSectors";
import { loadRegionalEconomyFacts, REGIONAL_ECONOMY_REGIONS } from "../../lib/data/regionalEconomies/importRegionalEconomies";
import { REGIONAL_GDP_TOTAL } from "../../lib/data/regionalEconomies/types";
import { buildSectorHighlights } from "../../lib/explorer/sectorHighlights";
import { ECONOMIC_SECTORS } from "../../lib/data/economicSectors/importEconomicSectors";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { getPresentation } from "../../lib/i18n/presentation.server";
it("links all three delivered Economy datasets and derives their coverage", async () => {
  const facts = (await prepareGdpOverview()).facts.map((f) => ({
    ...f,
    value: Number(f.value),
  }));
  const [sectors, regional] = await Promise.all([loadEconomicSectorFacts(), loadRegionalEconomyFacts()]);
  const sectorFacts = sectors.map((fact) => ({ ...fact, value: Number(fact.value) }));
  const regionalFacts = regional.map((fact) => ({ ...fact, value: Number(fact.value) }));
  const presentation = await getPresentation("en", ["gdp", "sectors", "regionalEconomies"], REGIONAL_ECONOMY_REGIONS.map((region) => region.id));
  const cards = buildEconomyHubCards(facts, presentation, sectorFacts, regionalFacts);
  expect(cards.map((c) => c.href)).toEqual([
    "/explorer/economy/gdp",
    "/explorer/economy/sectors",
    "/explorer/economy/regions",
  ]);
  // One figure: the latest nominal GDP, as the landing states the economy's size.
  const nominal = facts.filter((fact) => fact.seriesId === "nominal_gel").sort((a, b) => a.year - b.year).at(-1)!;
  expect(cards[0].footer).toBe(`${nominal.year} · Nominal GDP ${formatAmount(nominal.value, "en")}`);
  expect(cards[0].footer).not.toContain("Constant");
  const sectorYear = Math.max(...sectorFacts.map((fact) => fact.year));
  const sectorHighlights = buildSectorHighlights(sectorFacts, ECONOMIC_SECTORS, sectorYear);
  expect(cards[1].series).toEqual(sectorHighlights.trends.topThree);
  expect(cards[1].footer).toContain(`${sectorYear} · Top 3 sectors’ GDP share ${formatShare(sectorHighlights.topThreeShare! / 100)}`);
  expect(cards[1].footer).toContain(`${Math.min(...sectorFacts.map((fact) => fact.year))}–${sectorYear}`);
  const regionalTotals = regionalFacts.filter((fact) => fact.measure === "nominal" && fact.seriesId === REGIONAL_GDP_TOTAL);
  const regionalYear = Math.max(...regionalTotals.map((fact) => fact.year));
  const largest = regionalTotals.filter((fact) => fact.year === regionalYear).sort((a, b) => b.value - a.value)[0];
  expect(cards[2].series).toEqual(regionalTotals.filter((fact) => fact.regionId === largest.regionId).sort((a, b) => a.year - b.year).map((fact) => fact.value));
  expect(cards[2].footer).toContain(`${regionalYear} · Largest regional economy: ${presentation.englishLabels[largest.regionId]} · Total regional GDP (Current prices): ${formatAmount(largest.value, "en")}`);
  expect(cards[2].footer).toContain(`${Math.min(...regionalTotals.map((fact) => fact.year))}–${regionalYear}`);
  expect(cards.every((card) => !card.comingSoon && card.series !== null && card.seriesColor !== null)).toBe(true);
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
