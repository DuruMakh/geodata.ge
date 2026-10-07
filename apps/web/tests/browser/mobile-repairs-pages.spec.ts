import { expect, test } from "@playwright/test";

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
