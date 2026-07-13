import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Landing page (GeoData Site v2 design): structure, live data blocks, and the
// paths into the explorer. The hero is WebGL; tests assert the canvas mounts
// (or the fallback message shows) rather than pixel content.

const artifactDir = join(process.cwd(), "test-results", "visual-reference");

async function capture(page: Page, name: string) {
  await mkdir(artifactDir, { recursive: true });
  await page.waitForTimeout(2500); // let the hero's geological entry settle
  // Viewport capture: full-page stitching drops the WebGL hero layer.
  await page.screenshot({ path: join(artifactDir, `${name}.png`), caret: "hide" });
}

test("landing renders the site v2 structure with live data", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("http://localhost:3100");

  await expect(page.getByTestId("landing-shell")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება და იხარჯება საქართველოს ბიუჯეტი");

  // Hero: after hydration the WebGL scene mounts a canvas; if init fails the
  // fallback note shows instead. Either way something must appear.
  await expect(
    page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა")),
  ).toBeVisible({ timeout: 15_000 });

  // Key numbers: the three hardcoded country figures.
  const keyNumbers = page.getByTestId("key-numbers");
  await expect(keyNumbers).toContainText("3.7");
  await expect(keyNumbers).toContainText("69.7");
  await expect(keyNumbers).toContainText("104.6");

  // Three paths: sparkline, exactly 30 waffle cells, CSV preview header.
  const paths = page.getByTestId("three-paths");
  await expect(paths.locator("svg polyline").first()).toBeVisible();
  await expect(paths.getByTestId("waffle-grid").locator("div")).toHaveCount(30);
  await expect(paths).toContainText("year,category_id,ka_label,amount_gel,basis");

  await expect(page.getByTestId("landing-footer")).toContainText("CC BY 4.0");

  await capture(page, "landing-desktop");
});

test("landing nav and cards lead into the explorer", async ({ page }) => {
  await page.goto("http://localhost:3100");

  // Header nav → explorer.
  await page.getByTestId("landing-header").getByRole("link", { name: "ექსპლორერი" }).click();
  await expect(page).toHaveURL(/\/explorer$/);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();

  // Explorer wordmark → back to the landing.
  await page.getByRole("link", { name: "GeoData" }).click();
  await expect(page.getByTestId("landing-shell")).toBeVisible();

  // Card 02 deep-links into the analysis view.
  await page.getByRole("link", { name: "სურათის ნახვა" }).click();
  // The explorer expands the hash with its analysis defaults after restoring it.
  await expect(page).toHaveURL(/\/explorer#nav=analysis/);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
});

test("landing on mobile shows the hero text above the map and hides the year range", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("hero-cta")).toBeVisible();
  await expect(page.getByTestId("landing-header").locator("span").last()).toBeHidden();

  await capture(page, "landing-mobile");
});
