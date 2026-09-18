import { expect, test } from "@playwright/test";

// Opening a page must not rewrite its URL: a stamped default hash turns every
// plain link into a deep link. Pages still write the hash once the reader acts.
for (const path of [
  "/en/explorer/economy/gdp",
  "/en/explorer/inflation/overview",
  "/en/explorer/inflation/categories",
  "/en/explorer/economy/sectors",
]) {
  test(`opening ${path} leaves the URL without a hash`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    // Let the post-hydration effects run before reading the URL.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => window.location.hash)).toBe("");
  });
}
