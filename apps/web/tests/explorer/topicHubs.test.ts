import { describe, expect, it } from "vitest";
import { loadServedMoneyTransfersData, toClientMoneyTransfersData } from "../../lib/data/externalFlows/importMoneyTransfers";
import { MONEY_TRANSFER_TOTAL_ID } from "../../lib/data/externalFlows/types";
import { loadServedTradePartnersData } from "../../lib/data/tradePartners/importTradePartners";
import { formatInUnit } from "../../lib/explorer/format";
import { buildMoneyTransfersModel } from "../../lib/explorer/moneyTransfers";
import { DEFAULT_MONEY_TRANSFERS_STATE } from "../../lib/explorer/moneyTransfersState";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { NAV_TREE, topicHub, type TopicId } from "../../lib/navigation/navTree";
import { loadTopicHubs, TOPIC_HUB_LOADERS } from "../../lib/pages/topicHubs.server";
import { renderPageMarkup } from "../helpers/render-localized";

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
    // Inflation's periods are month labels (`იან 2002`); compare their years.
    const year = (period: string) => Number(/\d{4}/.exec(period)![0]);
    expect(year(hub.firstPeriod)).toBeLessThanOrEqual(year(hub.lastPeriod));
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
    const name = locale === "ka" ? partners.entities.find((entity) => entity.id === largest.entityId)!.labelKa : (await getPresentation("en", [], [largest.entityId])).englishLabels[largest.entityId];
    expect(latest.caption).toBe(locale === "ka" ? `${name}, უმსხვილესი` : `${name}, largest`);
  });

  // The Trade and External footers name only years, so their figures are checked against the pages they open.
  const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const latestOf = async (topic: TopicId, href: string) => (await TOPIC_HUB_LOADERS[topic](locale)).cards.find((card) => card.href === href)!.latest!;

  it("states the trade turnover the Overview page sums up", async () => {
    const { renderTradeOverviewPage } = await import("../../lib/pages/trade");
    const html = renderPageMarkup(locale, await renderTradeOverviewPage(locale));
    const summary = /data-testid="trade-summary" data-end-year="(\d{4})"[\s\S]*?data-indicator="trade.turnover"[^>]*>[\s\S]*?<\/dt><dd[^>]*>([^<]+)<\/dd><dd[^>]*>([^<]+)<\/dd>/.exec(html)!;
    expect(await latestOf("trade", "/explorer/trade/overview")).toEqual({ value: `${summary[2]} ${summary[3]}`, period: summary[1] });
  });

  it.each(["foreign-debt", "reserves"] as const)("states the %s page's latest line", async (section) => {
    const { renderExternalPositionPage } = await import("../../lib/pages/external");
    const line = text(/<p data-testid="position-latest"[^>]*>([\s\S]*?)<\/p>/.exec(renderPageMarkup(locale, await renderExternalPositionPage(locale, section)))![1]);
    const latest = await latestOf("external", `/explorer/external/${section}`);
    expect(line.endsWith(`· ${latest.period}: ${latest.value}`), line).toBe(true);
  });

  it("states the money received from abroad in the page's last year and unit", async () => {
    const served = await loadServedMoneyTransfersData();
    const presentation = await getPresentation(locale, ["external"], served.entities.map((entity) => entity.id));
    const model = buildMoneyTransfersModel(toClientMoneyTransfersData(served), DEFAULT_MONEY_TRANSFERS_STATE, presentation);
    const year = Math.max(...served.facts.filter((fact) => fact.entityId === MONEY_TRANSFER_TOTAL_ID && fact.measure === "received" && fact.valueUsd !== null).map((fact) => fact.year));
    const received = Number(served.facts.find((fact) => fact.entityId === MONEY_TRANSFER_TOTAL_ID && fact.measure === "received" && fact.year === year)!.valueUsd);
    expect(await latestOf("external", "/explorer/external/money-from-abroad")).toEqual({ value: `${formatInUnit(received, model.unit)} ${model.unit.label}`, period: String(year) });
  });

  it("loads each topic once per language", async () => {
    const [first] = await loadTopicHubs(locale, ["crime"]);
    expect(await TOPIC_HUB_LOADERS.crime(locale)).toBe(first);
    expect((await loadTopicHubs(locale, ["wages", "crime"])).map((hub) => hub.topic)).toEqual(["wages", "crime"]);
  });
});
