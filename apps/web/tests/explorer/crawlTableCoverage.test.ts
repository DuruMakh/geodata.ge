import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Every chart page carries every series of every view as hidden crawl tables, built by the page's own Excel workbook
// builders, so crawlers and AI tools read the numbers (DESIGN.md §8.4 Table Mode).
const RULE = "Every file under components/ that calls a workbook builder (build…Workbook…Model) renders <CrawlTables models={…} /> and passes no crawlCopy prop; see DESIGN.md §8.4 Table Mode.";
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");
const sourceFiles = (dir: string) => (readdirSync(resolve(process.cwd(), dir), { recursive: true }) as string[])
  .map((file) => `${dir}/${file.replaceAll("\\", "/")}`)
  .filter((file) => /\.tsx?$/.test(file));
const BUILDER_CALL = /build\w*Workbook\w*Model\(/;
// Files that call a workbook builder but render no crawl tables of their own. Add a file here with a one-line reason, never silently.
const NO_CRAWL_TABLES: Record<string, string> = {
  "components/inflation/inflation-products.tsx": "data fetched after page load; never in prerendered HTML",
};
// Exported crawl-state helpers with no test of their own, each with a one-line reason.
const UNTESTED_CRAWL_STATES: Record<string, string> = {
  unitListCrawlStates: "shared helper; tested through the explorers' own crawl states that call it",
  historyCrawlTable: "a map index's every-year table builder, not a crawl state; tested in indexCrawlTables.test.ts",
};
// Components that carry the crawl tables of views their page opens only after a click, so the server never renders those explorers.
const INDEX_CARRIERS = ["components/unemployment/unemployment-regions-index.tsx"];

describe("crawl table coverage", () => {
  const workbookFiles = sourceFiles("components").filter((file) => file !== "components/explorer-shell/crawl-tables.tsx" && BUILDER_CALL.test(read(file)));
  const covered = workbookFiles.filter((file) => !(file in NO_CRAWL_TABLES));

  it("every file that builds a workbook model renders crawl tables", () => {
    expect(covered.length, `${RULE} Expected at least 47 workbook files.`).toBeGreaterThanOrEqual(47);
    expect(covered.filter((file) => !read(file).includes("<CrawlTables")), `${RULE} These files render no <CrawlTables.`).toEqual([]);
  });

  it("crawl models are built through useCrawlModels, never in a useMemo the browser would run", () => {
    // The browser never builds them: a crawl useMemo cost Trading partners over half a second of hydration (DESIGN.md §8.4).
    const crawlFiles = sourceFiles("components").filter((file) => file !== "components/explorer-shell/crawl-tables.tsx" && /<CrawlTables|export function use\w+CrawlModels\(/.test(read(file)));
    expect(crawlFiles.length).toBeGreaterThanOrEqual(47);
    expect(crawlFiles.filter((file) => /<CrawlTables/.test(read(file)) && !/\buse\w*CrawlModels\(/.test(read(file))), "These files render <CrawlTables without useCrawlModels.").toEqual([]);
    const hooks = crawlFiles.flatMap((file) => [...read(file).matchAll(/export function (use\w+CrawlModels)\([\s\S]*?\n}\n/g)].map((match) => ({ name: match[1]!, body: match[0] })));
    expect(hooks.length).toBeGreaterThanOrEqual(4);
    expect(hooks.filter((hook) => !hook.body.includes("useCrawlModels(") || hook.body.includes("useMemo(")).map((hook) => hook.name), "These crawl hooks do not build through useCrawlModels.").toEqual([]);
    expect(crawlFiles.filter((file) => /crawl\w*\s*=\s*useMemo\(/i.test(read(file))), "These files build crawl models in a useMemo.").toEqual([]);
  });

  it("no component passes the retired crawlCopy prop, and ExplorerTable no longer takes it", () => {
    expect(sourceFiles("components").filter((file) => read(file).includes("crawlCopy")), RULE).toEqual([]);
  });

  it("an index that opens a view only after a click carries that view's crawl tables", () => {
    for (const file of INDEX_CARRIERS) expect(read(file), `${file} must render <CrawlTables (${RULE})`).toContain("<CrawlTables");
  });

  it("every exported crawl-state helper is named in a crawlStates test (.ts or .tsx)", () => {
    const tests = (readdirSync(resolve(process.cwd(), "tests/explorer")) as string[]).filter((file) => /^crawlStates\.\w+\.test\.tsx?$/.test(file)).map((file) => read(`tests/explorer/${file}`));
    expect(tests.length).toBeGreaterThanOrEqual(6);
    // Functions and arrow constants alike, and the helpers named for what they return (censusCrawlSettlements,
    // populationPlaceCrawlQueries); crawlTables.ts holds the renderer, not crawl states.
    const functions = sourceFiles("lib").filter((file) => file !== "lib/explorer/crawlTables.ts")
      .flatMap((file) => [...read(file).matchAll(/export (?:function|const) (\w+Crawl[A-Z]\w*)\b/g)].map((match) => match[1]!));
    expect(functions.length).toBeGreaterThanOrEqual(50);
    expect(functions).toEqual(expect.arrayContaining(["businessCrawlStates", "censusCrawlSettlements", "populationPlaceCrawlQueries"]));
    expect(functions.filter((name) => !(name in UNTESTED_CRAWL_STATES) && !tests.some((source) => new RegExp(`\\b${name}\\b`).test(source))), "These crawl-state functions have no test.").toEqual([]);
  });

  it("every map index page writes its every-year tables (IndexCrawlTables or RegionIndex crawl)", () => {
    // DESIGN.md §8.4: map pages carry every year of their figures for every place they list.
    const files = [
      "lib/pages/education-places.tsx", "lib/pages/social-places.tsx",
      "lib/pages/demography-population.tsx", "lib/pages/demography-births-deaths.tsx", "lib/pages/demography-marriages-divorces.tsx",
      "lib/pages/municipal-index.tsx",
      "components/business/business-index.tsx", "components/regional-economies/regional-economies-index.tsx", "components/housing/housing-index.tsx",
      "components/money-banks/money-banks-index.tsx", "components/transport/transport-index.tsx", "components/wages/wages-regions-index.tsx",
      "components/internet/internet-index.tsx", "components/household/household-index.tsx", "components/science-culture/museums-index.tsx",
      "components/environment/environment-region-index.tsx", "components/health/health-deaths-index.tsx", "lib/pages/environment-air-quality.tsx",
    ];
    expect(files).toHaveLength(18);
    expect(files.filter((file) => !/<IndexCrawlTables|\bcrawl=\{/.test(read(file))), "These map index files write no every-year tables.").toEqual([]);
  });

  it("the exemption list names only files that still build a workbook and render no crawl tables", () => {
    for (const file of Object.keys(NO_CRAWL_TABLES)) {
      expect(BUILDER_CALL.test(read(file)) && !read(file).includes("<CrawlTables"), `${file} no longer qualifies for an exemption (${RULE})`).toBe(true);
    }
  });
});
