import { expect, test, type Page } from "@playwright/test";

// Mobile polish (2026-10-07 review, owner decisions D8/D11 and the consistency
// items): search placeholders, series denominators, type floor, tap targets,
// word breaking and the phone legend, on a 390px phone.
test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

async function ready(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test.describe("search fields follow §7.7", () => {
  for (const { path, testId, placeholder } of [
    { path: "/explorer/deficit", testId: "series-search", placeholder: "ძებნა" },
    { path: "/explorer/inflation/products", testId: "series-search", placeholder: "ძებნა" },
    { path: "/explorer/inflation/products", testId: "product-list-search", placeholder: "ძებნა" },
    { path: "/explorer/unemployment/overview", testId: "series-search", placeholder: "ძებნა" },
    { path: "/explorer/unemployment/age", testId: "series-search", placeholder: "ძებნა" },
    { path: "/explorer/municipalities", testId: "municipal-search", placeholder: "ძებნა" },
    { path: "/en/explorer/unemployment/overview", testId: "series-search", placeholder: "Search" },
    { path: "/en/explorer/inflation/products", testId: "product-list-search", placeholder: "Search" },
  ]) {
    test(`${path} ${testId}: underline field with the shared placeholder`, async ({ page }) => {
      await page.goto(path);
      await ready(page);
      const field = page.getByTestId(testId).first();
      await expect(field).toHaveAttribute("placeholder", placeholder);
      const style = await field.evaluate((element) => {
        const css = getComputedStyle(element);
        return { top: css.borderTopWidth, bottom: css.borderBottomWidth, height: element.getBoundingClientRect().height };
      });
      expect(style).toEqual({ top: "0px", bottom: "1px", height: 34 });
    });
  }

  for (const [path, placeholder, name] of [
    ["/explorer/economy/regions", "ძებნა", "რეგიონის ძიება"],
    ["/en/explorer/economy/regions", "Search", "Search regions"],
  ] as const) {
    test(`${path}: region search is the underline field too`, async ({ page }) => {
      await page.goto(path);
      const field = page.getByRole("searchbox", { name, exact: true });
      await expect(field).toHaveAttribute("placeholder", placeholder);
      expect(await field.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
    });
  }
});

test("unemployment denominators count the top-level rows only (§7.7)", async ({ page }) => {
  await page.goto("/explorer/unemployment/gender");
  await ready(page);
  const status = page.getByTestId("series-status");
  const row = (id: string) => page.locator(`[data-series-id="${id}"]`);
  // Georgia, Men and Women are the three rows the list opens with.
  await expect(page.getByTestId("series-row-toggle")).toHaveCount(3);
  await expect(status).toContainText("3 / 3");
  await row("women:unemployment_rate").locator("button[aria-expanded]").click();
  await row("women:employment_rate").getByTestId("series-row-toggle").click();
  // A ticked row under a caret is reported on its own, never hidden in the top-level count.
  await expect(status).toContainText("3 / 3");
  await expect(status).toContainText("ქვეკატეგორიები 1");
  await page.getByTestId("series-toggle-all").click();
  await page.getByTestId("series-toggle-all").click();
  await expect(status).toHaveText(/3 \/ 3$/);
});
