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
