import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { TOOLS } from "../../lib/mcp/tools";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { catalogueData } from "../../lib/factQuery/publications";

const llmsPath = fileURLToPath(new URL("../../public/llms.txt", import.meta.url));
// Pages are checked both ways against the sitemap in routes.test.ts ("links only to public sitemap pages",
// "names every hub, section and methodology route"). Published files are not pages, so their exact list stays here.
const requiredFileTargets = [
  "https://fiscal.ge/downloads/data/inflation-cpi-national.csv",
  "https://fiscal.ge/downloads/data/gdp-overview.json",
  "https://fiscal.ge/downloads/data/gdp-overview.csv",
  "https://fiscal.ge/downloads/data/economic-sectors.json",
  "https://fiscal.ge/downloads/data/economic-sectors.csv",
  "https://fiscal.ge/downloads/data/regional-economies.json",
  "https://fiscal.ge/downloads/data/regional-economies.csv",
  "https://fiscal.ge/downloads/data/inflation-national.json",
  "https://fiscal.ge/downloads/data/inflation-categories.csv",
  "https://fiscal.ge/downloads/data/inflation-categories.json",
  "https://fiscal.ge/downloads/data/inflation-cities.csv",
  "https://fiscal.ge/downloads/data/inflation-cities.json",
  "https://fiscal.ge/downloads/data/inflation-products.csv",
  "https://fiscal.ge/downloads/data/inflation-products.json",
  "https://fiscal.ge/downloads/data/manifest.json",
  "https://fiscal.ge/downloads/data/government-debt.json",
  "https://fiscal.ge/downloads/data/general-government-balance.json",
  "https://fiscal.ge/downloads/data/catalogue.json",
  "https://fiscal.ge/downloads/data/sources.json",
  "https://fiscal.ge/sitemap.xml",
] as const;

type CsvRow = Record<string, string>;
/**
 * Coverage years llms.txt states in prose, each checked against the reviewed CSV it describes: the line that
 * links `url` must contain the first and last year of the matching rows (Task 19 review follow-up, D283).
 */
const statedCoverage: { url: string; file: string; rows?: (row: CsvRow) => boolean; text?: (first: number, last: number) => string }[] = [
  { url: "/explorer/economy/regions", file: "regional-economies-annual.csv" },
  { url: "/explorer/money", file: "money-banks-annual.csv" },
  { url: "/explorer/unemployment", file: "unemployment-annual.csv" },
  { url: "/explorer/living-standards", file: "household-income-spending-annual.csv", text: (first) => `household income and spending from ${first}` },
  { url: "/explorer/living-standards", file: "poverty-annual.csv", rows: (row) => row.indicator_id.startsWith("poverty."), text: (first) => `poverty rates from ${first}` },
  { url: "/explorer/living-standards", file: "poverty-annual.csv", rows: (row) => row.indicator_id.startsWith("gini."), text: (first) => `inequality from ${first}` },
  { url: "/explorer/living-standards/poverty", file: "poverty-annual.csv", rows: (row) => /^poverty\.(absolute|relative_)/.test(row.indicator_id) },
  { url: "/explorer/living-standards/poverty", file: "poverty-annual.csv", rows: (row) => row.indicator_id.startsWith("poverty.international_") },
  { url: "/explorer/living-standards/inequality", file: "poverty-annual.csv", rows: (row) => row.indicator_id.startsWith("gini.") },
  { url: "/explorer/trade/overview", file: "trade-overview-annual.csv" },
  { url: "/explorer/trade/partners", file: "trade-partners-annual.csv" },
  { url: "/explorer/trade/products", file: "trade-products-annual.csv", rows: (row) => row.source_block === "2020-2025" },
  { url: "/explorer/trade/domestic-exports", file: "trade-domestic-annual.csv" },
  { url: "/explorer/trade/services", file: "trade-services-annual.csv" },
  { url: "/explorer/external/money-from-abroad", file: "money-transfers-annual.csv" },
  ...(["country", "sector", "region"] as const).map((dimension) => ({ url: "/explorer/external/foreign-investment", file: "foreign-investment-annual.csv", rows: (row: CsvRow) => row.entity_id.startsWith(`fdi.${dimension}.`) })),
  { url: "/explorer/external/current-account", file: "current-account-annual.csv" },
  { url: "/explorer/energy-food", file: "energy-food-annual.csv", rows: (row) => !row.indicator_id.startsWith("food.") },
  { url: "/explorer/energy-food", file: "energy-food-annual.csv", rows: (row) => row.indicator_id.startsWith("food.") },
  { url: "/explorer/demography/migration", file: "demography-migration-annual.csv" },
];

describe("Fiscal.ge agent instructions", () => {
  it("states each dataset's coverage years as its reviewed CSV has them", async () => {
    const lines = (await readFile(llmsPath, "utf8")).split(/\r?\n/);
    const imports = fileURLToPath(new URL("../../../../data/imports/", import.meta.url));
    for (const { url, file, rows = () => true, text = (first: number, last: number) => `${first}–${last}` } of statedCoverage) {
      const line = lines.find((candidate) => candidate.includes(`](https://fiscal.ge${url})`));
      expect(line, url).toBeDefined();
      const years = (parse(await readFile(path.join(imports, file)), { columns: true, bom: true }) as CsvRow[]).filter(rows).map((row) => Number(row.year));
      expect(years.length, `${url} ${file}`).toBeGreaterThan(0);
      expect(line, `${url} ${file}`).toContain(text(Math.min(...years), Math.max(...years)));
    }
  });
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
    const advertised = content.match(/Its current read-only tools are ([^;]+); tools\/list is authoritative\./)?.[1].split(/,\s*/);
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
    expect(targets.filter((target) => /\.(json|csv|xml)$/.test(new URL(target).pathname))).toEqual(requiredFileTargets);
    expect(new Set(targets).size).toBe(targets.length);
  });
});
