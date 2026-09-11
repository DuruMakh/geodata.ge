import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

for (const locale of ["ka", "en"] as const) {
  for (const width of [390, 768, 1440]) {
    test(`inflation overview layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${locale === "en" ? "/en" : ""}/explorer/inflation/overview`);
      await ready(page);
      await expect(page.getByTestId("inflation-tabs").getByRole("button")).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`inflation-${locale}-${width}.png`), fullPage: true });
      await page.getByTestId("chart-mode-table").click();
      await expect(page.getByTestId("month-grid")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // Desktop shows every month and the annual average without a hidden scroll.
      if (width === 1440) expect(await page.getByTestId("month-grid").evaluate((grid) => grid.scrollWidth <= grid.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`inflation-table-${locale}-${width}.png`), fullPage: true });
    });
  }
}

test("tabs switch units, series and the target together", async ({ page }) => {
  await page.goto("/en/explorer/inflation/overview");
  await ready(page);
  await expect(page.getByTestId("inflation-tab-yoy")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("inflation-unit")).toHaveText("Percent · change on the same month of the previous year");
  await expect(page.getByTestId("chart-series-target-dashed")).toHaveCount(1);
  await expect(page.getByTestId("inflation-headline")).toContainText("Annual inflation ·");

  await page.getByTestId("inflation-tab-index").click();
  await expect(page.getByTestId("inflation-unit")).toHaveText("Index · 2010 average = 100");
  await expect(page.getByTestId("chart-series-target-dashed")).toHaveCount(0);
  await expect(page.locator('[data-series-id="core"]')).toContainText("—");
  await expect(page.locator('[data-series-id="cpi"]')).toContainText("Consumer price index");
  await expect(page.getByRole("slider", { name: "Start month" })).toHaveAttribute("aria-valuetext", "Jan 2000");

  await page.getByTestId("inflation-tab-mom").click();
  await expect(page.getByTestId("inflation-headline")).toContainText(/Monthly inflation · [+−]?\d/);
});

test("range chips, keyboard steps and tab switches keep a consistent period", async ({ page }) => {
  await page.goto("/en/explorer/inflation/overview");
  await ready(page);
  await expect(page.getByRole("button", { name: "1y", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "5y", exact: true }).click();
  await expect(page).toHaveURL(/r=\d{4}-\d{2}-\d{4}-\d{2}/);
  const start = page.getByRole("slider", { name: "Start month" });
  const before = await start.getAttribute("aria-valuenow");
  await start.focus();
  await page.keyboard.press("PageDown");
  await expect(start).toHaveAttribute("aria-valuenow", String(Number(before) - 12));
  await page.keyboard.press("ArrowRight");
  await expect(start).toHaveAttribute("aria-valuenow", String(Number(before) - 11));

  await page.getByTestId("inflation-tab-index").click();
  await expect(page).toHaveURL(/r=/);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).not.toHaveURL(/r=/);
  await page.getByTestId("inflation-tab-yoy").click();
  await expect(start).toHaveAttribute("aria-valuetext", "Jan 2004");
});

test("the table picks one series, restores from the hash and downloads", async ({ page }) => {
  await page.goto("/en/explorer/inflation/overview");
  await ready(page);
  await page.locator('[data-series-id="core"]').getByTestId("series-row-toggle").click();
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("month-grid-legend-step")).toHaveCount(5);
  await expect(page.getByTestId("month-grid")).toContainText("Annual average");
  await page.getByTestId("inflation-table-series-core").click();
  await expect(page).toHaveURL(/t=core/);
  await expect(page.getByTestId("month-grid")).not.toContainText("Annual average");

  await page.reload();
  await ready(page);
  await expect(page.getByTestId("inflation-table-series-core")).toHaveAttribute("aria-pressed", "true");
  const download = page.waitForEvent("download");
  await page.getByTestId("inflation-download").click();
  expect((await download).suggestedFilename()).toMatch(/^fiscal-inflation-yoy-\d{4}-\d{2}-\d{4}-\d{2}-en\.xlsx$/);
});

test("clearing the selection disables the chart and the download", async ({ page }) => {
  await page.goto("/explorer/inflation/overview");
  await ready(page);
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("inflation-download")).toBeDisabled();
});

test("language switch keeps the state", async ({ page }) => {
  await page.goto("/explorer/inflation/overview#i=mom&m=table&sel=cpi");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/en\/explorer\/inflation\/overview#.*i=mom/);
  await expect(page.getByTestId("inflation-tab-mom")).toHaveAttribute("aria-pressed", "true");
});

test("the sidebar lists three datasets and the hub links only the overview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/inflation");
  await expect(page.getByTestId("inflation-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("inflation-hub").getByTestId("hub-card")).toHaveCount(5);
  await expect(page.getByTestId("inflation-hub").locator("a")).toHaveCount(1);
  // Budget and Economy stay inactive; the footer names both publishers.
  await expect(page.getByTestId("section-link-expenditure")).toHaveCount(0);
  await expect(page.getByTestId("economy-link")).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByText("მონაცემები: საქსტატი და საქართველოს ეროვნული ბანკი", { exact: false })).toBeVisible();
  await page.getByTestId("inflation-hub").getByRole("link").click();
  await ready(page);
  await expect(page.getByTestId("inflation-overview-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("data-sidebar").getByText("მალე", { exact: true })).toHaveCount(2);
});

test("the methodology Dataset is the node the catalog references", async ({ page }) => {
  await page.goto("/methodology");
  const catalog = JSON.parse((await page.getByTestId("catalog-json-ld").textContent()) ?? "{}");
  const id = "https://fiscal.ge/methodology/inflation";
  expect(catalog.dataset.map((entry: { "@id": string }) => entry["@id"])).toContain(id);
  await page.goto("/en/methodology/inflation");
  const dataset = JSON.parse((await page.getByTestId("dataset-json-ld").textContent()) ?? "{}");
  expect(dataset["@id"]).toBe(id);
  expect(dataset.includedInDataCatalog["@id"]).toBe("https://fiscal.ge/methodology#catalog");
  expect(dataset.distribution.contentUrl).toBe("https://fiscal.ge/downloads/data/inflation-cpi-national.csv");
});

for (const locale of ["ka", "en"] as const) {
  test(`chart axis labels stay inside the frame in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${locale === "en" ? "/en" : ""}/explorer/inflation/overview`);
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    for (const label of await page.getByTestId("chart-panel").locator("svg text").all()) {
      expect(await label.evaluate((element) => (element as SVGGraphicsElement).getBBox().x)).toBeGreaterThanOrEqual(0);
    }
  });
}
