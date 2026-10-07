import { expect, test } from "@playwright/test";

// Owner decision D4 (2026-10-07): picking series on a phone. The lists flow with the
// page, a pill leads back to the chart, a legend names the lines, and the controls
// that change the chart sit next to it.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const listPages = [
  "/explorer/expenditure",
  "/explorer/municipalities/batumi",
  "/explorer/economy/sectors",
  "/explorer/economy/regions/adjara",
  "/explorer/inflation/categories",
  "/explorer/inflation/products",
  "/explorer/unemployment/overview",
];

for (const path of listPages) {
  test(`the series list flows with the page on a phone: ${path}`, async ({ page }) => {
    await page.goto(path);
    const list = page.getByTestId("series-list");
    await list.scrollIntoViewIfNeeded();
    const box = await list.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      maxHeight: getComputedStyle(element).maxHeight,
      clipped: element.scrollHeight > element.clientHeight + 1,
    }));
    expect(box).toEqual({ overflowY: "visible", maxHeight: "none", clipped: false });
  });
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test("the sticky aside keeps its 430px list", async ({ page }) => {
    await page.goto("/explorer/inflation/products");
    const list = page.getByTestId("series-list");
    const box = await list.evaluate((element) => ({ overflowY: getComputedStyle(element).overflowY, maxHeight: getComputedStyle(element).maxHeight }));
    expect(box).toEqual({ overflowY: "auto", maxHeight: "430px" });
    await expect(page.getByTestId("product-panel-more")).toBeHidden();
  });
});

for (const locale of ["ka", "en"] as const) {
  test(`${locale} products list shows the top ten and a "more products" button`, async ({ page }) => {
    await page.goto(`${locale === "en" ? "/en" : ""}/explorer/inflation/products`);
    const rows = page.getByTestId("series-list").getByTestId("series-row");
    const total = await rows.count();
    expect(total).toBeGreaterThan(100);
    const visibleRows = () => rows.evaluateAll((elements) => elements.filter((element) => element.getBoundingClientRect().height > 0).length);
    // Ten ranked rows, plus any selected product ranked further down.
    const hidden = await page.getByTestId("series-list").locator("[data-phone-hidden]").count();
    expect(await visibleRows()).toBe(total - hidden);
    expect(total - hidden).toBeGreaterThanOrEqual(10);
    expect(total - hidden).toBeLessThanOrEqual(13);
    const more = page.getByTestId("product-panel-more");
    await expect(more).toContainText(locale === "en" ? "More products" : "მეტი პროდუქტი");
    expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // A search still looks through every product, not only the ten shown.
    const lastLabel = await rows.last().getByTestId("series-label").textContent();
    await page.getByTestId("series-search").fill(lastLabel!.trim());
    await expect(rows.filter({ hasText: lastLabel!.trim() }).first()).toBeVisible();
    await page.getByTestId("series-search").fill("");

    await more.click();
    await expect(more).toHaveCount(0);
    expect(await visibleRows()).toBe(total);
  });
}

