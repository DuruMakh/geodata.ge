import { expect, test, type Locator, type Page } from "@playwright/test";

// Mobile repairs (2026-10-07 review, owner decisions D2/D3/D10): navigation,
// headers and editorial pages on a 390px phone.
test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function heights(links: Locator) {
  return links.evaluateAll((elements) =>
    elements
      .filter((element) => (element as HTMLElement).offsetParent !== null)
      .map((element) => ({ text: element.textContent?.trim() ?? "", height: element.getBoundingClientRect().height })),
  );
}

for (const { path, label } of [
  { path: "/explorer/expenditure", label: "მენიუ" },
  { path: "/en/explorer/inflation/cities/batumi", label: "Menu" },
]) {
  test(`${path}: the explorer top bar stays pinned and opens a 44px-row menu`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    const bar = page.getByTestId("data-sidebar");
    const toggle = page.getByTestId("sidebar-toggle");
    await expect(toggle).toHaveAccessibleName(label);
    const toggleBox = await toggle.boundingBox();
    expect(toggleBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    const barHeight = (await bar.boundingBox())?.height ?? 0;
    expect(barHeight).toBeLessThanOrEqual(64);

    // Mid-page the menu must still be one tap away.
    await page.evaluate(() => window.scrollTo(0, 2000));
    await expect.poll(async () => (await toggle.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
    expect((await toggle.boundingBox())?.y ?? 99).toBeLessThan(20);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("#data-sidebar-navigation");
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect((panelBox?.y ?? 0) + (panelBox?.height ?? 0)).toBeLessThanOrEqual(844 + 1);

    for (const row of await heights(panel.locator("nav a, nav li:not(:has(a)), a[data-testid=sidebar-back-home], [data-testid=language-switch] a"))) {
      expect(row.height, row.text).toBeGreaterThanOrEqual(44);
    }
    const backHome = page.getByTestId("sidebar-back-home");
    expect((await backHome.boundingBox())?.width ?? 0).toBeGreaterThan(300);
    const teaserOpacity = await page.getByTestId("teaser-demography").evaluate((element) => Number(getComputedStyle(element).opacity));
    expect(teaserOpacity).toBeLessThan(1);

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
  });
}

test("tapping a menu link from mid-page closes the menu on arrival", async ({ page }) => {
  await page.goto("/explorer/expenditure");
  await ready(page);
  await page.evaluate(() => window.scrollTo(0, 1500));
  const toggle = page.getByTestId("sidebar-toggle");
  await toggle.click();
  await page.getByTestId("unemployment-link").click();
  await expect(page).toHaveURL(/\/explorer\/unemployment$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});
