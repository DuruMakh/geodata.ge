import { expect, test } from "@playwright/test";

for (const [locale, prefix, heading] of [
  ["ka", "", "რეგიონების ეკონომიკა"],
  ["en", "/en", "Regional economies"],
] as const) {
  test(`${locale} regional index exposes all 11 linked regions and dataset metadata`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/economy/regions`);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("regional-list-row")).toHaveCount(11);
    await expect(page.getByTestId("regional-economy-map")).toBeVisible();
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("regional-list-row").filter({ hasText: locale === "en" ? "Imereti" : "იმერეთი" })).toHaveAttribute(
      "href",
      `${prefix}/explorer/economy/regions/imereti`,
    );
  });

  test(`${locale} Imereti page has only GEL and regional-share measures`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/economy/regions/imereti`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("regional-economy-explorer")).toBeVisible();
    await expect(page.getByTestId("regional-measure-nominal")).toBeVisible();
    await expect(page.getByTestId("regional-measure-share")).toBeVisible();
    await expect(page.locator('[data-testid^="regional-measure-"]')).toHaveCount(2);
    await expect(page.getByTestId("regional-headline")).toContainText("2024");
    await expect(page.getByTestId("regional-highlights")).toBeVisible();
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(1);

    await page.getByTestId("regional-measure-share").click();
    await expect(page.getByTestId("regional-chart-panel")).toHaveAttribute("data-measure", "share_of_region_gdp");
    await expect(page).toHaveURL(/measure=share_of_region_gdp/);
    await expect(page.getByTestId("regional-economy-explorer")).not.toContainText(
      locale === "en" ? "Share of Georgia" : "საქართველოს მშპ-ში წილი",
    );
  });
}

for (const width of [390, 1440]) {
  test(`regional detail remains usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/explorer/economy/regions/imereti");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByTestId("region-picker-trigger").click();
    await expect(page.getByRole("dialog", { name: "რეგიონის არჩევა" })).toBeVisible();
    await page.getByRole("dialog", { name: "რეგიონის არჩევა" }).locator("input").fill("გურია");
    await expect(page.getByTestId("region-picker-option")).toHaveCount(1);
    await page.getByTestId("region-picker-option").click();
    await expect(page).toHaveURL(/\/explorer\/economy\/regions\/guria$/);
  });
}
