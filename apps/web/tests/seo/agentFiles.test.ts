import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { TOOLS } from "../../lib/mcp/tools";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { catalogueData } from "../../lib/factQuery/publications";
import { schoolYearLabel } from "../../lib/explorer/education";

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

/** The per-measure first years on the Money sub-page lines ("bank loans from 2002", ...). */
function moneyFirstYears() {
  const indicator = (pattern: RegExp) => (row: CsvRow) => pattern.test(row.indicator_id);
  const from = (prefix: string, suffix = "") => (first: number) => `${prefix} from ${first}${suffix}`;
  const money = (url: string, pattern: RegExp, text: (first: number) => string, alsoIn?: string) =>
    ({ url: `/explorer/money/${url}`, file: "money-banks-annual.csv", rows: indicator(pattern), text, alsoIn });
  const supply = /^money\.m[0-3]$/;
  return [
    money("supply", supply, from("in million GEL")),
    // The page divides each December amount by national GDP, so a share needs both years.
    money("supply", supply, from("all four as a share of GDP"), "national-gdp-annual-1996-2025.csv"),
    money("loans-deposits", /^loans\.(total|gel|fx)$/, from("bank loans")),
    money("loans-deposits", /^deposits\.(total|gel|fx)$/, from("and deposits", ",")),
    money("loans-deposits", /^deposits\.individuals$/, from("deposits of people")),
    money("loans-deposits", /^deposits\.legal_entities$/, from("of companies and organisations")),
    money("interest-rates", /^rates\.policy$/, from("policy rate")),
    money("interest-rates", /^rates\.(loans|deposits)_/, from("on loans and on deposits")),
    money("bank-health", /^banks\.npl_ratio$/, from("bad loans as a share of all loans")),
    money("bank-health", /^banks\.ro[ae]$/, from("return on assets and on equity")),
    money("bank-health", /^banks\.(capital|tier1)_ratio$/, from("the two capital ratios")),
  ];
}
/** The Education lines: school years read `2025/26` (stored as 2025), vocational calendar years plain; never the old vocational fields. */
function educationCoverage() {
  const shown = (pattern: RegExp) => (row: CsvRow) => row.shown === "true" && pattern.test(row.indicator_id);
  const schoolYears = (first: number, last: number) => `${schoolYearLabel(first)}–${schoolYearLabel(last)}`;
  const education = (url: string, pattern: RegExp, text: (first: number, last: number) => string = schoolYears) =>
    ({ url: `/explorer/education${url}`, file: "education-annual.csv", rows: shown(pattern), text });
  return [
    education("", /^education\.(schools|pupils_national|pupils|teachers)\./, (first, last) => `schools (${schoolYears(first, last)})`),
    education("", /^education\.(kindergartens|kg_children|kg_staff)\./, (first, last) => `kindergartens (${schoolYears(first, last)})`),
    education("", /^education\.he_/, (first, last) => `universities (${schoolYears(first, last)})`),
    education("", /^education\.vet_/, (first, last) => `vocational colleges (${first}–${last})`),
    education("/schools", /^education\.(schools|pupils_national)\./, (first) => `Georgia from ${schoolYearLabel(first)}`),
    education("/kindergartens", /^education\.(kindergartens|kg_children|kg_staff)\./),
    education("/universities", /^education\.he_(students|admitted)\./),
    education("/universities", /^education\.he_graduates\./),
    education("/vocational", /^education\.vet_/, (first, last) => `${first}–${last}`),
  ];
}
/**
 * Coverage years llms.txt states in prose, each checked against the reviewed CSV it describes: the line that
 * links `url` must contain the first and last year of the matching rows (Task 19 review follow-up, D283).
 * `alsoIn` keeps only the years another CSV has too, for a value the page derives from both.
 */
