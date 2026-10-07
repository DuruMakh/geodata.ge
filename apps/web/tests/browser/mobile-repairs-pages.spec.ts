import { expect, test } from "@playwright/test";
import { expectReadableText } from "./color-contrast";

// Mobile repairs (2026-10-07 review): page-level layout on phones.
test.use({ isMobile: true, hasTouch: true });

for (const path of ["/methodology", "/en/methodology"]) {
  test(`${path} headline fits a 360px phone`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(path);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate((element) => getComputedStyle(element).fontSize)).toBe("30px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    expect(await heading.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

const tabStrips = [
  { path: "/explorer/economy/gdp", strip: "gdp-indicators" },
  { path: "/explorer/inflation", strip: "inflation-tabs" },
  { path: "/explorer/inflation/categories", strip: "inflation-category-tabs" },
  { path: "/en/explorer/inflation/categories", strip: "inflation-category-tabs" },
  { path: "/en/explorer/economy/gdp", strip: "gdp-indicators" },
];

for (const { path, strip } of tabStrips) {
  test(`${path} shows every tab, the active one included, at 390px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const group = page.getByTestId(strip);
    await expect(group.locator("button[aria-pressed=true]")).toHaveCount(1);
    const layout = await group.evaluate((element) => ({
      scrolls: element.scrollWidth > element.clientWidth,
      tabs: [...element.querySelectorAll("button")].map((button) => {
        const box = button.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
    }));
    expect(layout.scrolls).toBe(false);
    expect(layout.tabs.length).toBeGreaterThanOrEqual(3);
    for (const tab of layout.tabs) {
      expect(tab.left).toBeGreaterThanOrEqual(0);
      expect(tab.right).toBeLessThanOrEqual(390);
    }
  });
}

for (const locale of ["ka", "en"] as const) {
  test(`${locale} inflation category rows: labelled, readable values and a 24px subgroup target`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${locale === "en" ? "/en" : ""}/explorer/inflation/categories`);
    const columns = page.getByTestId("category-value-columns");
    await expect(columns).toBeVisible();
    await expect(columns).toContainText(locale === "en" ? "Basket share" : "წილი კალათაში");
    await expect(columns).toContainText(locale === "en" ? "pp" : "პპ");

    const rows = page.getByTestId("series-row");
    const selectedRow = rows.filter({ has: page.locator("[aria-pressed=true]") }).first();
    const meta = selectedRow.locator("[data-testid=series-row-toggle] > span:has(> .sr-only)").first();
    expect(await meta.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    await expectReadableText(meta, selectedRow);
    const unselected = rows.filter({ has: page.locator("[data-testid=series-row-toggle][aria-pressed=false]") }).first();
    if (await unselected.count()) await expectReadableText(unselected.locator("[data-testid=series-row-toggle] > span:has(> .sr-only)").first(), page.locator("body"));

    const caret = page.locator("[data-testid=series-row] button[aria-expanded]").first();
    await caret.scrollIntoViewIfNeeded();
    const hit = await caret.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const target = document.elementFromPoint(box.left + 24.5, box.top + box.height / 2);
      return { width: Math.round(box.width), hitsCaret: target === button || button.contains(target) };
    });
    expect(hit).toEqual({ width: 22, hitsCaret: true });
  });
}

for (const path of ["/explorer/deficit", "/explorer/debt#f=service&m=line&sel=debt.service.total", "/en/explorer/deficit"]) {
  for (const width of [360, 390]) {
    test(`forecast marker label stays clear of the range chips at ${width}px: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path);
      const strip = page.getByTestId("year-range-strip");
      await strip.scrollIntoViewIfNeeded();
      const label = page.getByTestId("range-marker").locator("span");
      await expect(label).toBeVisible();
      const layout = await strip.evaluate((element) => {
        const marker = element.querySelector("[data-testid=range-marker] span")!.getBoundingClientRect();
        const frame = element.getBoundingClientRect();
        const overlaps = [...element.querySelectorAll("button[aria-pressed]")].filter((chip) => {
          const box = chip.getBoundingClientRect();
          return box.left < marker.right && box.right > marker.left && box.top < marker.bottom && box.bottom > marker.top;
        }).length;
        return { overlaps, inside: marker.left >= frame.left - 0.5 && marker.right <= frame.right + 0.5 };
      });
      expect(layout).toEqual({ overlaps: 0, inside: true });
    });
  }
}
