import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../lib/seo/sitemap";

const llmsPath = fileURLToPath(new URL("../../public/llms.txt", import.meta.url));
const originalEnv = { ...process.env };
const requiredTargets = [
  "https://fiscal.ge/",
  "https://fiscal.ge/explorer",
  "https://fiscal.ge/explorer/expenditure",
  "https://fiscal.ge/explorer/revenue",
  "https://fiscal.ge/explorer/analysis",
  "https://fiscal.ge/explorer/municipalities",
  "https://fiscal.ge/explorer/economy/gdp",
  "https://fiscal.ge/explorer/inflation",
  "https://fiscal.ge/explorer/inflation/overview",
  "https://fiscal.ge/downloads/data/inflation-cpi-national.csv",
  "https://fiscal.ge/methodology",
  "https://fiscal.ge/methodology/expenditure",
  "https://fiscal.ge/methodology/revenue",
  "https://fiscal.ge/methodology/municipalities",
  "https://fiscal.ge/methodology/gdp",
  "https://fiscal.ge/methodology/inflation",
  "https://fiscal.ge/downloads/data/gdp-overview.json",
  "https://fiscal.ge/downloads/data/gdp-overview.csv",
  "https://fiscal.ge/downloads/data/manifest.json",
  "https://fiscal.ge/downloads/data/government-debt.json",
  "https://fiscal.ge/downloads/data/general-government-balance.json",
  "https://fiscal.ge/downloads/data/catalogue.json",
  "https://fiscal.ge/downloads/data/sources.json",
  "https://fiscal.ge/connect",
  "https://fiscal.ge/en/connect",
  "https://fiscal.ge/en",
  "https://fiscal.ge/en/explorer",
  "https://fiscal.ge/en/methodology/expenditure",
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
    // The blanket "no public API" claim became FALSE when /mcp shipped: MCP is
    // a public programmatic interface and spec 2.2 requires it be described
    // honestly as one. What remains excluded must still be stated, or the
    // rewording would trade one false claim for a vaguer one.
    expect(content).not.toMatch(/no public API/i);
    expect(content).toMatch(/read-only MCP/i);
    expect(content).toMatch(/no REST query API/i);
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
    // Downloads are published files, not pages: they are deliberately absent
    // from the sitemap, which lists public HTML routes. Spec section 16 said
    // only requiredTargets needed updating here; it missed this filter, which
    // treated any non-sitemap link as an HTML page owing a sitemap entry.
    const htmlTargets = targets.filter((target) => !/\.(xml|json|csv)$/.test(new URL(target).pathname));
    const sitemapTargets = (await sitemap()).map((entry) => entry.url);

    expect(htmlTargets.every((target) => sitemapTargets.includes(target))).toBe(true);
    expect(targets.filter((target) => new URL(target).pathname === "/sitemap.xml")).toEqual([
      "https://fiscal.ge/sitemap.xml",
    ]);
  });
});
