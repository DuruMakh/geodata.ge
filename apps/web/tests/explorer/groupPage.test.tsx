import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), useRouter: () => ({ replace() {} }) }));

import { splitValue } from "../../components/explorer-groups/group-page";
import { topicScrollTarget } from "../../components/explorer-groups/group-topic-scroll";
import { GROUP_HEADLINES, groupHeadlines } from "../../lib/explorer/groupHeadlines";
import type { HubCardModel } from "../../lib/explorer/hubCards";
import { NAV_GROUPS, groupPages, type GroupId } from "../../lib/navigation/navTree";
import { groupPageMetadata, renderGroupPage } from "../../lib/pages/group";

const group = (id: GroupId) => NAV_GROUPS.find((item) => item.id === id)!;
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const hrefs = (html: string, testId: string) => [...html.matchAll(new RegExp(`<a[^>]*data-testid="${testId}"[^>]*>`, "g"))].map((match) => /href="([^"]+)"/.exec(match[0])![1]);
/** The markup of each `<section id="t-…">`, in order. */
const sections = (html: string) => [...html.matchAll(/<section[^>]*id="t-([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)].map((match) => ({ topic: match[1], html: match[2] }));
/** Each card's opening tag, in order. */
const cardTags = (html: string) => [...html.matchAll(/<(?:a|div)[^>]*data-testid="explorer-card"[^>]*>/g)].map((match) => match[0]);

const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });

describe("the Labour market group page (ka)", async () => {
  const html = renderToStaticMarkup(await renderGroupPage("labour", "ka"));

  it("has one H1, the group's name", () => {
    expect(count(html, /<h1[\s>]/g)).toBe(1);
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1]).toContain("შრომის ბაზარი");
  });

  it("puts one line under the heading, then the four headline numbers in their order", () => {
    const below = html.slice(html.indexOf("</h1>"), html.indexOf('data-testid="group-headlines"'));
    expect(count(below, /<p[\s>]/g)).toBe(1);
    expect(below).toContain("უმუშევრობა, დასაქმება და ხელფასები");
    expect(hrefs(html, "group-headline")).toEqual(GROUP_HEADLINES.labour.map(({ page }) => page));
  });

  it("keeps each headline figure and its unit whole, the unit set smaller", () => {
    const figures = [...html.matchAll(/<span[^>]*data-testid="group-headline-figure"[^>]*>([^<]*)<\/span>/g)];
    expect(figures).toHaveLength(4);
    for (const [tag] of figures) expect(tag).toContain("whitespace-nowrap");
    const units = [...html.matchAll(/<span[^>]*data-testid="group-headline-unit"[^>]*>([^<]*)<\/span>/g)];
    expect(units.map((match) => match[1])).toContain("ათასი");
    // The unit and the space before it are set at 13px, so the gap stays a small one.
    expect(count(html, /<span class="text-\[13px\][^"]*"> <span[^>]*data-testid="group-headline-unit"/g)).toBe(units.length);
    for (const [tag] of units) expect(tag).toContain("whitespace-nowrap");
    // The period, not the unit, is what moves to the next line when the row is tight.
    expect(count(html, /<wbr\/><small/g)).toBe(4);
  });

  it("wraps the topic links from 900px and keeps sideways scrolling below", () => {
    const tag = /<nav[^>]*data-testid="group-topic-links"[^>]*>/.exec(html)![0];
    expect(tag).toContain("overflow-x-auto");
    expect(tag).toContain("min-[900px]:flex-wrap");
    expect(tag).toContain("min-[900px]:overflow-x-visible");
    expect(tag).toContain("sticky");
  });

  it("links the two topics' sections", () => {
    expect(hrefs(html, "group-topic-link")).toEqual(["#t-unemployment", "#t-wages"]);
    expect(sections(html).map(({ topic }) => topic)).toEqual(["unemployment", "wages"]);
  });

  it("has one card per page of the group, in the navigation's order", () => {
    expect(hrefs(html, "explorer-card")).toEqual(groupPages(group("labour")).map(({ href }) => href));
    expect(hrefs(html, "explorer-card")).toHaveLength(11);
  });

  it("makes the first card of each topic its lead", () => {
    for (const section of sections(html)) {
      const [lead, ...rest] = cardTags(section.html);
      expect(lead, section.topic).toContain("col-span-full");
      for (const tag of rest) expect(tag, section.topic).not.toContain("col-span-full");
    }
  });

  it("draws the region spread on the Unemployment Regions card", () => {
    const card = /<a[^>]*href="\/explorer\/unemployment\/regions"[^>]*>([\s\S]*?)<\/a>/.exec(html)![1];
    expect(count(card, /data-testid="region-spread-dot"/g)).toBe(11);
    expect(card).toContain("საქართველო 13.9%");
  });

  it("names the group in the breadcrumb, with All data linked", () => {
    expect(html).toMatch(/<a[^>]*href="\/explorer"[^>]*>მონაცემები<\/a>/);
    expect(html).toContain('data-testid="breadcrumb-json-ld"');
    expect(html).toMatch(/2 ქვეთემა · 11 გვერდი · განახლდა \d{4}-\d{2}-\d{2}/);
  });
});

