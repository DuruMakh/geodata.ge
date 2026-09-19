import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const CATEGORIES = "/explorer/inflation/categories";

for (const locale of ["ka", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`inflation categories layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${locale === "en" ? "/en" : ""}${CATEGORIES}`);
      await ready(page);
      await expect(page.getByTestId("inflation-category-tabs").getByRole("button")).toHaveCount(3);
      // The stack must close on the published headline, so both are drawn.
      await expect(page.locator('rect[data-segment="cpi.cat.residual"]').first()).toBeAttached();
      await expect(page.locator("path[data-overlay]")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`categories-${locale}-${width}.png`), fullPage: true });

      await page.getByTestId("chart-mode-table").click();
      await expect(page.getByTestId("month-grid")).toBeVisible();
      // The grid legend is the one string no other gate sees: it exists only after
      // this click, so a hardcoded Georgian unit would ship on the English page.
      const legend = (await page.getByTestId("month-grid").innerText()).normalize();
      expect(/[Ⴀ-ჿ]/.test(legend)).toBe(locale === "ka");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`categories-table-${locale}-${width}.png`), fullPage: true });
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

// Clearing used to be a one-way door: with 55 rows and the bulk button hidden
// while nothing is selected, the only way back was ticking twelve boxes.
test("clearing the selection can be undone from the same control", async ({ page }) => {
  await page.goto(`/en${CATEGORIES}`);
  await ready(page);
  const bulk = page.getByTestId("series-toggle-all");
  await expect(bulk).toHaveAttribute("aria-checked", "true");

  await bulk.click();
  await expect(page.locator("rect[data-segment]")).toHaveCount(0);
  await expect(bulk).toBeVisible();
  await expect(bulk).toHaveAttribute("aria-checked", "false");

  await bulk.click();
  // Back to the documented default: the 12 divisions, no subgroups.
  await expect(bulk).toHaveAttribute("aria-checked", "true");
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