const statedCoverage: { url: string; file: string; rows?: (row: CsvRow) => boolean; alsoIn?: string; text?: (first: number, last: number) => string }[] = [
  { url: "/explorer/economy/regions", file: "regional-economies-annual.csv" },
  { url: "/explorer/money", file: "money-banks-annual.csv" },
  { url: "/explorer/business", file: "business-annual.csv" },
  { url: "/explorer/business/firms", file: "business-annual.csv", rows: (row) => /^business\.(active|births|deaths|birth_rate|death_rate)\./.test(row.indicator_id) },
  { url: "/explorer/housing", file: "housing-annual.csv", rows: (row) => /^housing\.(permits|completed)_/.test(row.indicator_id), text: (first, last) => `completed buildings, ${first}–${last}` },
  { url: "/explorer/housing/permits", file: "housing-annual.csv", rows: (row) => row.indicator_id.startsWith("housing.permits_") },
  { url: "/explorer/housing/completed", file: "housing-annual.csv", rows: (row) => row.indicator_id.startsWith("housing.completed_") },
  { url: "/explorer/housing/prices", file: "housing-annual.csv", rows: (row) => row.indicator_id.startsWith("housing.price_index."), text: (first, last) => `flats and houses, ${first}–${last}` },
  { url: "/explorer/housing/prices", file: "housing-annual.csv", rows: (row) => /^housing\.price_(flat|house)\./.test(row.indicator_id), text: (first, last) => `ten districts, ${first}–${last}` },
  { url: "/explorer/housing/regions", file: "housing-annual.csv", rows: (row) => /\.region_/.test(row.indicator_id) },
  ...moneyFirstYears(),
  { url: "/explorer/unemployment", file: "unemployment-annual.csv" },
  { url: "/explorer/unemployment/industries", file: "labour-annual.csv", rows: (row) => row.indicator_id.startsWith("labour.jobs.") },
  { url: "/explorer/unemployment/industries", file: "labour-annual.csv", rows: (row) => /^labour\.jobs\.(women|men)\./.test(row.indicator_id), text: (first) => `from ${first}` },
  { url: "/explorer/unemployment/hours", file: "labour-annual.csv", rows: (row) => row.indicator_id.startsWith("labour.hours.") },
  { url: "/explorer/unemployment/informal", file: "labour-annual.csv", rows: (row) => row.indicator_id.startsWith("labour.informal.") },
  { url: "/explorer/unemployment/young-people", file: "labour-annual.csv", rows: (row) => row.indicator_id.startsWith("labour.neet.") },
  { url: "/explorer/living-standards", file: "household-income-spending-annual.csv", text: (first) => `household income and spending from ${first}` },
  { url: "/explorer/living-standards", file: "poverty-annual.csv", rows: (row) => row.indicator_id.startsWith("poverty."), text: (first) => `poverty rates from ${first}` },
  { url: "/explorer/living-standards", file: "poverty-annual.csv", rows: (row) => row.indicator_id.startsWith("gini."), text: (first) => `inequality from ${first}` },
  { url: "/explorer/living-standards/poverty", file: "poverty-annual.csv", rows: (row) => /^poverty\.(absolute|relative_)/.test(row.indicator_id) },
  { url: "/explorer/living-standards/poverty", file: "poverty-annual.csv", rows: (row) => row.indicator_id.startsWith("poverty.international_") },
  { url: "/explorer/living-standards/inequality", file: "poverty-annual.csv", rows: (row) => row.indicator_id.startsWith("gini.") },
  { url: "/explorer/health", file: "health-annual.csv", rows: (row) => !/^health\.death/.test(row.indicator_id), text: (first, last) => `healthcare statistics, ${first}–${last}` },
  { url: "/explorer/health", file: "health-annual.csv", rows: (row) => row.indicator_id.startsWith("health.deaths."), text: (first, last) => `by cause for Georgia and its 11 regions, ${first}–${last}` },
  { url: "/explorer/health/doctors-hospitals", file: "health-annual.csv", rows: (row) => /^health\.(staff|facilities|visits)\./.test(row.indicator_id) },
  { url: "/explorer/health/illnesses", file: "health-annual.csv", rows: (row) => row.indicator_id.startsWith("health.illness.") },
  { url: "/explorer/health/illnesses", file: "health-annual.csv", rows: (row) => /^health\.illness\.(diabetes|anaemia)$/.test(row.indicator_id), text: (first) => `diabetes and anaemia from ${first}` },
  { url: "/explorer/health/causes-of-death", file: "health-annual.csv", rows: (row) => /^health\.death/.test(row.indicator_id) },
  { url: "/explorer/crime", file: "crime-annual.csv" },
  { url: "/explorer/crime/recorded", file: "crime-annual.csv", rows: (row) => row.indicator_id.startsWith("crime.recorded.") },
  { url: "/explorer/crime/convictions", file: "crime-annual.csv", rows: (row) => row.indicator_id.startsWith("crime.convicted.") },
  { url: "/explorer/crime/prisons", file: "crime-annual.csv", rows: (row) => row.indicator_id.startsWith("crime.prison.") },
  { url: "/explorer/crime/prisons", file: "crime-annual.csv", rows: (row) => /^crime\.prison\.(sentenced|pretrial)$/.test(row.indicator_id), text: (first) => `awaiting trial from ${first}` },
  { url: "/explorer/crime/victims", file: "crime-annual.csv", rows: (row) => row.indicator_id.startsWith("crime.victims.") && Number(row.year) < 2012 },
  { url: "/explorer/crime/victims", file: "crime-annual.csv", rows: (row) => row.indicator_id.startsWith("crime.victims.") && Number(row.year) > 2014, text: (first, last) => `and ${first}–${last}` },
  { url: "/explorer/crime/road-accidents", file: "crime-annual.csv", rows: (row) => row.indicator_id.startsWith("crime.road.") },
  { url: "/explorer/internet", file: "internet-annual.csv" },
  { url: "/explorer/internet/homes", file: "internet-annual.csv", rows: (row) => row.indicator_id.startsWith("internet.homes_") },
  { url: "/explorer/internet/users", file: "internet-annual.csv", rows: (row) => /^internet\.(used_3m|never_used|daily)\./.test(row.indicator_id) },
  { url: "/explorer/internet/online", file: "internet-annual.csv", rows: (row) => /^internet\.(bought_online|activity_|egov_)/.test(row.indicator_id) },
  { url: "/explorer/internet/devices", file: "internet-annual.csv", rows: (row) => /^internet\.(own_mobile|own_smartphone|computer_3m)\./.test(row.indicator_id) },
  { url: "/explorer/internet/devices", file: "internet-annual.csv", rows: (row) => row.indicator_id.startsWith("internet.own_smartphone."), text: (first) => `smartphone (from ${first})` },
  ...educationCoverage(),
  { url: "/explorer/science-culture", file: "science-culture-annual.csv", rows: (row) => /^science_culture\.(researchers|rd_staff|institutions|rd_spending)\./.test(row.indicator_id), text: (first, last) => `research spending (${first}–${last})` },
  { url: "/explorer/science-culture", file: "science-culture-annual.csv", rows: (row) => /^science_culture\.(invention|utility)_/.test(row.indicator_id), text: (first, last) => `grants (${first}–${last})` },
  { url: "/explorer/science-culture", file: "science-culture-annual.csv", rows: (row) => /^science_culture\.museum/.test(row.indicator_id), text: (first, last) => `visitors (${first}–${last})` },
  { url: "/explorer/science-culture", file: "science-culture-annual.csv", rows: (row) => /^science_culture\.theatre/.test(row.indicator_id), text: (first, last) => `theatres (${first}–${last})` },
  { url: "/explorer/science-culture/research", file: "science-culture-annual.csv", rows: (row) => /^science_culture\.(researchers|rd_staff|institutions|rd_spending)\./.test(row.indicator_id) },
  { url: "/explorer/science-culture/patents", file: "science-culture-annual.csv", rows: (row) => /^science_culture\.(invention|utility)_/.test(row.indicator_id) },
  { url: "/explorer/science-culture/museums", file: "science-culture-annual.csv", rows: (row) => /^science_culture\.museum/.test(row.indicator_id) },
  { url: "/explorer/science-culture/museums", file: "science-culture-annual.csv", rows: (row) => row.indicator_id.startsWith("science_culture.museum_staff."), text: (first, last) => `staff (${first}–${last})` },
  { url: "/explorer/science-culture/theatres", file: "science-culture-annual.csv", rows: (row) => /^science_culture\.theatre/.test(row.indicator_id) },
  { url: "/explorer/science-culture/theatres", file: "science-culture-annual.csv", rows: (row) => row.indicator_id.startsWith("science_culture.theatre_events."), text: (first) => `events from ${first}` },
  { url: "/explorer/science-culture/theatres", file: "science-culture-annual.csv", rows: (row) => row.indicator_id.startsWith("science_culture.theatre_staff."), text: (first) => `staff from ${first}` },
  { url: "/explorer/trade/overview", file: "trade-overview-annual.csv" },
  { url: "/explorer/trade/partners", file: "trade-partners-annual.csv" },
  { url: "/explorer/trade/products", file: "trade-products-annual.csv", rows: (row) => row.source_block === "2020-2025" },
  { url: "/explorer/trade/domestic-exports", file: "trade-domestic-annual.csv" },
  { url: "/explorer/trade/services", file: "trade-services-annual.csv" },
  { url: "/explorer/external/money-from-abroad", file: "money-transfers-annual.csv" },
  ...(["country", "sector", "region"] as const).map((dimension) => ({ url: "/explorer/external/foreign-investment", file: "foreign-investment-annual.csv", rows: (row: CsvRow) => row.entity_id.startsWith(`fdi.${dimension}.`) })),
  { url: "/explorer/external/current-account", file: "current-account-annual.csv" },
  { url: "/explorer/external/foreign-debt", file: "external-position-annual.csv", rows: (row) => row.indicator_id.startsWith("ext_debt.") },
  { url: "/explorer/external/reserves", file: "external-position-annual.csv", rows: (row) => row.indicator_id.startsWith("reserves.") },
  { url: "/explorer/energy-food", file: "energy-food-annual.csv", rows: (row) => row.indicator_id.startsWith("energy.") || row.indicator_id.startsWith("electricity.") },
  { url: "/explorer/energy-food", file: "energy-food-annual.csv", rows: (row) => row.indicator_id.startsWith("food.") },
  { url: "/explorer/energy-food", file: "energy-food-annual.csv", rows: (row) => row.indicator_id.startsWith("farming.") },
  { url: "/explorer/energy-food/farming", file: "energy-food-annual.csv", rows: (row) => row.indicator_id.startsWith("farming.") },
  { url: "/explorer/demography/migration", file: "demography-migration-annual.csv" },
];

describe("Fiscal.ge agent instructions", () => {
  it("states each dataset's coverage years as its reviewed CSV has them", async () => {
    const lines = (await readFile(llmsPath, "utf8")).split(/\r?\n/);
    const imports = fileURLToPath(new URL("../../../../data/imports/", import.meta.url));
    const readYears = async (file: string, rows: (row: CsvRow) => boolean = () => true) =>
      (parse(await readFile(path.join(imports, file)), { columns: true, bom: true }) as CsvRow[]).filter(rows).map((row) => Number(row.year));
    for (const { url, file, rows, alsoIn, text = (first: number, last: number) => `${first}–${last}` } of statedCoverage) {
      const line = lines.find((candidate) => candidate.includes(`](https://fiscal.ge${url})`));
      expect(line, url).toBeDefined();
      const otherYears = alsoIn === undefined ? null : new Set(await readYears(alsoIn));
      const years = (await readYears(file, rows)).filter((year) => otherYears === null || otherYears.has(year));
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