describe("the Budget group page (en)", async () => {
  const html = renderToStaticMarkup(await renderGroupPage("budget", "en"));

  it("has no topic links, one section and eight cards", () => {
    expect(hrefs(html, "group-topic-link")).toEqual([]);
    expect(sections(html).map(({ topic }) => topic)).toEqual(["budget"]);
    expect(cardTags(html)).toHaveLength(8);
    expect(hrefs(html, "group-headline")).toEqual(GROUP_HEADLINES.budget.map(({ page }) => `/en${page}`));
    expect(html).toMatch(/8 pages · Updated \d{1,2} [A-Z][a-z]+ \d{4}/);
  });
});

describe("splitValue", () => {
  it("splits a headline value into its figure and its unit at the first space", () => {
    expect(splitValue("32.4 მლრდ ₾")).toEqual({ figure: "32.4", unit: "მლრდ ₾" });
    expect(splitValue("25.9 მლრდ აშშ დოლარი")).toEqual({ figure: "25.9", unit: "მლრდ აშშ დოლარი" });
    expect(splitValue("13.9%")).toEqual({ figure: "13.9%", unit: null });
    expect(splitValue("+17,127")).toEqual({ figure: "+17,127", unit: null });
  });
});

describe.each(["ka", "en"] as const)("every group page (%s)", (locale) => {
  it.each(NAV_GROUPS.map(({ id }) => id))("%s renders its cards, four headline numbers and its metadata", async (id) => {
    const html = renderToStaticMarkup(await renderGroupPage(id, locale));
    expect(cardTags(html)).toHaveLength(groupPages(group(id)).length);
    expect(count(html, /data-testid="group-headline"/g)).toBe(4);
    const metadata = await groupPageMetadata(id, locale);
    expect(metadata.alternates?.canonical).toBe(`https://fiscal.ge${locale === "en" ? "/en" : ""}${group(id).href}`);
  }, 120_000);
});

