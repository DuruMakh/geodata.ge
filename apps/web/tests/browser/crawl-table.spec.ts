import { expect, test, type Page } from "@playwright/test";
import { TEST_BASE_URL } from "./test-base-url";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

// Chart pages carry every series of every view as hidden crawl tables (DESIGN.md §8.4), so crawlers read the numbers.
// A page may hold several wrappers: a population place page has up to four, one per section.
const PAGES = [
  { path: "/explorer/expenditure", figure: "30,881.4" },
  { path: "/en/explorer/unemployment/regions/samegrelo_zemo_svaneti", figure: "118.9" },
  { path: "/en/explorer/trade/partners", figure: null },
  { path: "/explorer/demography/population/khashuri", figure: null },
] as const;

for (const { path, figure } of PAGES) {
  test(`${path}: the raw HTML carries hidden crawl tables`, async ({ request }) => {
    const response = await request.get(`${TEST_BASE_URL}${path}`);
    expect(response.ok()).toBe(true);
    // Scripts are stripped so a figure found only in the data payload does not count.
    const serverHtml = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
    const wrapper = '<div hidden="" data-testid="crawl-tables">';
    const start = serverHtml.indexOf(wrapper);
    expect(start, "the crawl tables are in the prerendered HTML, inside a hidden wrapper").toBeGreaterThan(-1);
    const crawl = serverHtml.slice(start, serverHtml.indexOf("</div>", start));
    expect(crawl).toContain("<table>");
    expect(crawl, "the crawl tables hold formatted figures").toMatch(/<td>−?\d[\d,.]*/);
    if (figure) expect(crawl).toContain(figure);
  });

  test(`${path}: hydration keeps the server's hidden crawl tables and chart mode shows no table`, async ({ page, request }) => {
    // The browser never builds the crawl tables (DESIGN.md §8.4): each wrapper keeps the tables the server wrote, with no hydration error.
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => { if (entry.type() === "error") errors.push(entry.text()); });
    const serverHtml = (await (await request.get(`${TEST_BASE_URL}${path}`)).text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
    const serverTables = serverHtml.split('<div hidden="" data-testid="crawl-tables">').slice(1).map((rest) => rest.slice(0, rest.indexOf("</div>")).split("<table>").length - 1);
    await page.goto(path);
    await ready(page);
    const wrappers = page.getByTestId("crawl-tables");
    expect(await wrappers.count()).toBeGreaterThanOrEqual(1);
    for (const wrapper of await wrappers.all()) {
      await expect(wrapper).toBeHidden();
      expect(await wrapper.locator("table").count(), "each wrapper still holds the server's tables after hydration").toBeGreaterThanOrEqual(1);
    }
    expect(await wrappers.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll("table").length))).toEqual(serverTables);
    await expect(page.getByTestId("explorer-table")).toHaveCount(0);
    // The page's own visible tables (period comparison, partners ranking) are not the yearly table; nothing else shows one.
    const ownTables = '[data-testid="period-comparison"] table, [data-testid="trade-partners-ranking"] table';
    expect(await page.locator("table").evaluateAll((tables, own) => tables.filter((table) => table.checkVisibility() && !table.matches(own)).length, ownTables)).toBe(0);
    expect(errors, "no page or hydration errors").toEqual([]);
  });
}
