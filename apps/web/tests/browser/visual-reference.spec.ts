import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const artifactDir = join(process.cwd(), "test-results", "visual-reference");
const referenceDir = join(process.cwd(), "..", "..", "docs", "Design HTML files");

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

test("multi-year app matches approved reference structure", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  await page.goto(pathToFileURL(join(referenceDir, "multiyear-apple.html")).href);
  await capture(page, "multiyear-reference");

  await page.goto("http://localhost:3100");
  await waitForApp(page);
  await capture(page, "multiyear-product");

  const chartPanel = page.getByTestId("chart-panel");
  await expect(chartPanel.getByTestId("chart-mode-line")).toBeVisible();
  await expect(chartPanel.getByTestId("chart-mode-table")).toBeVisible();
  await expect(chartPanel.getByTestId("measure-share-toggle")).toBeVisible();
  await expect(chartPanel.getByTestId("chart-legend")).toBeVisible();
  await expect(chartPanel.getByTestId("year-range-strip")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
});

test("single-year app matches approved reference structure", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(pathToFileURL(join(referenceDir, "singleyear-apple.html")).href);
  await capture(page, "singleyear-reference-mobile");

  await page.goto("http://localhost:3100");
  await waitForApp(page);
  await page.getByTestId("view-single_year").click();
  await capture(page, "singleyear-product-mobile");

  await expect(page.getByTestId("year-pills")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();
  await expect(page.getByText("Single-year snapshot")).toHaveCount(0);
  await expect(page.getByText("Budget Radar")).toHaveCount(0);
  await expect(page.getByText("Budget Field")).toHaveCount(0);
});
