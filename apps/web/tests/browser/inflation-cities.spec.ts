import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const CITIES = "/explorer/inflation/cities";
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const locale of ["ka", "en"] as const) {
  const prefix = locale === "en" ? "/en" : "";
  for (const width of [390, 1440]) {
    test(`Georgia page layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${prefix}${CITIES}`);
      await ready(page);
      await expect(page.getByTestId("inflation-city-tabs")).toHaveCount(0);
      await expect(page.locator("select")).toHaveCount(0);
      await expect(page.getByTestId("series-row")).toHaveCount(7);
      await expect(page.getByTestId("series-status")).toContainText("7 / 7");
      expect(await noOverflow(page)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`cities-${locale}-${width}.png`), fullPage: true });

      await page.getByTestId("chart-mode-table").click();
      await expect(page.getByTestId("month-grid")).toBeVisible();
      expect(/[Ⴀ-ჿ]/.test((await page.getByTestId("month-grid").innerText()).normalize())).toBe(locale === "ka");
      expect(await noOverflow(page)).toBe(true);
    });

    test(`city page layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${prefix}${CITIES}/batumi`);
      await ready(page);
      await expect(page.getByTestId("series-row")).toHaveCount(13);
      await expect(page.getByTestId("series-status")).toContainText("1 / 13");
      await expect(page.getByTestId("city-entity-navigation")).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`city-batumi-${locale}-${width}.png`), fullPage: true });
    });
  }
}

test("the heading picker searches and opens a city page", async ({ page }) => {
  await page.goto(CITIES);
  await ready(page);
  await page.getByTestId("city-picker-trigger").click();
  const dialog = page.getByRole("dialog", { name: "ქალაქის არჩევა" });
  await expect(dialog).toBeVisible();
  await dialog.locator("input").fill("ბათ");
  await expect(page.getByTestId("city-picker-option")).toHaveCount(1);
  await page.getByTestId("city-picker-option").click();
  await expect(page).toHaveURL(/\/explorer\/inflation\/cities\/batumi$/);
});

