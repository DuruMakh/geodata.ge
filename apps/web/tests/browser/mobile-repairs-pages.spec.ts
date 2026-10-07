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
