import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pageHref } from "../../lib/i18n/routes";
import { ALL_DATA_PATH, LEGACY_TOPIC_FORWARDS, groupOfTopic, navGroup, topicSection } from "../../lib/navigation/navTree";

// Ruling R8 (spec 2026-10-24-explorer-regroup §3.1): the old topic hub addresses only forward. No breadcrumb, structured
// data or link the pages and the landing build may point at one; they point at the topic's section on its group page.
const root = path.resolve(__dirname, "../..");

function sources(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(file);
    return /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

const files = ["lib/pages", "lib/landing", "components"].flatMap(sources).map((file) => ({ file, text: readFileSync(path.join(root, file), "utf8") }));
const forwarded = new Set(LEGACY_TOPIC_FORWARDS.map(({ from }) => from));
// The `*_HUB_PATH` constants whose address now forwards; they stay only as the base of their topic's page addresses.
const forwardedConstants = [...new Set(["lib", "lib/explorer", "lib/pages"].flatMap(sources).flatMap((file) =>
  [...readFileSync(path.join(root, file), "utf8").matchAll(/export const ([A-Z_]+_HUB_PATH) = "([^"]+)"/g)].filter((match) => forwarded.has(match[2])).map((match) => match[1])))];

describe("no internal link through an old topic hub forward", () => {
  it("finds the constants to look for", () => {
    expect(forwardedConstants).toEqual(expect.arrayContaining(["HEALTH_HUB_PATH", "EDUCATION_HUB_PATH", "LIVING_STANDARDS_HUB_PATH"]));
  });

  it.each([...forwarded])("no page, landing or component source links %s", (from) => {
    const literal = new RegExp(`["'\`]${from.replace(/[/-]/g, "\\$&")}["'\`?#]`);
    expect(files.filter(({ text }) => literal.test(text)).map(({ file }) => file)).toEqual([]);
  });

  it("no source hands a forwarded hub constant to a link, a crumb or structured data", () => {
    for (const name of forwardedConstants) {
      const used = new RegExp(`(pageHref\\(|href: |path: |hubPath: )${name}\\b`);
      expect(files.filter(({ text }) => used.test(text)).map(({ file }) => file), name).toEqual([]);
    }
  });
});

// Ruling R12: /explorer is All data now, so a link named Budget (`common.budget`) goes to the Budget group page.
describe("no Budget link to All data", () => {
  // One object literal, `{ label: message(messages, "common.budget"), href: … }` or the landing's `{ href: …, title: t("common.budget") }`.
  const budgetLinks = files.flatMap(({ file, text }) => [...text.matchAll(/\{[^{}]*common\.budget[^{}]*\}/g)].map((match) => ({ file, link: match[0] })));

  it("finds the Budget links of the budget pages, their explorers and the landing", () => {
    expect(budgetLinks.map(({ file }) => file)).toEqual(expect.arrayContaining([
      "lib/pages/expenditure.tsx", "lib/pages/municipal-region.tsx", "lib/landing/landingDatasets.ts", "components/debt/debt-explorer.tsx", "components/main-explorer/budget-explorer-frame.tsx",
    ]));
    expect(navGroup("budget").href).not.toBe(ALL_DATA_PATH);
  });

  it("points none of them at /explorer or BUDGET_HUB_PATH", () => {
    const toAllData = /["'`]\/explorer["'`]|\bBUDGET_HUB_PATH\b|\bALL_DATA_PATH\b/;
    expect(budgetLinks.filter(({ link }) => toAllData.test(link)).map(({ file }) => file)).toEqual([]);
  });
});

describe("topicSection", () => {
  it.each(LEGACY_TOPIC_FORWARDS.map(({ topic }) => topic))("sends %s to its section, and its structured data to the group page", (topic) => {
    const { href } = groupOfTopic(topic);
    expect(topicSection(topic)).toEqual({ href: `${href}#t-${topic}`, path: href });
    expect(forwarded.has(topicSection(topic).path)).toBe(false);
  });

  it("keeps the language prefix and the anchor", () => {
    expect(pageHref(topicSection("wages").href, "en")).toBe("/en/explorer/labour#t-wages");
    expect(pageHref(topicSection("health").path, "ka")).toBe("/explorer/living");
  });
});
