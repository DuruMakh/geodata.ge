import { expect, test, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const CATEGORIES = "/explorer/inflation/categories";

for (const locale of ["ka", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`inflation categories layout ${locale} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${locale === "en" ? "/en" : ""}${CATEGORIES}`);
      await ready(page);
      await expect(page.getByTestId("inflation-category-tabs").getByRole("button")).toHaveCount(3);
      // The stack must close on the published headline, so both are drawn.
      await expect(page.locator('rect[data-segment="cpi.cat.residual"]').first()).toBeAttached();
      await expect(page.locator("path[data-overlay]")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      await page.getByTestId("chart-mode-table").click();
      await expect(page.getByTestId("month-grid")).toBeVisible();
      // The grid legend is the one string no other gate sees: it exists only after
      // this click, so a hardcoded Georgian unit would ship on the English page.
      const legend = (await page.getByTestId("month-grid").innerText()).normalize();
      expect(/[Ⴀ-ჿ]/.test(legend)).toBe(locale === "ka");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test("lands on the contribution tab and swaps the stack for lines on a rate tab", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  await expect(page.getByTestId("inflation-category-tab-contrib")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("inflation-category-unit")).toContainText("Percentage points");
  await expect(page.getByTestId("inflation-category-headline")).toHaveCount(0);
  await expect(page.locator("path[data-overlay]")).toHaveCount(1);

  await page.getByTestId("inflation-category-tab-yoy").click();
  await expect(page.getByTestId("inflation-category-unit")).toContainText("Percent");
  await expect(page.locator("path[data-overlay]")).toHaveCount(0);
  await expect(page.locator("rect[data-segment]")).toHaveCount(0);

  await page.getByTestId("inflation-category-tab-contrib").click();
  await expect(page.locator('rect[data-segment="cpi.cat.residual"]').first()).toBeAttached();
});

// U13-01: the header coverage followed the monthly tab on every tab, so the
// default contribution view claimed nine more years than it draws (DESIGN §25).
test("the categories header states the active tab's months", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  const coverage = page.getByTestId("explorer-header").locator("p");
  const strip = page.getByTestId("year-range-strip");
  for (const tab of ["contrib", "mom"] as const) {
    await page.getByTestId(`inflation-category-tab-${tab}`).click();
    await page.getByRole("button", { name: "All", exact: true }).click();
    const [start, end] = (await coverage.textContent())!.split(" · ")[0]!.split("–");
    await expect(strip).toContainText(start!);
    await expect(strip).toContainText(end!);
  }
  await expect(coverage).toContainText("Jan 2004");
  await page.getByTestId("inflation-category-tab-contrib").click();
  await expect(coverage).not.toContainText("Jan 2004");
});

// Clearing used to be a one-way door: with 55 rows and the bulk button hidden
// while nothing is selected, the only way back was ticking twelve boxes.
test("clearing the selection can be undone from the same control", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  const bulk = page.getByTestId("series-toggle-all");
  await expect(bulk).toHaveAttribute("data-state", "true");

  await bulk.click();
  await expect(page.locator("rect[data-segment]")).toHaveCount(0);
  await expect(bulk).toBeVisible();
  await expect(bulk).toHaveAttribute("data-state", "false");

  await bulk.click();
  // Back to the documented default: the 12 divisions, no subgroups.
  await expect(bulk).toHaveAttribute("data-state", "true");
  await expect(page.locator('rect[data-segment="cpi.cat.residual"]').first()).toBeAttached();
});

test("the residual grows when a division is deselected", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  const residualHeight = async () =>
    Number(await page.locator('rect[data-segment="cpi.cat.residual"]').last().getAttribute("height"));
  const before = await residualHeight();
  await page.locator('[data-series-id="cpi.cat.01"] [data-testid="series-row-toggle"]').click();
  await expect(page).toHaveURL(/sel=/);
  // Dropping the largest division moves its contribution into the residual.
  expect(await residualHeight()).toBeGreaterThan(before);
  await expect(page.locator('rect[data-segment="cpi.cat.01"]')).toHaveCount(0);
});

test("a division expands to its subgroups and counts them separately", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  await expect(page.locator('[data-series-id="cpi.cat.01_1"]')).toHaveCount(0);
  await page.locator('[data-series-id="cpi.cat.01"] button[aria-expanded]').click();
  await expect(page.locator('[data-series-id="cpi.cat.01_1"]')).toHaveCount(1);
  await expect(page.getByTestId("series-status")).toContainText("Subgroups");

  await page.locator('[data-series-id="cpi.cat.01_1"] [data-testid="series-row-toggle"]').click();
  await expect(page.getByTestId("series-status")).toContainText("Subgroups 1");
});

test("every selector row carries its basket share", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  await expect(page.locator('[data-series-id="cpi.cat.01"]')).toContainText("%");
});

