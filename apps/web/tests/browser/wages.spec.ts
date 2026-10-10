import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`wages hub and pages render ${prefix || "ka"} at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/wages`);
    const hub = page.getByTestId("wages-hub");
    await expect(hub.locator("a")).toHaveCount(3);
    await expect(hub.locator("a").first()).toHaveAttribute("href", `${prefix}/explorer/wages/overview`);
    for (const section of ["overview", "industries", "regions"]) {
      await page.goto(`${prefix}/explorer/wages/${section}`);
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
      await expect(page.getByTestId("wages-nominal-note")).toBeVisible();
      if (section !== "regions") await expect(page.getByTestId("series-status")).toContainText("1 /");
      await page.screenshot({ path: info.outputPath(`wages-${section}-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test("overview defaults to the Georgia average with the 2025 figures from Geostat's release", async ({ page }) => {
  await page.goto("/en/explorer/wages/overview");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("wages-latest")).toContainText("2,165.2");
  await expect(page.locator(pressed("average"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("median"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("year-range-strip")).toContainText("1995–2025");
  await page.locator(pressed("median")).click();
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toContainText("1,531");
  await page.getByTestId("wages-tab-ownership").click();
  await expect(page.locator(pressed("public"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(pressed("average"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.getByTestId("wages-tab-business_sector")).toHaveCount(0);
  await page.getByTestId("wages-tab-sex").click();
  await expect(page.locator(pressed("women"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(pressed("men"))).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toContainText("1999–2025");
  await page.goBack();
  await page.goBack();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-view", "overview");
});

test("industries group, heatmap, table and workbook agree", async ({ page }) => {
  await page.goto("/en/explorer/wages/industries#tab=public&view=table&sel=total,sector.b&start=2024&end=2025");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("wages-group")).toHaveValue("public");
  await expect(page.getByTestId("wages-group").locator("option")).toHaveCount(8);
  const heatmap = page.getByTestId("wages-industry-heatmap");
  await expect(heatmap.locator("thead th")).toHaveCount(3);
  await expect(heatmap.locator('[data-heatmap-cell="sector.b:2025"]')).toHaveText("—");
  const table = page.getByTestId("explorer-table");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const promise = page.waitForEvent("download"); await page.getByTestId("wages-excel-download").click();
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await (await promise).path())!);
  expect(workbook.worksheets).toHaveLength(3);
  expect(workbook.getWorksheet("Sources")!.getCell("D4").value).toMatchObject({ hyperlink: expect.stringMatching(/^https:\/\/fiscal\.ge\/downloads\/methodology\/wages\/files\//) });
  await page.getByTestId("wages-group").selectOption("business");
  await expect(page.locator('[data-series-id="sector.k"]')).toHaveCount(0);
  await expect(page.locator(pressed("total"))).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.getByTestId("wages-group")).toHaveValue("business");
  await expect(page.getByTestId("year-range-strip")).toContainText("2024–2025");
});

test("the regions index opens each region's own page", async ({ page }) => {
  await page.goto("/en/explorer/wages/regions");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("chart-panel")).toHaveCount(0);
  const index = page.getByTestId("wages-regions-index");
  await expect(index.getByTestId("regional-list-row")).toHaveCount(11);
  await index.locator('[data-testid="regional-list-row"][data-region-id="region.adjara"]').click();
  await expect(page).toHaveURL(/\/en\/explorer\/wages\/regions\/adjara$/);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.locator("h1")).toContainText("Adjara");
  await expect(page.locator(pressed("region.adjara"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("average"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2025");
  await page.getByTestId("wages-region-navigation").getByRole("link").last().click();
  await expect(page).toHaveURL(/\/en\/explorer\/wages\/regions\/guria$/);
  await page.goto("/explorer/wages/regions");
  await page.getByTestId("wages-region-map").locator('a[data-region-id="region.imereti"]').click({ force: true });
  await expect(page).toHaveURL(/\/explorer\/wages\/regions\/imereti$/);
});
