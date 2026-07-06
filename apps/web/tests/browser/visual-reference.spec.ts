import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const artifactDir = join(process.cwd(), "test-results", "visual-reference");
const referenceDir = join(process.cwd(), "..", "..", "docs", "Design HTML files", "editorial-v2");

async function waitForApp(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function capture(page: Page, name: string) {
  await mkdir(artifactDir, { recursive: true });
  await page.screenshot({
    path: join(artifactDir, `${name}.png`),
    fullPage: true,
    caret: "hide",
  });
}

test("explorer matches the confirmed editorial v2 reference structure", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  await page.goto(pathToFileURL(join(referenceDir, "GeoData Platform - Editorial v2.dc.html")).href);
  await page.waitForTimeout(1500);
  await capture(page, "editorial-v2-reference");

  await page.goto("http://localhost:3100");
  await waitForApp(page);
  await capture(page, "editorial-v2-product");

  // Structural contract of the confirmed design.
  await expect(page.getByTestId("nav-expenditure")).toBeVisible();
  await expect(page.getByTestId("nav-revenue")).toBeVisible();
  await expect(page.getByTestId("nav-analysis")).toBeVisible();
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

test("analysis matches the single-year reference structure on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pathToFileURL(join(referenceDir, "Editorial Design System - Reference.dc.html")).href);
  await page.waitForTimeout(1500);
  await capture(page, "editorial-reference-sheet-mobile");

  await page.goto("http://localhost:3100");
  await waitForApp(page);
  await page.getByTestId("nav-analysis").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await capture(page, "editorial-analysis-product-mobile");

  await expect(page.getByTestId("analysis-year-selector")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();
});