describe("groupHeadlines", () => {
  const card = (href: string, latest: HubCardModel["latest"]): HubCardModel => ({
    index: "01", title: `Title of ${href}`, description: "", href, comingSoon: false, series: [1, 2], seriesColor: "#000", footer: null, latest,
  });
  const messages = { "groups.headline.deficit": "Deficit, % of GDP" };
  const cards = ["/explorer/revenue", "/explorer/expenditure", "/explorer/debt", "/explorer/deficit"].map((href) => card(href, { value: "1", period: "2025" }));

  it("labels a pick by its key, or else by its card's title", () => {
    expect(groupHeadlines("budget", cards, messages).map(({ label }) => label)).toEqual(["Title of /explorer/revenue", "Title of /explorer/expenditure", "Title of /explorer/debt", "Deficit, % of GDP"]);
  });

  it("throws when a pick has no latest figure", () => {
    expect(() => groupHeadlines("budget", [...cards.slice(0, 3), card("/explorer/deficit", null)], messages)).toThrow(/\/explorer\/deficit/);
  });

  it("names the Pensions and Inflation picks as spec §5.3 does", async () => {
    const [ka, en] = await Promise.all([import("../../lib/i18n/messages/ka/groups.json"), import("../../lib/i18n/messages/en/groups.json")]);
    const label = (messages: Record<string, string>, group: GroupId, page: string) => messages[`groups.headline.${GROUP_HEADLINES[group].find((pick) => pick.page === page)!.labelKey}`];
    expect([label(ka.default, "living", "/explorer/health/pensions"), label(en.default, "living", "/explorer/health/pensions")]).toEqual(["პენსიონერები", "Pensioners"]);
    expect([label(ka.default, "prices", "/explorer/inflation/overview"), label(en.default, "prices", "/explorer/inflation/overview")]).toEqual(["ინფლაცია", "Inflation"]);
  });

  it("has a ka and an en label for every key a pick names", async () => {
    const [ka, en] = await Promise.all([import("../../lib/i18n/messages/ka/groups.json"), import("../../lib/i18n/messages/en/groups.json")]);
    for (const { labelKey } of Object.values(GROUP_HEADLINES).flat()) {
      if (!labelKey) continue;
      expect(ka.default, labelKey).toHaveProperty([`groups.headline.${labelKey}`]);
      expect(en.default, labelKey).toHaveProperty([`groups.headline.${labelKey}`]);
    }
  });

  it("keeps a caption the label does not already say", () => {
    const withCaption = cards.map((item, index) => ({ ...item, latest: { value: "1", period: "2025", caption: index === 3 ? "Deficit, % of GDP" : "Türkiye, largest" } }));
    expect(groupHeadlines("budget", withCaption, messages).map(({ caption }) => caption)).toEqual(["Türkiye, largest", "Türkiye, largest", "Türkiye, largest", null]);
  });
});

// Review Focus 3: the forward carries the topic as `?topic=`, and the group page turns it into the section's anchor.
describe("topicScrollTarget", () => {
  it("turns ?topic= into the section's anchor and keeps the rest of the query", () => {
    expect(topicScrollTarget("labour", "ka", "/explorer/labour", "?topic=wages", "")).toEqual({ topic: "wages", url: "/explorer/labour#t-wages" });
    expect(topicScrollTarget("labour", "en", "/en/explorer/labour", "?x=1&topic=wages", "#old")).toEqual({ topic: "wages", url: "/en/explorer/labour?x=1#t-wages" });
  });

  it("ignores a topic of another group, and an address without one", () => {
    expect(topicScrollTarget("labour", "ka", "/explorer/labour", "?topic=trade", "")).toBeNull();
    expect(topicScrollTarget("labour", "ka", "/explorer/labour", "", "#t-wages")).toBeNull();
  });

  it("hands an old Unemployment hub view to the page that now serves it", () => {
    expect(topicScrollTarget("labour", "ka", "/explorer/labour", "?topic=unemployment", "#breakdown=region")).toEqual({ navigate: "/explorer/unemployment/regions#breakdown=region" });
    expect(topicScrollTarget("labour", "en", "/en/explorer/labour", "?topic=unemployment&x=1", "#breakdown=age&sel=a")).toEqual({ navigate: "/en/explorer/unemployment/age?x=1#breakdown=age&sel=a" });
    expect(topicScrollTarget("labour", "ka", "/explorer/labour", "", "#breakdown=region")).toEqual({ navigate: "/explorer/unemployment/regions#breakdown=region" });
    // Only an old Unemployment hub link: the Wages section keeps its own hash.
    expect(topicScrollTarget("labour", "ka", "/explorer/labour", "?topic=wages", "#breakdown=region")).toEqual({ topic: "wages", url: "/explorer/labour#t-wages" });
    // Only the Labour page serves the old Unemployment hub.
    expect(topicScrollTarget("society", "ka", "/explorer/society", "?topic=crime", "#breakdown=region")).toEqual({ topic: "crime", url: "/explorer/society#t-crime" });
  });
});
