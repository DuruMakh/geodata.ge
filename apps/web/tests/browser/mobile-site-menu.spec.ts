import { expect, test } from "@playwright/test";

for (const locale of ["ka", "en"] as const) {
  for (const width of [320, 390, 768, 899]) {
    test(`${locale} compact header and menu at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(locale === "en" ? "/en?preview=menu#data" : "/?preview=menu#data");
      const header = page.getByTestId("landing-header");
      const toggle = header.getByRole("button", { name: locale === "en" ? "Menu" : "მენიუ", exact: true });
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(header.getByRole("navigation")).toBeHidden();
      await expect(header.getByRole("group")).toBeHidden();
      expect((await header.boundingBox())!.height).toBeLessThanOrEqual(64);
      if (width === 390) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `../../.tmp/bilingual/mobile-menu-${locale}-closed.png` });
      }
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const nav = header.getByRole("navigation", { includeHidden: false });
      // მთავარი, the five datasets (in place of the single budget-only data link), AI, მიზანი.
      await expect(nav.getByRole("link")).toHaveCount(8);
      await expect(nav.getByRole("link").first()).toHaveAttribute("aria-current", "page");
      const languages = header.getByRole("group");
      await expect(languages).toBeVisible();
      await expect(languages).toContainText("KA");
      await expect(languages).toContainText("EN");
      if (width === 390) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `../../.tmp/bilingual/mobile-menu-${locale}-open.png` });
      }
      await page.keyboard.press("Tab");
      await expect(nav.getByRole("link").first()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await languages.getByRole("link").click();
      await expect(page).toHaveURL(locale === "en" ? /\/\?preview=menu#data$/ : /\/en\?preview=menu#data$/);
      await expect(page.getByTestId("landing-header").getByRole("button")).toHaveAttribute("aria-expanded", "false");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }

  test(`${locale} desktop navigation stays centered and resizing closes the mobile menu`, async ({ page }) => {
    await page.goto(locale === "en" ? "/en" : "/");
    const header = page.getByTestId("landing-header");
    for (const width of [900, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(header.getByRole("button")).toBeHidden();
      await expect(header.getByRole("group")).toBeVisible();
      const box = (await header.boundingBox())!;
      const nav = (await header.getByRole("navigation").boundingBox())!;
      expect(Math.abs(nav.x + nav.width / 2 - box.x - box.width / 2)).toBeLessThan(1);
    }
    await page.screenshot({ path: `../../.tmp/bilingual/mobile-menu-${locale}-desktop.png` });
    await page.setViewportSize({ width: 390, height: 900 });
    await header.getByRole("button").click();
    await expect(header.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(header.locator("button")).toHaveAttribute("aria-expanded", "false");
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(header.getByRole("group")).toBeHidden();
  });
}