test("the hash survives a reload and a language switch keeps tab and selection", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  await page.getByTestId("inflation-category-tab-mom").click();
  await page.locator('[data-series-id="cpi.cat.01"] [data-testid="series-row-toggle"]').click();
  const hash = new URL(page.url()).hash;
  expect(hash).toContain("i=mom");

  await page.reload();
  await ready(page);
  await expect(page.getByTestId("inflation-category-tab-mom")).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).hash).toBe(hash);

  await page.goto(`${CATEGORIES}${hash}`);
  await ready(page);
  await expect(page.getByTestId("inflation-category-tab-mom")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-series-id="cpi.cat.01"] [data-testid="series-row-toggle"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("the download button is present and enabled", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  await expect(page.getByTestId("inflation-category-download")).toBeEnabled();
});

test("the hub card and the sidebar both reach the page", async ({ page }) => {
  await page.goto("/en/explorer/inflation");
  await page.getByRole("link", { name: "Categories", exact: true }).first().click();
  await ready(page);
  await expect(page).toHaveURL(new RegExp(`${CATEGORIES}$|${CATEGORIES}#`));

  await expect(page.getByTestId("inflation-categories-link")).toHaveAttribute("aria-current", "page");
  await page.getByTestId("inflation-overview-link").click();
  await ready(page);
  await expect(page).toHaveURL(/\/explorer\/inflation\/overview/);
});

test("the contribution chart fits phones, hovers without moving the page and answers the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  const frame = page.getByTestId("stack-chart-frame");
  // D1 (2026-10-07): phones draw the columns at the frame's width instead of scrolling.
  expect(await frame.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(frame.locator("svg")).toHaveAttribute("data-geometry", "mobile");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  const svg = frame.locator("svg");
  await expect(svg).toHaveAttribute("data-geometry", "desktop");
  const box = (await svg.boundingBox())!;
  const strip = page.getByTestId("year-range-strip");
  const before = (await strip.boundingBox())!.y;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.getByTestId("stack-chart-tooltip")).toBeVisible();
  await page.mouse.move(box.x + box.width * 0.5 + 3, box.y + box.height * 0.5);
  await expect(page.getByTestId("stack-chart-tooltip")).toBeVisible();
  expect((await strip.boundingBox())!.y).toBe(before);

  const lattice = await page.evaluate(() => {
    const circle = document.querySelector("#stack-dot-lattice circle");
    const rect = document.querySelector('[data-testid="stack-dot-lattice"]');
    return { fill: circle ? getComputedStyle(circle).fill : null, opacity: rect ? getComputedStyle(rect).opacity : null };
  });
  expect(lattice).toEqual({ fill: "rgb(201, 190, 169)", opacity: "0.6" });

  await page.mouse.move(0, 0);
  await svg.focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("stack-chart-tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("stack-chart-tooltip")).toHaveCount(0);
});

// U13-03: the monthly-change runs (about half the facts) shipped with every page view although only the monthly tab
// reads them; they now load from a long-cached file when that tab opens.
test("the monthly runs load only for the monthly tab", async ({ page, request }) => {
  for (const prefix of ["", "/en"]) {
    const html = await (await request.get(`${prefix}${CATEGORIES}`)).text();
    expect(html.includes("mom_pct"), "a monthly run in the HTML").toBe(false);
    expect(gzipSync(html).length).toBeLessThan(135_000);
  }
  const requested: string[] = [];
  page.on("request", (sent) => { if (sent.url().includes("/page-data/")) requested.push(new URL(sent.url()).pathname); });
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  await page.getByTestId("inflation-category-tab-yoy").click();
  await expect(page.locator("path[data-overlay]")).toHaveCount(0);
  expect(requested).toEqual([]);
  await page.getByTestId("inflation-category-tab-mom").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-tab", "mom");
  await expect(page.getByTestId("year-range-strip")).toBeVisible();
  expect(requested).toHaveLength(1);
  expect(requested[0]).toMatch(/^\/page-data\/inflation-category-mom\.[0-9a-f]{16}\.json$/);
  const data = await request.get(requested[0]!);
  expect(data.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
});

test("a failed monthly load shows the error in place of the chart and keeps the other tabs", async ({ page }) => {
  await page.route("**/page-data/inflation-category-mom.*.json", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto(`/en${CATEGORIES}#i=mom`);
  await ready(page);
  await expect(page.getByRole("alert").getByTestId("page-data-error")).toHaveText("The data could not be loaded. Reload the page to try again.");
  await expect(page.getByTestId("inflation-category-download")).toBeDisabled();
  await page.getByTestId("inflation-category-tab-contrib").click();
  await expect(page.getByTestId("page-data-error")).toHaveCount(0);
  await expect(page.locator("path[data-overlay]")).toHaveCount(1);
});

