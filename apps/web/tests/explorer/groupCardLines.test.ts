import { describe, expect, it } from "vitest";
import { NAV_TREE } from "../../lib/navigation/navTree";
import { loadTopicHubs } from "../../lib/pages/topicHubs.server";

/**
 * A card's value reads the way its own page's line reads it: a figure states its unit or scale word ("bn GEL", "%", "thousand")
 * or carries a caption naming what it counts. These cards state a bare count whose title already names what is counted, so
 * neither is needed; every other card must have one.
 */
const BARE_COUNTS: Record<string, string> = {
  "/explorer/demography/population": "Population: the number of people on 1 January.",
  "/explorer/housing/permits": "Construction permits: the number of permits issued.",
  "/explorer/housing/completed": "Buildings completed: the number of buildings put into use.",
  "/explorer/crime/recorded": "Recorded crime: the number of crimes recorded.",
  "/explorer/crime/convictions": "Convictions: the number of people convicted.",
  "/explorer/crime/victims": "Victims: the number of victims.",
  "/explorer/crime/road-accidents": "Road accidents: the number of accidents.",
};

/** What is left of a value without its digits, separators and sign: its unit or scale word, if it has one. */
const unitOf = (value: string) => value.replace(/[\d.,\s +\-−]/g, "");

describe.each(["ka", "en"] as const)("group page card lines (%s)", async (locale) => {
  const cards = (await loadTopicHubs(locale, NAV_TREE.map((hub) => hub.id))).flatMap((hub) => hub.cards);
  const card = (href: string) => cards.find((candidate) => candidate.href === href)!;

  it("state a unit or a caption on every figure, except the bare counts listed with their reasons", () => {
    const bare = cards.filter((c) => c.latest && !unitOf(c.latest.value) && !c.latest.caption).map((c) => c.href);
    expect(bare.sort()).toEqual(Object.keys(BARE_COUNTS).sort());
  });

  it("draw a sparkline over the years the card states, with a missing year as a gap", () => {
    for (const c of cards.filter((candidate) => candidate.series && candidate.years && /^\d{4}–\d{4}$/.test(candidate.years))) {
      const [first, last] = c.years!.split("–").map(Number);
      if (c.href?.startsWith("/explorer/inflation/")) continue; // Monthly series: one point per month.
      // Population and Age and sex add one gap at the 2024 census re-base, so the line does not join across it.
      const breaks = c.href === "/explorer/demography/population" || c.href === "/explorer/demography/age-sex" ? 1 : 0;
      expect(c.series!.length, c.href ?? c.title).toBe(last - first + 1 + breaks);
    }
  });

  it("follow one series on the GDP card: the Economy overview page's real GDP in US dollars", () => {
    expect(card("/explorer/economy/gdp").latest).toMatchObject({ value: locale === "en" ? "27.1 bn USD" : "27.1 მლრდ აშშ დოლარი", caption: locale === "en" ? "Real GDP" : "რეალური მშპ" });
    expect(card("/explorer/economy/gdp").series!.at(-1)).toBeCloseTo(27_066_204_097, -3);
  });

  it("draw the largest partner's own line on Partners, and Georgia's exports on Products and Composition", () => {
    const partners = card("/explorer/trade/partners");
    expect(partners.series!.at(-1)).toBe(3_111_701_568);
    for (const href of ["/explorer/trade/products", "/explorer/trade/composition"]) {
      expect(card(href).latest).toMatchObject({ value: locale === "en" ? "7.29 billion USD" : "7.29 მლრდ აშშ დოლარი", caption: locale === "en" ? "Exports" : "ექსპორტი" });
    }
  });

  it("mark a latest value published as preliminary", () => {
    const marked = cards.filter((c) => c.latest?.status === "preliminary").map((c) => c.href);
    expect(marked).toEqual(["/explorer/economy/sectors", "/explorer/economy/expenditure", "/explorer/energy-food/farming"]);
  });

  it("spread floor area permitted over the regions on Housing Regions", () => {
    const spread = card("/explorer/housing/regions").spreadEntries!;
    expect(spread.every((entry) => (locale === "en" ? /thousand\sm²$/ : /ათასი\sმ²$/).test(entry.value))).toBe(true);
  });
});
