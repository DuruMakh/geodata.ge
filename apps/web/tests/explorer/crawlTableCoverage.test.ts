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

  it("every exported crawl-state function is named in a crawlStates test (.ts or .tsx)", () => {
    const tests = (readdirSync(resolve(process.cwd(), "tests/explorer")) as string[]).filter((file) => /^crawlStates\.\w+\.test\.tsx?$/.test(file)).map((file) => read(`tests/explorer/${file}`));
    expect(tests.length).toBeGreaterThanOrEqual(6);
    const functions = sourceFiles("lib").flatMap((file) => [...read(file).matchAll(/export function (\w+CrawlStates)\b/g)].map((match) => match[1]!));
    expect(functions.length).toBeGreaterThanOrEqual(30);
    expect(functions.filter((name) => !(name in UNTESTED_CRAWL_STATES) && !tests.some((source) => new RegExp(`\\b${name}\\b`).test(source))), "These crawl-state functions have no test.").toEqual([]);
  });

  it("the exemption list names only files that still build a workbook and render no crawl tables", () => {
    for (const file of Object.keys(NO_CRAWL_TABLES)) {
      expect(BUILDER_CALL.test(read(file)) && !read(file).includes("<CrawlTables"), `${file} no longer qualifies for an exemption (${RULE})`).toBe(true);
    }
  });
});
