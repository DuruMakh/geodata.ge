import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Landing page (GeoData Site v2 design): structure, live data blocks, and the
// paths into the explorer. The hero is WebGL; tests assert the canvas mounts
// (or the fallback message shows) rather than pixel content.

const artifactDir = join(process.cwd(), "test-results", "visual-reference");
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

async function capture(page: Page, name: string) {
  await mkdir(artifactDir, { recursive: true });
  await page.waitForTimeout(2500); // let the hero's geological entry settle
  // Viewport capture: full-page stitching drops the WebGL hero layer.
  await page.screenshot({ path: join(artifactDir, `${name}.png`), caret: "hide" });
}

test("landing renders the site v2 structure with live data", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(baseUrl);

  await expect(page).toHaveTitle("Fiscal.ge — საქართველოს ბიუჯეტის ექსპლორერი");
  await expect(page.getByTestId("landing-shell")).toBeVisible();
  await expect(page.getByTestId("landing-header")).toContainText("Fiscal.ge");
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

  // Three paths: sparkline, exactly 30 waffle cells, Excel workbook preview.
  const paths = page.getByTestId("three-paths");
  await expect(paths.locator("svg polyline").first()).toBeVisible();
  await expect(paths.getByTestId("waffle-grid").locator("div")).toHaveCount(30);
  await expect(paths.getByText("Excel მონაცემები")).toBeVisible();
  await expect(paths.getByText("მარტივი ცხრილი", { exact: true })).toBeVisible();
  await expect(paths.getByText("მონაცემები", { exact: true })).toBeVisible();
  await expect(paths.getByText(/year,category_id|amount_gel/)).toHaveCount(0);
  const previewRow = paths.getByTestId("excel-preview").getByRole("row").nth(1);
  await expect(previewRow.getByRole("rowheader")).not.toBeEmpty();
  await expect(previewRow.getByRole("cell")).toHaveCount(2);
  await expect(previewRow.getByRole("cell").nth(0)).not.toBeEmpty();
  await expect(previewRow.getByRole("cell").nth(1)).not.toBeEmpty();

  const footer = page.getByTestId("landing-footer");
  await expect(footer).toContainText("Fiscal.ge");
  await expect(footer.getByRole("link", { name: "info@fiscal.ge" })).toHaveAttribute("href", "mailto:info@fiscal.ge");
  await expect(footer).toContainText("CC BY 4.0");

  await capture(page, "landing-desktop");
});

test("landing nav and cards lead into the explorer", async ({ page }) => {
  await page.goto(baseUrl);

  // Header nav → the budget hub. The hub itself writes nothing into the hash,
  // but a shared link can arrive carrying one, so tolerate an optional hash.
  await page.getByTestId("landing-header").getByRole("link", { name: "ექსპლორერი" }).click();
  await expect(page).toHaveURL(/\/explorer(#.*)?$/);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();

  // Explorer breadcrumb → back to the landing. Scoped to the header: the
  // sidebar foot carries a second home link (← მთავარი).
  await page.getByTestId("explorer-header").getByRole("link", { name: "მთავარი" }).click();
  await expect(page.getByTestId("landing-shell")).toBeVisible();

  // Card 02 deep-links into the analysis section.
  await page.getByRole("link", { name: "სურათის ნახვა" }).click();
  await expect(page).toHaveURL(/\/explorer\/analysis/);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
});

test("landing on mobile shows the hero text above the map and hides the year range", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("hero-cta")).toBeVisible();
  await expect(page.getByTestId("landing-header").locator("span").last()).toBeHidden();

  await capture(page, "landing-mobile");
});

test("methodology is in the footer but never the landing header", async ({ page }) => {
  await page.goto(`${baseUrl}/`);
  await expect(page.getByTestId("landing-header").getByRole("link", { name: "მეთოდოლოგია" })).toHaveCount(0);
  await expect(page.getByTestId("site-footer").getByRole("link", { name: "მეთოდოლოგია" })).toHaveAttribute(
    "href",
    "/methodology",
  );
  await expect(page.getByTestId("methodology-promo")).toBeVisible();
});
