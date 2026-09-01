import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../app/sitemap";

const llmsPath = fileURLToPath(new URL("../../public/llms.txt", import.meta.url));
const originalEnv = { ...process.env };
const requiredTargets = [
  "https://fiscal.ge/",
  "https://fiscal.ge/explorer",
  "https://fiscal.ge/explorer/expenditure",
  "https://fiscal.ge/explorer/revenue",
  "https://fiscal.ge/explorer/analysis",
  "https://fiscal.ge/explorer/municipalities",
  "https://fiscal.ge/methodology",
  "https://fiscal.ge/methodology/expenditure",
  "https://fiscal.ge/methodology/revenue",
  "https://fiscal.ge/methodology/municipalities",
  "https://fiscal.ge/about",
  "https://fiscal.ge/sitemap.xml",
] as const;

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Fiscal.ge agent instructions", () => {
  it("publishes a concise guide with clear scope and unique public links", async () => {
    const content = await readFile(llmsPath, "utf8");

    expect(content).toMatch(/^# Fiscal\.ge\r?\n\r?\n> .+/);
    expect(content.match(/^# .+$/gm)).toEqual(["# Fiscal.ge"]);
    expect(content).toMatch(/\*\*When to use Fiscal\.ge:\*\* .+/);
    expect(content.indexOf("**When to use Fiscal.ge:**")).toBeLessThan(content.indexOf("## Core data"));
    expect(content).toContain("## Core data");
    expect(content).toContain("## Methodology and sources");
    expect(content).toContain("## Site navigation");
    expect(content).toMatch(/\[.+\]\(https:\/\/fiscal\.ge\/.+\)/);
    expect(content).toMatch(/annual/i);
    expect(content).toMatch(/no public API/i);
    expect(content).toMatch(/do not invent values/i);
    expect(content).toContain("[Mission — Fiscal.ge](https://fiscal.ge/about)");
    expect(content).not.toContain("[About Fiscal.ge](https://fiscal.ge/about)");

    const targets = [...content.matchAll(/\]\((https:\/\/fiscal\.ge\/[^)]*)\)/g)].map((match) => match[1]);
    expect(targets).toEqual(requiredTargets);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it("links only to public sitemap pages and the sitemap document", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
    const content = await readFile(llmsPath, "utf8");
    const targets = [...content.matchAll(/\]\((https:\/\/fiscal\.ge\/[^)]*)\)/g)].map((match) => match[1]!);
    const htmlTargets = targets.filter((target) => new URL(target).pathname !== "/sitemap.xml");
    const sitemapTargets = (await sitemap()).map((entry) => entry.url);

    expect(htmlTargets.every((target) => sitemapTargets.includes(target))).toBe(true);
    expect(targets.filter((target) => new URL(target).pathname === "/sitemap.xml")).toEqual([
      "https://fiscal.ge/sitemap.xml",
    ]);
  });
});
