import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const CITIES = "/explorer/inflation/cities";

for (const locale of ["ka", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`inflation cities layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${locale === "en" ? "/en" : ""}${CITIES}`);
      await ready(page);
      await expect(page.getByTestId("inflation-city-tabs").getByRole("button")).toHaveCount(2);
      await expect(page.getByTestId("series-row")).toHaveCount(7);
      await expect(page.getByTestId("series-status")).toContainText("7 / 7");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`cities-${locale}-${width}.png`), fullPage: true });

      await page.getByTestId("chart-mode-table").click();
      await expect(page.getByTestId("month-grid")).toBeVisible();
      const grid = (await page.getByTestId("month-grid").innerText()).normalize();
      expect(/[Ⴀ-ჿ]/.test(grid)).toBe(locale === "ka");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`cities-table-${locale}-${width}.png`), fullPage: true });
    });
  }
}

test("the category picker drives the chart, the hash and the indicators", async ({ page }) => {
  await page.goto(`/en${CITIES}`);
  await ready(page);
  const hero = page.getByTestId("inflation-city-hero");
  const before = await hero.innerText();
  await page.getByTestId("inflation-city-category").selectOption("cpi.cat.07");
  await expect(page).toHaveURL(/c=07/);
  await expect(hero).not.toHaveText(before);
  await expect(page.getByTestId("inflation-city-unit")).toContainText("Percent");
});

test("the annual average column appears only for the total on the annual tab", async ({ page }) => {
  await page.goto(`/en${CITIES}#i=yoy&m=table&c=total`);
  await ready(page);
  await expect(page.getByTestId("month-grid")).toContainText("Annual average");
  await page.getByTestId("inflation-city-category").selectOption("cpi.cat.01");
  await expect(page.getByTestId("month-grid")).not.toContainText("Annual average");
});

test("Zugdidi's annual series starts late and is never filled", async ({ page }) => {
  await page.goto(`/en${CITIES}#i=yoy&m=table&c=total&t=zugdidi`);
  await ready(page);
  await expect(page.getByTestId("inflation-city-table-series-city.zugdidi")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("month-grid")).toContainText("—");
});

test("clearing the selection can be undone from the same control", async ({ page }) => {
  await page.goto(`/en${CITIES}`);
  await ready(page);
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-status")).toContainText("7 / 7");
});

test("the hub links the live cities card and the sidebar names the section", async ({ page }) => {
  await page.goto("/en/explorer/inflation");
  await page.getByTestId("inflation-hub").locator('a[href="/en/explorer/inflation/cities"]').click();
  await ready(page);
  await expect(page.getByTestId("inflation-cities-link")).toHaveAttribute("aria-current", "page");
});
