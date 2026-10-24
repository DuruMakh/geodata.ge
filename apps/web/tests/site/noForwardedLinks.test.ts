import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pageHref } from "../../lib/i18n/routes";
import { LEGACY_TOPIC_FORWARDS, groupOfTopic, topicSection } from "../../lib/navigation/navTree";

// Ruling R8 (spec 2026-10-24-explorer-regroup §3.1): the old topic hub addresses only forward. No breadcrumb, structured
// data or link the pages and the landing build may point at one; they point at the topic's section on its group page.
const root = path.resolve(__dirname, "../..");
// The sidebar is replaced by the group navigation in a later task.
const SKIPPED = new Set(["components/shell/data-sidebar.tsx"]);

function sources(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(file);
    return /\.tsx?$/.test(entry.name) && !SKIPPED.has(file) ? [file] : [];
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
