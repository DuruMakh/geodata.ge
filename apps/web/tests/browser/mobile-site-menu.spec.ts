import { expect, test } from "@playwright/test";
import { DATASET_HUBS } from "../../lib/navigation/datasetHubs";

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
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const nav = header.getByRole("navigation", { includeHidden: false });
      // მთავარი, every group page (in place of the single budget-only data link), AI, მიზანი.
      await expect(nav.getByRole("link")).toHaveCount(DATASET_HUBS.length + 3);
      await expect(nav.getByRole("link").first()).toHaveAttribute("aria-current", "page");
      const languages = header.getByRole("group");
      await expect(languages).toBeVisible();
      await expect(languages).toContainText("KA");
      await expect(languages).toContainText("EN");
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
    await page.setViewportSize({ width: 390, height: 900 });
    await header.getByRole("button").click();
    await expect(header.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(header.locator("button")).toHaveAttribute("aria-expanded", "false");
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(header.getByRole("group")).toBeHidden();
  });
}

test("shared brand identity uses the full desktop lockup, the standalone mobile symbol and the compact footer logo", async ({ page, request }) => {
  for (const viewport of [
    { width: 1440, height: 900, asset: "fiscal-logo-horizontal.svg", minimumWidth: 280 },
    { width: 900, height: 900, asset: "fiscal-logo-horizontal.svg", minimumWidth: 280 },
    { width: 768, height: 900, asset: "icon.svg", minimumWidth: 44 },
    { width: 767, height: 900, asset: "icon.svg", minimumWidth: 44 },
    { width: 390, height: 844, asset: "icon.svg", minimumWidth: 44 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const logo = page.getByTestId("site-header-logo");
    await expect(logo).toBeVisible();
    const currentSrc = await logo.evaluate((image: HTMLImageElement) => image.currentSrc);
    expect(currentSrc).toContain(viewport.asset);
    const assetResponse = await request.get(currentSrc);
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect((await logo.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(viewport.minimumWidth);
    await expect(page.getByTestId("landing-header").getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true })).toHaveCount(1);
    await expect(logo).toHaveAttribute("alt", "");
  }

  // The shared footer uses the compact logo as its home link.
  const footer = page.getByTestId("site-footer");
  await expect(footer.getByTestId("site-footer-logo")).toHaveAttribute("src", "/brand/fiscal-logo-compact.svg");
  await expect(footer.getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true })).toHaveCount(1);
});

test.describe("explorer data sidebar", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tapping the current page closes the menu", async ({ page }) => {
    // All data, a group page and a section page: the link to the page you are on must still close the menu.
    for (const path of ["/explorer", "/en/explorer/economy", "/explorer/economy/gdp"]) {
      await page.goto(path);
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
      const toggle = page.getByTestId("sidebar-menu-button");
      await expect(toggle).toHaveAttribute("aria-controls", "data-sidebar-navigation");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page.locator(`#data-sidebar-navigation a[href="${path}"]`).click();
      await expect(toggle, path).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("#data-sidebar-navigation")).toBeHidden();
      expect(new URL(page.url()).pathname).toBe(path);
    }
  });

  // /explorer is All data now; Budget has its own group page.
  test("All data is current on /explorer", async ({ page }) => {
    for (const prefix of ["", "/en"]) {
      await page.goto(`${prefix}/explorer`);
      const allData = page.locator(`#data-sidebar-navigation a[href="${prefix}/explorer"]`);
      await expect(allData).toHaveAttribute("data-testid", "all-data-link");
      await expect(allData).toHaveAttribute("aria-current", "page");
      await expect(page.locator('#data-sidebar-navigation a[aria-current="page"]')).toHaveCount(1);
      // A section page is current in its own right; neither All data nor its group's own page is.
      await page.goto(`${prefix}/explorer/expenditure`);
      await expect(page.locator(`#data-sidebar-navigation a[href="${prefix}/explorer"]`)).not.toHaveAttribute("aria-current", "page");
      await expect(page.locator(`#data-sidebar-navigation a[href="${prefix}/explorer/budget"]`)).not.toHaveAttribute("aria-current", "page");
      await expect(page.getByTestId("section-link-expenditure")).toHaveAttribute("aria-current", "page");
    }
  });
});
