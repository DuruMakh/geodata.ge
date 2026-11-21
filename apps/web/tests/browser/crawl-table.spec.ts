import { expect, test, type Page } from "@playwright/test";
import { axeViolations } from "./axe";
import { TEST_BASE_URL } from "./test-base-url";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

// Chart pages carry every series of every view as a "Data table" block in plain view under the chart (DESIGN.md §8.4), so a
// person and an AI reader both find the numbers on the page. A page may hold several blocks: a population place page has up
// to four, one per section.
const WRAPPER = '<div data-testid="crawl-tables" class="crawl-tables">';
/** The blocks the server wrote. A block holds one div, its scrolling region, so it ends at the first `</div></div>`. Scripts
 * are stripped so a figure found only in the data payload does not count. */
const serverBlocks = (html: string) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").split(WRAPPER).slice(1).map((rest) => rest.slice(0, rest.indexOf("</div></div>")));

const PAGES = [
  { path: "/explorer/expenditure", figure: "30,881.4" },
  { path: "/en/explorer/unemployment/regions/samegrelo_zemo_svaneti", figure: "118.9" },
  { path: "/en/explorer/trade/partners", figure: null },
  { path: "/explorer/demography/population/khashuri", figure: null },
  // Map index pages carry every year for every place they list: Khulo's 2015/16 pupils on Schools; the region maps build theirs
  // in RegionIndex, a client component.
  { path: "/explorer/education/schools", figure: "3,936" },
  { path: "/en/explorer/education/schools", figure: "3,936" },
  { path: "/en/explorer/business/regions", figure: null },
] as const;

for (const { path, figure } of PAGES) {
  test(`${path}: the raw HTML carries the data tables in plain view`, async ({ request }) => {
    const response = await request.get(`${TEST_BASE_URL}${path}`);
    expect(response.ok()).toBe(true);
    const html = await response.text();
    // Readers such as Claude's web fetch drop every element that carries the hidden attribute.
    expect(html, "no block is written hidden").not.toMatch(/<div hidden=""[^>]*data-testid="crawl-tables"/);
    const blocks = serverBlocks(html);
    expect(blocks.length, "the data tables are in the prerendered HTML").toBeGreaterThanOrEqual(1);
    const crawl = blocks.join("");
    expect(crawl).toContain("<table>");
    expect(crawl, "the data tables hold formatted figures").toMatch(/<td>−?\d[\d,.]*/);
    if (figure) expect(crawl).toContain(figure);
  });

  test(`${path}: hydration keeps the server's data tables, in view, beside no other yearly table`, async ({ page, request }) => {
    // Hydration never rebuilds the tables (DESIGN.md §8.4): each block keeps what the server wrote, with no hydration error.
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (entry) => { if (entry.type() === "error") errors.push(entry.text()); });
    const serverTables = serverBlocks(await (await request.get(`${TEST_BASE_URL}${path}`)).text()).map((block) => block.split("<table>").length - 1);
    await page.goto(path);
    await ready(page);
    const wrappers = page.getByTestId("crawl-tables");
    expect(await wrappers.count()).toBeGreaterThanOrEqual(1);
    for (const wrapper of await wrappers.all()) {
      await expect(wrapper).toBeVisible();
      await expect(wrapper.locator("table").first()).toBeVisible();
      // Each block's scrolling region is named after its first table, so two blocks on a page do not share a name.
      await expect(wrapper.getByRole("region")).toHaveAccessibleName(/\S: \S/);
    }
    expect(await wrappers.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll("table").length))).toEqual(serverTables);
    await expect(page.getByTestId("explorer-table")).toHaveCount(0);
    // Outside the block, chart mode shows only the page's own tables (period comparison, partners ranking), never the yearly one.
    const ownTables = '[data-testid="crawl-tables"] table, [data-testid="period-comparison"] table, [data-testid="trade-partners-ranking"] table';
    expect(await page.locator("table").evaluateAll((tables, own) => tables.filter((table) => table.checkVisibility() && !table.matches(own)).length, ownTables)).toBe(0);
    expect(errors, "no page or hydration errors").toEqual([]);
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
  test(`at ${viewport.width}px the data-table block scrolls inside itself, is a keyboard stop and passes axe`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    const pageFits = () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const path of ["/explorer/expenditure", "/en/explorer/trade/partners"]) {
      await page.goto(path);
      await ready(page);
      const block = page.getByTestId("crawl-tables").first();
      const region = block.getByRole("region");
      await region.scrollIntoViewIfNeeded();
      // The wide, long tables scroll inside the region; the page itself never scrolls sideways.
      expect(await region.evaluate((node) => node.scrollWidth > node.clientWidth && node.scrollHeight > node.clientHeight), path).toBe(true);
      await pageFits();

      // Reached by keyboard, it shows the focus ring, and the keys then scroll it.
      await region.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(region).toBeFocused();
      await expect(region).toHaveCSS("outline-style", "solid");
      await page.keyboard.press("End");
      await expect.poll(() => region.evaluate((node) => node.scrollTop), path).toBeGreaterThan(0);

      expect(await axeViolations(page), path).toEqual([]);
    }

    // Trade partners folds the partners its first tables leave out below them; opening the fold keeps the page's width.
    const rest = page.getByTestId("crawl-tables").first().locator("details");
    await expect(rest).toHaveCount(1);
    await expect(rest.locator("table").first()).toBeHidden();
    await rest.locator("summary").click();
    await expect(rest.locator("table").first()).toBeVisible();
    await pageFits();
  });
}

test("a page opened by a link inside the site shows its own data table, the one the server writes for it", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (entry) => { if (entry.type() === "error") errors.push(entry.text()); });
  const block = page.getByTestId("crawl-tables");
  /** Whether the block on screen is, node for node, the one in the HTML the server sends for `path`. */
  const matchesServer = async (path: string) => block.evaluate(
    (node, html) => node.innerHTML === new DOMParser().parseFromString(html, "text/html").querySelector('[data-testid="crawl-tables"]')!.innerHTML,
    await (await request.get(`${TEST_BASE_URL}${path}`)).text(),
  );
  await page.goto("/en/explorer/wages/regions/imereti");
  await ready(page);
  await expect(block.locator("caption").first()).toContainText("Wages — Imereti");
  // The marker lives only as long as the document: it proves the pages below were mounted in the browser, not loaded.
  await page.evaluate(() => { (window as unknown as { sameDocument?: true }).sameDocument = true; });

  await page.getByTestId("wages-region-navigation").getByRole("link", { name: /Kakheti/ }).click();
  await expect(page).toHaveURL(/\/wages\/regions\/kakheti$/);
  await expect(block.locator("caption").first()).toContainText("Wages — Kakheti");
  await expect(block).toHaveCount(1);
  await expect(block).not.toContainText("Imereti");
  expect(await matchesServer("/en/explorer/wages/regions/kakheti"), "the browser builds the block the server writes").toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/\/wages\/regions\/imereti$/);
  await expect(block.locator("caption").first()).toContainText("Wages — Imereti");
  await expect(block).not.toContainText("Kakheti");
  expect(await matchesServer("/en/explorer/wages/regions/imereti"), "and again on the way back").toBe(true);

  expect(await page.evaluate(() => (window as unknown as { sameDocument?: true }).sameDocument)).toBe(true);
  expect(errors, "no page errors").toEqual([]);
});
