import { describe, expect, it } from "vitest";
import kaAllData from "../../lib/i18n/messages/ka/allData.json";
import enAllData from "../../lib/i18n/messages/en/allData.json";
import kaCommon from "../../lib/i18n/messages/ka/common.json";
import enCommon from "../../lib/i18n/messages/en/common.json";
import { azColumns, azGroups, buildSearchPages, buildShortcuts, type AzGroup } from "../../lib/explorer/allDataIndex";
import { rowLabel } from "../../lib/explorer/search/searchExplorer";
import { NAV_GROUPS, NAV_TREE, PAGE_COUNT } from "../../lib/navigation/navTree";
import { loadCardSpreads } from "../../lib/pages/group";
import { loadTopicHubs } from "../../lib/pages/topicHubs.server";

const messagesKa = { ...kaCommon, ...kaAllData };
const messagesEn = { ...enCommon, ...enAllData };
const TOPICS = NAV_TREE.map((hub) => hub.id);
const KA_ALPHABET = "აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ";

describe.each(["ka", "en"] as const)("the All data pages (%s)", async (locale) => {
  const pages = buildSearchPages(await loadTopicHubs(locale, TOPICS), messagesKa, messagesEn);

  it("lists every navigation page once, with its group, topic and names in both languages", () => {
    expect(pages).toHaveLength(PAGE_COUNT);
    expect(pages).toHaveLength(PAGE_COUNT);
    expect(new Set(pages.map((page) => page.href)).size).toBe(PAGE_COUNT);
    for (const page of pages) {
      expect(page.group, page.href).toBeTruthy();
      expect(page.topic, page.href).toBeTruthy();
      for (const name of [page.name.ka, page.name.en, page.topicName.ka, page.topicName.en, page.groupName.ka, page.groupName.en]) expect(name, page.href).toBeTruthy();
    }
  });

  it("joins the page's search words in both languages", () => {
    const supply = pages.find((page) => page.href === "/explorer/money/supply")!;
    expect(supply.words).toContain("m3");
    const schools = pages.find((page) => page.href === "/explorer/education/schools")!;
    expect(schools.words).toContain("მოსწავლეები");
    expect(schools.words).toContain("pupils");
  });

  it("carries each page's latest value and trend from its card", () => {
    const wages = pages.find((page) => page.href === "/explorer/wages/overview")!;
    expect(wages.value).toMatch(/\d/);
    expect(wages.period).toMatch(/^\d{4}$/);
    expect(wages.spark?.length).toBeGreaterThan(1);
  });

  it("gives every row the figure its card prints, with the card's caption and mark", async () => {
    const hubs = await loadTopicHubs(locale, TOPICS);
    const { spreadOf } = await loadCardSpreads(hubs.flatMap((hub) => hub.cards), locale);
    const rows = buildSearchPages(hubs, messagesKa, messagesEn, spreadOf);
    // Analysis is a page of analyses with no figure of its own; the Age bars print only their bands' names.
    expect(rows.filter((row) => !row.value).map((row) => row.href)).toEqual(["/explorer/analysis", "/explorer/unemployment/age"]);
    const row = (href: string) => rows.find((candidate) => candidate.href === href)!;
    // A pair prints its accent row: the higher rate, with whose it is.
    expect(row("/explorer/unemployment/gender")).toMatchObject({ value: "15.8%", caption: locale === "en" ? "Men" : "კაცები", period: "2025" });
    // A Regions card prints its spread over the regions, and says how many.
    expect(row("/explorer/wages/regions").caption).toBe(locale === "en" ? "11 regions" : "11 რეგიონი");
    expect(row("/explorer/wages/regions").value).toMatch(/–/);
    expect(row("/explorer/demography/age-sex").caption).toBe(locale === "en" ? "Population aged 65+" : "65+ წლის მოსახლეობა");
    expect(row("/explorer/economy/sectors").status).toBe("preliminary");
  });

  it("puts the topic in front of a vague page name", () => {
    const regions = pages.find((page) => page.href === "/explorer/wages/regions")!;
    expect(rowLabel(regions, locale)).toBe(locale === "ka" ? "ხელფასები — რეგიონები" : "Wages — regions");
  });

  it("groups the pages by first letter, in alphabet order", () => {
    const groups = azGroups(pages, locale);
    const alphabet = locale === "ka" ? KA_ALPHABET : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (locale === "ka") expect(groups[0].letter).toBe("ა");
    const positions = groups.map((group) => alphabet.indexOf(group.letter));
    expect(positions.every((position) => position >= 0), groups.map((group) => group.letter).join("")).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(groups.flatMap((group) => group.rows)).toHaveLength(PAGE_COUNT);
    for (const group of groups) {
      const labels = group.rows.map((page) => rowLabel(page, locale));
      for (const label of labels) expect(locale === "ka" ? label[0] : label[0].toUpperCase()).toBe(group.letter);
      expect(labels).toEqual([...labels].sort((a, b) => (locale === "ka" ? (a < b ? -1 : a > b ? 1 : 0) : a.localeCompare(b, "en", { sensitivity: "base" }))));
    }
    expect(new Set(groups.map((group) => group.id)).size).toBe(groups.length);
  });

  it("balances the letters over two columns to within one letter's weight", () => {
    const groups = azGroups(pages, locale);
    const [left, right] = azColumns(groups);
    expect([...left, ...right]).toEqual(groups);
    const weight = (column: AzGroup[]) => column.reduce((total, group) => total + group.rows.length + 1.4, 0);
    const heaviest = Math.max(...groups.map((group) => group.rows.length + 1.4));
    expect(Math.abs(weight(left) - weight(right))).toBeLessThanOrEqual(heaviest);
  });
});

describe("the shortcuts", () => {
  const shortcuts = buildShortcuts(messagesKa, messagesEn);

  it("offers every group, and the topics of the groups that hold more than one", () => {
    const multi = NAV_GROUPS.filter((group) => group.topics.length > 1);
    expect(shortcuts.filter((shortcut) => shortcut.kind === "group")).toHaveLength(8);
    expect(shortcuts.filter((shortcut) => shortcut.kind === "topic")).toHaveLength(multi.reduce((total, group) => total + group.topics.length, 0));
    expect(shortcuts.find((shortcut) => shortcut.kind === "topic" && shortcut.name.en === "Wages")).toMatchObject({ href: "/explorer/labour#t-wages", group: "labour", count: 3 });
    expect(shortcuts.find((shortcut) => shortcut.kind === "group" && shortcut.group === "society")).toMatchObject({ href: "/explorer/society", count: 34 });
    expect(shortcuts.some((shortcut) => shortcut.kind === "topic" && shortcut.name.en === "Budget")).toBe(false);
  });
});
