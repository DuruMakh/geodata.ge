import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../lib/seo/sitemap";
import { TOOLS } from "../../lib/mcp/tools";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { catalogueData } from "../../lib/factQuery/publications";

const llmsPath = fileURLToPath(new URL("../../public/llms.txt", import.meta.url));
const originalEnv = { ...process.env };
const requiredTargets = [
  "https://fiscal.ge/",
  "https://fiscal.ge/explorer",
  "https://fiscal.ge/explorer/expenditure",
  "https://fiscal.ge/explorer/revenue",
  "https://fiscal.ge/explorer/analysis",
  "https://fiscal.ge/explorer/municipalities",
  "https://fiscal.ge/explorer/debt",
  "https://fiscal.ge/explorer/deficit",
  "https://fiscal.ge/explorer/economy/gdp",
  "https://fiscal.ge/explorer/economy/sectors",
  "https://fiscal.ge/explorer/economy/regions",
  "https://fiscal.ge/explorer/inflation",
  "https://fiscal.ge/explorer/inflation/overview",
  "https://fiscal.ge/downloads/data/inflation-cpi-national.csv",
  "https://fiscal.ge/explorer/inflation/categories",
  "https://fiscal.ge/methodology",
  "https://fiscal.ge/methodology/expenditure",
  "https://fiscal.ge/methodology/revenue",
  "https://fiscal.ge/methodology/municipalities",
  "https://fiscal.ge/methodology/gdp",
  "https://fiscal.ge/methodology/economic-sectors",
  "https://fiscal.ge/methodology/regional-economies",
  "https://fiscal.ge/methodology/inflation",
  "https://fiscal.ge/downloads/data/gdp-overview.json",
  "https://fiscal.ge/downloads/data/gdp-overview.csv",
  "https://fiscal.ge/downloads/data/economic-sectors.json",
  "https://fiscal.ge/downloads/data/economic-sectors.csv",
  "https://fiscal.ge/downloads/data/regional-economies.json",
  "https://fiscal.ge/downloads/data/regional-economies.csv",
  "https://fiscal.ge/downloads/data/inflation-national.json",
  "https://fiscal.ge/downloads/data/inflation-categories.csv",
  "https://fiscal.ge/downloads/data/inflation-categories.json",
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
  it("keeps authored sector counts and measure years consistent with the generated catalogue", async () => {
    const content = await readFile(llmsPath, "utf8");
    const snapshot = loadPackagedSnapshot();
    const catalogue = catalogueData(snapshot, "economic-sectors");
    const count = content.match(/— (\d+) national economic activities plus a Total GDP reference\./);
    expect(count, "sector activity count and national-only scope must be stated").not.toBeNull();
    expect(Number(count![1])).toBe(snapshot.economicSectors.registry.filter(series => series.classificationCode !== null).length);
    expect(catalogue.series?.filter(series => series.level === "total").map(series => series.seriesId)).toEqual(["economy.gdp_total"]);
    expect(catalogue.series).toHaveLength(Number(count![1]) + 1);
    expect(catalogue.datasets[0].entityTypes).toEqual(["country"]);

    const ranges = content.match(/Nominal GEL and GDP shares cover (\d{4})–(\d{4}); real growth covers (\d{4})–(\d{4}), with (\d{4}) explicitly missing\./);
    expect(ranges, "each measure's annual coverage and missing growth year must be stated").not.toBeNull();
    const years = (first: string, last: string) => Array.from({ length: Number(last) - Number(first) + 1 }, (_, i) => Number(first) + i);
    const nominalYears = years(ranges![1], ranges![2]);
    const growthYears = years(ranges![3], ranges![4]);
    const missingGrowthYear = Number(ranges![5]);
    for (const series of catalogue.series!) {
      expect(series.yearsByMeasure?.amount_gel, series.seriesId).toEqual(nominalYears);
      expect(series.yearsByMeasure?.share_of_gdp_pct, series.seriesId).toEqual(nominalYears);
      expect(series.yearsByMeasure?.real_growth_pct, series.seriesId).toEqual(growthYears);
    }
    expect(nominalYears.filter(year => !growthYears.includes(year))).toEqual([missingGrowthYear]);
  });
  it("advertises every registered read-only tool", async () => {
    const content = await readFile(llmsPath, "utf8");
    const advertised = content.match(/It exposes these read-only tools: ([^.]+)\./)?.[1].match(/[a-z]+(?:_[a-z]+)*/g);
    expect(advertised?.sort()).toEqual(TOOLS.map(tool => tool.name).sort());
  });
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