test.describe("the ↑ chart pill", () => {
  test("appears after a selection below the chart and leads back to it", async ({ page }) => {
    await page.goto("/explorer/expenditure");
    const row = page.locator('[data-series-id="spending.social_protection"]').getByTestId("series-row-toggle");
    await row.scrollIntoViewIfNeeded();
    await expect(page.getByTestId("chart-frame")).not.toBeInViewport({ ratio: 0.5 });
    await row.click();
    const pill = page.getByTestId("chart-return-pill");
    await expect(pill).toBeVisible();
    await expect(pill).toContainText("გრაფიკი");
    await expect(pill).toHaveAccessibleName("გრაფიკი, ზემოთ ასვლა");
    const box = (await pill.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    // One swatch per selected series: the total and the new one.
    await expect(pill.locator("span[aria-hidden] > span")).toHaveCount(2);
    await pill.click();
    await expect(pill).toHaveCount(0);
    await expect(page.getByTestId("chart-frame")).toBeInViewport({ ratio: 0.5 });
  });

  test("leaves on its own after a few seconds", async ({ page }) => {
    await page.goto("/en/explorer/expenditure");
    const row = page.locator('[data-series-id="spending.education"]').getByTestId("series-row-toggle");
    await row.scrollIntoViewIfNeeded();
    await row.click();
    const pill = page.getByTestId("chart-return-pill");
    await expect(pill).toContainText("Chart");
    await expect(pill).toHaveCount(0, { timeout: 6000 });
  });

  test("does not appear while the chart is on screen", async ({ page }) => {
    await page.goto("/explorer/expenditure");
    await page.getByTestId("chart-frame").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("chart-frame")).toBeInViewport({ ratio: 0.5 });
    // Change the selection without scrolling the chart away.
    await page.evaluate(() => (document.querySelector('[data-testid="series-toggle-all"]') as HTMLButtonElement).click());
    await page.waitForTimeout(300);
    await expect(page.getByTestId("chart-return-pill")).toHaveCount(0);
  });

  test.describe("desktop", () => {
    test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
    test("never shows", async ({ page }) => {
      await page.goto("/explorer/expenditure");
      await page.mouse.wheel(0, 1400);
      await page.locator('[data-series-id="spending.education"]').getByTestId("series-row-toggle").click();
      await page.waitForTimeout(300);
      await expect(page.getByTestId("chart-return-pill")).toBeHidden();
    });
  });
});

test.describe("the phone legend", () => {
  test("lists two or more lines with their latest values under the chart", async ({ page }) => {
    await page.goto("/explorer/expenditure#g=fields&r=2004-2025&sel=expenditure.total%2Cspending.social_protection%2Cspending.education");
    const legend = page.getByTestId("chart-phone-legend");
    await expect(legend).toBeVisible();
    await expect(legend.locator("li")).toHaveCount(3);
    const total = legend.locator('li[data-series-id="expenditure.total"]');
    await expect(total).toContainText("მთლიანი ხარჯი");
    await expect(total).toContainText("27.7 მლრდ");
    // Directly below the chart frame, inside the phone's width.
    const frame = (await page.getByTestId("chart-frame").boundingBox())!;
    const list = (await legend.boundingBox())!;
    expect(list.y).toBeGreaterThanOrEqual(frame.y + frame.height - 1);
    expect(list.y - (frame.y + frame.height)).toBeLessThanOrEqual(24);
    expect(list.x + list.width).toBeLessThanOrEqual(390);
  });

  test("is absent for a single line and in table mode", async ({ page }) => {
    await page.goto("/explorer/expenditure");
    await expect(page.getByTestId("chart-frame")).toBeVisible();
    await expect(page.getByTestId("chart-phone-legend")).toHaveCount(0);
    await page.goto("/explorer/expenditure#g=fields&m=table&sel=expenditure.total%2Cspending.social_protection");
    await page.reload();
    await expect(page.getByTestId("explorer-table")).toBeVisible();
    await expect(page.getByTestId("chart-phone-legend")).toHaveCount(0);
  });

  test("prints English percentages on the unemployment gender page", async ({ page }) => {
    await page.goto("/en/explorer/unemployment/gender");
    const legend = page.getByTestId("chart-phone-legend");
    await expect(legend.locator("li")).toHaveCount(3);
    for (const item of await legend.locator("li").all()) await expect(item).toContainText(/\d%$/);
  });

  test.describe("desktop", () => {
    test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
    test("leaves the chart's own labels alone", async ({ page }) => {
      await page.goto("/explorer/expenditure#g=fields&sel=expenditure.total%2Cspending.social_protection");
      await expect(page.getByTestId("chart-frame")).toBeVisible();
      await expect(page.getByTestId("chart-phone-legend")).toBeHidden();
    });
  });
});
