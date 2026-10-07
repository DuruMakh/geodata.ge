import { expect, test } from "@playwright/test";

const regionSlugs = [
  "tbilisi",
  "adjara",
  "guria",
  "imereti",
  "kakheti",
  "mtskheta_mtianeti",
  "racha_lechkhumi_kvemo_svaneti",
  "samegrelo_zemo_svaneti",
  "samtskhe_javakheti",
  "kvemo_kartli",
  "shida_kartli",
] as const;

for (const [locale, prefix, heading] of [
  ["ka", "", "რეგიონების ეკონომიკა"],
  ["en", "/en", "Regional economies"],
] as const) {
  test(`${locale} regional index exposes all 11 linked regions and dataset metadata`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/economy/regions`);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("regional-list-row")).toHaveCount(11);
    await expect(page.getByTestId("regional-economy-map")).toBeVisible();
    await expect(page.getByTestId("regional-map-path")).toHaveCount(11);
    // No municipality shapes or city markers; the invisible touch disk is not a marker.
    await expect(page.getByTestId("regional-economy-map").locator('use[href*="municipality-shape"], circle:not([data-map-touch-target])')).toHaveCount(0);
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
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      locale === "en" ? "Regional economy — Imereti" : "რეგიონის ეკონომიკა — იმერეთი",
    );
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

for (const width of [390, 768, 900, 1100, 1440]) {
  test(`regional index and detail remain usable without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/explorer/economy/regions");
    await expect(page.getByTestId("regional-economy-map")).toBeVisible();
    await expect(page.getByTestId("regional-list-row")).toHaveCount(11);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/explorer/economy/regions/imereti");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByTestId("regional-entity-navigation")).toBeVisible();

    await page.getByTestId("region-picker-trigger").click();
    await expect(page.getByRole("dialog", { name: "რეგიონის არჩევა" })).toBeVisible();
    await page.getByRole("dialog", { name: "რეგიონის არჩევა" }).locator("input").fill("გურია");
    await expect(page.getByTestId("region-picker-option")).toHaveCount(1);
    await page.getByTestId("region-picker-option").click();
    await expect(page).toHaveURL(/\/explorer\/economy\/regions\/guria$/);
  });
}

test("region picker keyboard navigation includes All regions", async ({ page }) => {
  await page.goto("/en/explorer/economy/regions/imereti");
  await page.getByTestId("region-picker-trigger").click();
  const search = page.getByRole("combobox", { name: "Search regions" });
  await search.press("ArrowDown");
  await expect(page.getByTestId("region-picker-all-option")).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/en\/explorer\/economy\/regions$/);
});

test("every regional detail route is statically available in both languages", async ({ request }) => {
  for (const prefix of ["", "/en"]) {
    for (const slug of regionSlugs) {
      const response = await request.get(`${prefix}/explorer/economy/regions/${slug}`);
      expect(response.status(), `${prefix || "/ka"}:${slug}`).toBe(200);
      const html = await response.text();
      expect(html).toContain('data-testid="regional-economy-explorer"');
      expect(html).toContain(`<html lang="${prefix ? "en" : "ka"}"`);
    }
  }
});

test("regional map, ranked list, search and keyboard focus stay coordinated", async ({ page }) => {
  await page.goto("/en/explorer/economy/regions");
  const row = page.getByTestId("regional-list-row").filter({ hasText: "Imereti" });
  const mapTarget = page.locator('[data-region-map-target][data-region-id="region.imereti"]');
  await row.hover();
  await expect(row).toHaveAttribute("data-active", "true");
  await expect(mapTarget).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("regional-map-tooltip")).toHaveCount(0);
  await expect(row).toHaveAttribute("href", "/en/explorer/economy/regions/imereti");

  await mapTarget.focus();
  await expect(row).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("regional-map-tooltip")).toHaveCount(0);
  await mapTarget.press("ArrowDown");
  await expect(page.locator('[data-region-map-target]:focus')).toHaveCount(1);

  const search = page.getByRole("textbox", { name: "Search regions" });
  await search.fill("Imereti");
  await expect(page.getByTestId("regional-list-row")).toHaveCount(1);
  await search.fill("no-such-region");
  await expect(page.getByTestId("regional-list-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByTestId("regional-list-row")).toHaveCount(11);
});

for (const family of ["economy", "unemployment"]) test(`${family} region map restores keyboard highlighting after the pointer leaves`, async ({ page }) => {
  await page.goto(`/en/explorer/${family}/regions`);
  const target = page.locator('[data-region-map-target][data-region-id="region.imereti"]');
  const pointerTarget = page.locator('[data-region-map-target][data-region-id="region.guria"]');
  const row = page.locator('[data-testid="regional-list-row"][data-region-id="region.imereti"]');
  await target.focus();
  await expect(target).toHaveAttribute("data-active", "true");
  await pointerTarget.hover();
  await expect(pointerTarget).toHaveAttribute("data-active", "true");
  await page.getByRole("heading", { level: 1 }).hover();
  await expect(target).toBeFocused();
  await expect(target).toHaveAttribute("data-active", "true");
  await expect(row).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("regional-map-tooltip")).toHaveCount(0);
  await target.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/en/explorer/${family}/regions/imereti$`));
});

test("regional detail controls retain selection, measure, range and language state", async ({ page }) => {
  await page.goto("/en/explorer/economy/regions/imereti");
  await expect(page.getByTestId("regional-mode-line")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("regional-measure-nominal")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-status")).toContainText("1 / 21");
  await expect(page.getByTestId("regional-headline")).toContainText("7.2 bn GEL");

  await page.getByTestId("regional-mode-table").click();
  await page.locator('[data-series-id="sector.a"]').getByTestId("series-row-toggle").click();
  await page.getByTestId("regional-measure-share").click();
  const agriculture = page.getByTestId("explorer-table").getByRole("row").filter({ hasText: "Agriculture, forestry and fishing" });
  const before = await agriculture.locator("td").allTextContents();
  await page.locator('[data-series-id="sector.b"]').getByTestId("series-row-toggle").click();
  await expect.poll(() => agriculture.locator("td").allTextContents()).toEqual(before);

  await page.getByTestId("range-start-handle").press("ArrowRight");
  await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2011");
  const hash = new URL(page.url()).hash;
  expect(hash).toContain("measure=share_of_region_gdp");
  expect(hash).toContain("view=table");
  expect(hash).toContain("start=2011");
  await page.reload();
  await expect(page.getByTestId("regional-chart-panel")).toHaveAttribute("data-measure", "share_of_region_gdp");
  await expect(page.getByTestId("regional-chart-panel")).toHaveAttribute("data-mode", "table");
  expect(new URL(page.url()).hash).toBe(hash);

  await page.getByTestId("language-switch").getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ka");
  expect(new URL(page.url()).hash).toBe(hash);
  await page.goBack();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(new URL(page.url()).hash).toBe(hash);

  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("series-status")).toContainText("0 / 21");
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-status")).toContainText("21 / 21");
  await page.getByTestId("series-search").fill("no-such-sector");
  await expect(page.getByText(/No matching category found/)).toBeVisible();
});

test("representative small-region and true-zero values remain distinct from missing data", async ({ page }) => {
  await page.goto("/en/explorer/economy/regions/racha_lechkhumi_kvemo_svaneti#measure=nominal&view=table&sel=sector.h&start=2013&end=2013");
  await expect(page.getByTestId("regional-headline")).toContainText("2013");
  const transport = page.getByTestId("explorer-table").getByRole("row").filter({ hasText: "Transportation and storage" });
  await expect(transport).toContainText("0.00");
  await expect(transport).not.toContainText("—");
});
