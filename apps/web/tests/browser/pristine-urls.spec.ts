import { expect, test } from "@playwright/test";

// Opening a page must not rewrite its URL: a stamped default hash turns every
// plain link into a deep link. Pages still write the hash once the reader acts.
for (const path of ["", "/en"].flatMap((prefix) => [
  `${prefix}/explorer/economy/gdp`,
  `${prefix}/explorer/inflation/overview`,
  `${prefix}/explorer/inflation/categories`,
  `${prefix}/explorer/economy/sectors`,
  // Their opening comparison (Men and Women; two age groups) is a default, not state.
  `${prefix}/explorer/unemployment/gender`,
  `${prefix}/explorer/unemployment/age`,
  `${prefix}/explorer/demography/population`,
  `${prefix}/explorer/demography/migration`,
  `${prefix}/explorer/demography/births-deaths`,
  `${prefix}/explorer/demography/age-sex`,
  `${prefix}/explorer/demography/marriages-divorces`,
  `${prefix}/explorer/demography/population/georgia`,
  `${prefix}/explorer/demography/population/region/adjara`,
  `${prefix}/explorer/demography/population/batumi`,
])) {
  test(`opening ${path} leaves the URL without a hash`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    // Let the post-hydration effects run before reading the URL.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => window.location.hash)).toBe("");
  });
}

// An explicitly empty selection is state of its own: it survives a click and Back (each page has its own
// state parser, so each is checked; moved from trade-partners, wages and money-from-abroad).
for (const { path, seriesId } of [
  { path: "/en/explorer/trade/partners#sel=&view=line&tab=countries&measure=trade.exports", seriesId: "goods.total" },
  { path: "/en/explorer/wages/overview#view=line&sel=", seriesId: "average" },
  { path: "/en/explorer/external/money-from-abroad#measure=received&view=line&sel=", seriesId: "transfer.total" },
]) {
  test(`an explicitly empty selection and Back restore the same view: ${path.split("#")[0]}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await page.locator(`[data-series-id="${seriesId}"]`).getByTestId("series-row-toggle").click();
    await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  });
}
