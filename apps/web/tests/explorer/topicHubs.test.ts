import { describe, expect, it } from "vitest";
import { loadServedTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { NAV_TREE, topicHub, type TopicId } from "../../lib/navigation/navTree";
import { loadTopicHubs, TOPIC_HUB_LOADERS } from "../../lib/pages/topicHubs.server";

const TOPICS = NAV_TREE.map((hub) => hub.id);
const YEARS = /^\d{4}(\/\d{2})?(–\d{4}(\/\d{2})?)?$/;
// Trade and External cards print only their years in the footer ("2015–2025 · Annual data"), and their existing hub
// tests pin that wording; their latest value is their page's figure, so the footer only names its period.
const YEARS_ONLY_FOOTERS: readonly TopicId[] = ["trade", "external"];

describe.each(["ka", "en"] as const)("topic hubs (%s)", (locale) => {
  it.each(TOPICS)("%s: cards follow the topic's pages and carry their latest value and years", async (topic) => {
    const hub = await TOPIC_HUB_LOADERS[topic](locale);
    expect(hub.topic).toBe(topic);
    expect(hub.cards.filter((card) => !card.comingSoon && card.href !== null).map((card) => card.href)).toEqual(topicHub(topic).sections.map((section) => section.href));
    for (const card of hub.cards) {
      expect(card.years, card.title).toMatch(YEARS);
      if (card.series === null) continue;
      expect(card.latest?.value, card.title).toBeTruthy();
      expect(card.footer, card.title).toContain(YEARS_ONLY_FOOTERS.includes(topic) ? card.latest!.period : card.latest!.value);
    }
    expect(hub.lastReviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hub.firstPeriod <= hub.lastPeriod).toBe(true);
  });

  it("draws the age bands, the two sexes and the top industries", async () => {
    const [unemployment, wages] = await loadTopicHubs(locale, ["unemployment", "wages"]);
    const card = (cards: typeof unemployment.cards, href: string) => cards.find((item) => item.href === href)!;
    const age = card(unemployment.cards, "/explorer/unemployment/age").graphic;
    expect(age?.kind).toBe("bars");
    if (age?.kind !== "bars") return;
    expect(age.bars).toHaveLength(11);
    expect(age.bars.map((bar) => bar.accent)).toEqual([true, true, true, ...Array(8).fill(false)]);
    expect([age.first, age.last]).toEqual([age.bars[0].label, age.bars.at(-1)!.label]);
    const sex = card(unemployment.cards, "/explorer/unemployment/gender").graphic;
    expect(sex?.kind).toBe("pair");
    if (sex?.kind !== "pair") return;
    expect(sex.rows.map((row) => row.label)).toEqual(locale === "en" ? ["Men", "Women"] : ["კაცები", "ქალები"]);
    const industries = card(wages.cards, "/explorer/wages/industries").graphic;
    expect(industries?.kind).toBe("pair");
    if (industries?.kind !== "pair") return;
    expect(industries.rows).toHaveLength(3);
    expect(industries.rows.map((row) => row.accent)).toEqual([true, false, false]);
    expect(industries.rows.map((row) => row.value)).toEqual([...industries.rows.map((row) => row.value)].sort((a, b) => b - a));
    expect(industries.max).toBe(industries.rows[0].value);
  });

  it("names the largest trading partner of the latest year", async () => {
    const [{ cards }, partners] = await Promise.all([TOPIC_HUB_LOADERS.trade(locale), loadServedTradePartnersData()]);
    const turnover = partners.facts.filter((fact) => fact.indicatorId === "trade.turnover" && partners.entities.find((entity) => entity.id === fact.entityId)?.kind === "country" && fact.valueUsd !== null);
    const year = Math.max(...turnover.map((fact) => fact.year));
    const largest = turnover.filter((fact) => fact.year === year).sort((a, b) => Number(b.valueUsd) - Number(a.valueUsd))[0];
    const latest = cards.find((card) => card.href === "/explorer/trade/partners")!.latest!;
    expect(latest.period).toBe(String(year));
    if (locale === "ka") expect(latest.caption).toBe(`${partners.entities.find((entity) => entity.id === largest.entityId)!.labelKa}, უმსხვილესი`);
    else expect(latest.caption).toMatch(/^.+, largest$/);
  });

  it("loads each topic once per language", async () => {
    const [first] = await loadTopicHubs(locale, ["crime"]);
    expect(await TOPIC_HUB_LOADERS.crime(locale)).toBe(first);
    expect((await loadTopicHubs(locale, ["wages", "crime"])).map((hub) => hub.topic)).toEqual(["wages", "crime"]);
  });
});