test("the picker marks the current page", async ({ page }) => {
  await page.goto(`/en${CITIES}/gori`);
  await ready(page);
  await page.getByTestId("city-picker-trigger").click();
  await expect(page.getByRole("dialog", { name: "Choose a city" })).toBeVisible();
  await expect(page.getByTestId("city-picker-option").filter({ hasText: "Gori" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("city-picker-georgia-option")).not.toHaveAttribute("aria-current", "page");
});

test("Escape closes the picker and returns focus to the trigger", async ({ page }) => {
  await page.goto(`/en${CITIES}/gori`);
  await ready(page);
  await page.getByTestId("city-picker-trigger").click();
  await expect(page.getByRole("dialog", { name: "Choose a city" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Choose a city" })).toHaveCount(0);
  await expect(page.getByTestId("city-picker-trigger")).toBeFocused();
});

test("the keyboard reaches Georgia first and opens the comparison page", async ({ page }) => {
  await page.goto(`/en${CITIES}/telavi`);
  await ready(page);
  await page.getByTestId("city-picker-trigger").click();
  const search = page.getByRole("combobox", { name: "Search cities" });
  await search.press("ArrowDown");
  await expect(page.getByTestId("city-picker-georgia-option")).toHaveAttribute("aria-selected", "true");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/en\/explorer\/inflation\/cities$/);
});

test("previous and next follow Geostat's order and wrap", async ({ page }) => {
  await page.goto(`/en${CITIES}/batumi`);
  await ready(page);
  const navigation = page.getByTestId("city-entity-navigation");
  await expect(navigation.getByRole("link").first()).toHaveText("← Kutaisi");
  await expect(navigation.getByRole("link").last()).toHaveText("Gori →");
  await page.goto(`/en${CITIES}/tbilisi`);
  await expect(page.getByTestId("city-entity-navigation").getByRole("link").first()).toHaveText("← Zugdidi");
});

test("a city page opens on its total and adds a division", async ({ page }) => {
  await page.goto(`/en${CITIES}/kutaisi`);
  await ready(page);
  await page.locator('[data-testid="series-row"][data-series-id="cpi.cat.01"] button').first().click();
  await expect(page.getByTestId("series-status")).toContainText("2 / 13");
  await expect(page).toHaveURL(/sel=total%2C01/);
});

test("the annual average column follows the total", async ({ page }) => {
  await page.goto(`/en${CITIES}#m=table`);
  await ready(page);
  await expect(page.getByTestId("month-grid")).toContainText("Annual average");
  await page.goto(`/en${CITIES}/batumi#m=table&sel=total%2C01&t=01`);
  await ready(page);
  await expect(page.getByTestId("month-grid")).not.toContainText("Annual average");
  await page.getByTestId("inflation-city-table-series-cpi.headline").click();
  await expect(page.getByTestId("month-grid")).toContainText("Annual average");
});

test("Zugdidi's annual series starts late and is never filled", async ({ page }) => {
  await page.goto(`/en${CITIES}#m=table&t=zugdidi`);
  await ready(page);
  await expect(page.getByTestId("inflation-city-table-series-city.zugdidi")).toHaveAttribute("aria-pressed", "true");
  const monthCells = page.locator('[data-testid="month-grid-row"][data-year="2016"] td');
  for (let month = 0; month < 11; month += 1) {
    await expect(monthCells.nth(month)).toHaveText("—");
    await expect(monthCells.nth(month)).not.toHaveAttribute("data-testid", "month-grid-cell");
  }
  await expect(monthCells.nth(11)).toHaveAttribute("data-testid", "month-grid-cell");
  await expect(monthCells.nth(11)).not.toHaveText("—");

  await page.goto(`/en${CITIES}/zugdidi`);
  await ready(page);
  await expect(page.getByTestId("explorer-header")).toContainText("Dec 2016–");
});

test("an old link with the retired tab and category keys still opens", async ({ page }) => {
  await page.goto(`/en${CITIES}#i=mom&c=07`);
  await ready(page);
  await expect(page.getByTestId("series-status")).toContainText("7 / 7");
  await page.locator('[data-testid="series-row"][data-series-id="city.gori"] button').first().click();
  await expect(page).toHaveURL(/sel=/);
  await expect(page).not.toHaveURL(/[#&](i|c)=/);
});

test("switching language keeps a city page's selection and table series", async ({ page }) => {
  await page.goto(`${CITIES}/batumi#m=table&sel=total%2C01&t=01`);
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/en\/explorer\/inflation\/cities\/batumi#.*sel=total%2C01/);
  await expect(page.getByTestId("series-status")).toContainText("2 / 13");
  await expect(page.getByTestId("inflation-city-table-series-cpi.cat.01")).toHaveAttribute("aria-pressed", "true");
});

test("clearing the selection can be undone from the same control", async ({ page }) => {
  await page.goto(`/en${CITIES}`);
  await ready(page);
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("series-status")).toContainText("7 / 7");
});

test("the hub links the Georgia page and the sidebar stays on the section across city pages", async ({ page }) => {
  await page.goto("/en/explorer/inflation");
  await page.getByTestId("inflation-hub").locator('a[href="/en/explorer/inflation/cities"]').click();
  await ready(page);
  await expect(page.getByTestId("inflation-cities-link")).toHaveAttribute("aria-current", "page");
  await page.goto(`/en${CITIES}/gori`);
  await expect(page.getByTestId("inflation-cities-link")).toHaveAttribute("aria-current", "page");
});

test("every city page is statically available in both languages", async ({ request }) => {
  for (const prefix of ["", "/en"]) {
    for (const slug of ["tbilisi", "kutaisi", "batumi", "gori", "telavi", "zugdidi"]) {
      const response = await request.get(`${prefix}${CITIES}/${slug}`);
      expect(response.status(), `${prefix || "/ka"}:${slug}`).toBe(200);
      await response.dispose();
    }
  }
  expect((await request.get(`${CITIES}/rustavi`)).status()).toBe(404);
});

// The dialog is a sibling of the heading inside the heading's own column, so it opens
// under the heading and never at the far edge of the row (where overflow-x: hidden
// would clip it).
const pickerCases = [
  { name: "Georgia page at 1440px", path: CITIES, width: 1440, anchored: true },
  { name: "Georgia page at 390px", path: CITIES, width: 390, anchored: false },
  { name: "city page at 1440px", path: `${CITIES}/batumi`, width: 1440, anchored: true },
] as const;

for (const { name, path, width, anchored } of pickerCases) {
  test(`the city picker opens inside the viewport: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(path);
    await ready(page);
    const trigger = page.getByTestId("city-picker-trigger");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "ქალაქის არჩევა" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const headingBox = await page.locator("h1").boundingBox();
    expect(box).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(box!.x, "dialog left edge").toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, "dialog right edge").toBeLessThanOrEqual(width);
    // As on municipal pages the dialog is left-aligned with the heading and opens just below it.
    if (anchored) {
      expect(Math.abs(box!.x - headingBox!.x), "dialog left edge vs heading").toBeLessThanOrEqual(24);
      expect(box!.y, "dialog opens below the heading").toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height - 1);
    }
  });
}

test("the Georgia page picker shows an empty state for no match and recovers", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(CITIES);
  await ready(page);
  await page.getByTestId("city-picker-trigger").click();
  const dialog = page.getByRole("dialog", { name: "ქალაქის არჩევა" });
  await dialog.locator("input").fill("zzzz");
  await expect(dialog.getByText("ქალაქი ვერ მოიძებნა")).toBeVisible();
  await expect(page.getByTestId("city-picker-option")).toHaveCount(0);
  await dialog.getByRole("button", { name: "ძიების გასუფთავება" }).click();
  await expect(page.getByTestId("city-picker-option")).toHaveCount(6);
});

test("page payloads carry yoy_pct and never mom_pct", async ({ request }) => {
  for (const path of [CITIES, `${CITIES}/batumi`]) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain("|yoy_pct");
    expect(html, path).not.toContain("|mom_pct");
  }
});
