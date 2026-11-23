import { expect, test, type Page } from "@playwright/test";
import { axeViolations } from "./axe";
import { TEST_BASE_URL } from "./test-base-url";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

// Chart pages carry every series of every view as a "Data table" block (DESIGN.md §8.4): in the page's HTML and in its
// accessibility tree, so an AI reader and a screen reader find the numbers on the page, and off screen, so the page a visitor
// sees is the one without it. A page may hold several blocks: a population place page has up to four, one per section.
// The wrapper carries its class and nothing else: styling alone keeps it off screen, and a reader of the HTML cannot tell.
const WRAPPER = '<div data-testid="crawl-tables" class="crawl-tables">';
/** The blocks the server wrote. A block holds one div, its region, so it ends at the first `</div></div>`. Scripts are
 * stripped so a figure found only in the data payload does not count. */
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
  test(`${path}: the raw HTML carries the data tables, and nothing in it hides them`, async ({ request }) => {
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

  test(`${path}: hydration keeps the server's data tables, off screen, beside no other yearly table`, async ({ page, request }) => {
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
      // Styling alone keeps a block off screen: a clipped 1px box, out of the page's flow, its tables laid out.
      expect(await wrapper.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return [box.width, box.height, style.position, style.overflow, style.clipPath, style.contentVisibility];
      })).toEqual([1, 1, "absolute", "hidden", "inset(50%)", "visible"]);
      // It stays in the accessibility tree: each block's region is named after its first table, so two blocks on a page do
      // not share a name.
      await expect(wrapper.getByRole("region")).toHaveAccessibleName(/\S: \S/);
    }
    expect(await wrappers.evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll("table").length))).toEqual(serverTables);
    // The tables are rendered and only clipped, so the browser's own text of the page holds them: `innerText` is what an
    // assistant built into a browser reads. It leaves out what `display: none` or a skipped `content-visibility` hides.
    const texts = await wrappers.evaluateAll((nodes) => nodes.map((node) => ({ text: (node as HTMLElement).innerText, caption: node.querySelector("caption")!.textContent })));
    for (const { text, caption } of texts) expect(text).toContain(caption);
    if (figure) expect(texts.map(({ text }) => text).join("\n")).toContain(figure);
    await expect(page.getByTestId("explorer-table")).toHaveCount(0);
    // Outside the block, chart mode shows only the page's own tables (period comparison, partners ranking), never the yearly one.
    const ownTables = '[data-testid="crawl-tables"] table, [data-testid="period-comparison"] table, [data-testid="trade-partners-ranking"] table';
    expect(await page.locator("table").evaluateAll((tables, own) => tables.filter((table) => table.checkVisibility() && !table.matches(own)).length, ownTables)).toBe(0);
    expect(errors, "no page or hydration errors").toEqual([]);
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
  test(`at ${viewport.width}px the data-table blocks take no room, are no keyboard stop and pass axe`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    const pageSize = () => page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    for (const path of ["/explorer/expenditure", "/en/explorer/trade/partners", "/explorer/demography/population/khashuri"]) {
      await page.goto(path);
      await ready(page);
      const blocks = page.getByTestId("crawl-tables");
      // A visitor who cannot see a block never lands in it: nothing inside takes the Tab key.
      expect(await blocks.evaluateAll((nodes) => nodes.flatMap((node) => [...node.querySelectorAll<HTMLElement>("*")]).filter((element) => element.tabIndex >= 0).length), path).toBe(0);
      // Trade partners folds the partners its first tables leave out: closed, so the browser never lays them out.
      if (path.endsWith("/trade/partners")) await expect(blocks.first().locator('details:not([open]) > summary[tabindex="-1"]')).toHaveCount(1);
      expect(await axeViolations(page), path).toEqual([]);

      // The page is laid out as if the blocks were not there, and never scrolls sideways.
      const withBlocks = await pageSize();
      expect(withBlocks[0], path).toBeLessThanOrEqual(viewport.width);
      await blocks.evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
      expect(await pageSize(), path).toEqual(withBlocks);
    }
  });
}

test.describe("on a touch device", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("the page's own text holds the tables, as on a computer", async ({ page }) => {
    // A phone or a tablet lays the tables out too (globals.css): an assistant built into its browser reads the same text
    // of the page. A block under `content-visibility: auto` would never be laid out, because a clipped box is never near.
    await page.goto("/explorer/expenditure");
    await ready(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    const block = page.getByTestId("crawl-tables");
    expect(await block.evaluate((node) => getComputedStyle(node).contentVisibility)).toBe("visible");
    expect(await block.evaluate((node) => (node as HTMLElement).innerText)).toContain("30,881.4");
    await expect(block.getByRole("region")).toHaveAccessibleName(/\S: \S/);
  });
});

test("a page opened by a link inside the site carries its own data table, the one the server writes for it", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (entry) => { if (entry.type() === "error") errors.push(entry.text()); });
  const block = page.getByTestId("crawl-tables");
  /** Whether the block in the page is, node for node, the one in the HTML the server sends for `path`. */
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
