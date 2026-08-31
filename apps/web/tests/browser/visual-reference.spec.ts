import { expect, test, type Page } from "@playwright/test";

const TEST_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

async function waitForApp(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test("explorer preserves the editorial v4.1 structure", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await waitForApp(page);

  // Structural contract of DESIGN.md v4.1.
  await expect(page.getByTestId("chart-mode-line")).toBeVisible();
  await expect(page.getByTestId("chart-mode-table")).toBeVisible();
  await expect(page.getByTestId("measure-share-toggle")).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);

  // No superseded Apple styling: paper background, serif page title, no card shadows.
  const style = await page.evaluate(() => {
    const heading = document.querySelector("h1");
    return {
      background: getComputedStyle(document.body).backgroundColor,
      headingFont: heading ? getComputedStyle(heading).fontFamily : "",
    };
  });
  expect(style.background).toBe("rgb(247, 242, 233)");
  expect(style.headingFont).toContain("Noto Serif Georgian");
});

test("analysis preserves the editorial v4.1 single-year structure on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
  await waitForApp(page);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();

  await expect(page.getByTestId("analysis-year-selector")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();
});
