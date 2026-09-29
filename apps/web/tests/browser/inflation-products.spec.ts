import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const ROUTE = "/explorer/inflation/products";
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

for (const locale of ["ka", "en"] as const) {
  for (const width of [390, 1440]) {
    test(`product inflation layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${locale === "en" ? "/en" : ""}${ROUTE}`);
      await ready(page);
      await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-indicator", "annual");
      await expect(page.getByTestId("product-cumulative-toggle")).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByTestId("series-status")).toContainText("1 / 305");
      await expect(page.getByTestId("product-indicators")).toBeVisible();
      await expect(page.getByTestId("product-list").getByRole("heading", { name: locale === "en" ? "Browse products" : "პროდუქტების სია" })).toBeVisible();
      await expect(page.getByTestId("product-list-search")).toBeVisible();
      await expect(page.getByTestId("product-list-count")).toHaveCount(0);
      await expect(page.getByTestId("series-row").first()).toHaveAttribute("data-series-id", "cpi.product.p0058");
      expect(await page.getByTestId("product-list").evaluate((section) => getComputedStyle(section).borderTopWidth)).toBe("0px");
      await expect(page.locator('[data-series-id="cpi.product.p0058"]')).toHaveAttribute("data-series-id", "cpi.product.p0058");
      await expect(page.getByTestId("inflation-products-link")).toHaveAttribute("aria-current", "page");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const icon = page.locator('[data-series-id="cpi.product.p0058"] img');
      expect(await icon.evaluate((image) => Math.round(image.getBoundingClientRect().width))).toBe(32);
      if (width === 390) {
        const region = (await page.getByTestId("product-table").boundingBox())!;
        const cumulativeCell = (await page.getByTestId("product-table").locator("tbody tr").first().locator("td").nth(1).boundingBox())!;
        // A phone should show the product and its selected-years cumulative value before a horizontal swipe.
        expect(cumulativeCell.x + cumulativeCell.width).toBeLessThanOrEqual(region.x + region.width + 1);
      }
      await page.screenshot({ path: testInfo.outputPath(`products-${locale}-${width}.png`), fullPage: true });
    });
  }
}

test("annual default, bilingual search, multi-selection and icon-only cumulative toggle", async ({ page }) => {
  await page.goto(`/en${ROUTE}`);
  await ready(page);
  const toggle = page.getByTestId("product-cumulative-toggle");
  await expect(toggle).toHaveAttribute("aria-label", "Show cumulative price change");
  expect((await toggle.textContent())?.trim()).toBe("");
  await toggle.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Show cumulative price change");
  const search = page.getByTestId("series-search");
  await search.fill("  ToMaTo  ");
  await expect(page.getByTestId("series-row")).toHaveCount(2);
  await expect(page.getByTestId("series-status")).toContainText("1 / 305");
  await search.fill("  პომიდორი  ");
  await expect(page.getByTestId("series-row")).toHaveCount(1);
  await search.fill("rice");
  await page.locator('[data-series-id="cpi.product.p0001"]').getByTestId("series-row-toggle").click();
  await expect(page.getByTestId("series-status")).toContainText("2 / 305");
  await expect(page.getByTestId("product-indicators")).toContainText("Rice");
  await expect(page.getByTestId("product-table").locator("tbody tr")).toHaveCount(40);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("aria-label", "Show annual inflation");
  await expect(page.getByTestId("chart-panel")).toContainText("Cumulative price change");
  await expect(page).toHaveURL(/i=cumulative/);
});

test("the lower list searches all products independently of the chart selector", async ({ page }) => {
  await page.goto(`/en${ROUTE}`);
  await ready(page);
  const listRows = page.getByTestId("product-table").locator("tbody tr");
  const listSearch = page.getByTestId("product-list-search");
  const selectorSearch = page.getByTestId("series-search");
  const firstBeforeSearch = await listRows.first().getAttribute("data-product-id");
  await page.getByTestId("product-more").click();
  await expect(listRows).toHaveCount(80);
  await selectorSearch.fill("rice");
  await listSearch.fill("  Coffee   cup with saucer  ");
  await expect(listRows).toHaveCount(1);
  await expect(listRows.first()).toHaveAttribute("data-product-id", "cpi.product.p0179");
  await expect(page.getByTestId("product-more")).toHaveCount(0);
  await expect(selectorSearch).toHaveValue("rice");
  await expect(page.getByTestId("series-status")).toContainText("1 / 305");
  await listSearch.fill("  ყავის ფინჯანი ლამბაქით  ");
  await expect(listRows.first()).toHaveAttribute("data-product-id", "cpi.product.p0179");
  await listSearch.fill("პომიდორი");
  await expect(listRows.first()).toHaveAttribute("data-product-id", "cpi.product.p0058");
  await expect(listRows.first().locator("td").nth(1)).toContainText("−26.6%");
  await expect(listRows.first().locator("td").nth(2)).toContainText("+57.5%");
  await listSearch.fill("no-such-product");
  await expect(listRows).toHaveCount(0);
  await expect(page.getByTestId("product-list-empty")).toBeVisible();
  await listSearch.fill("");
  await expect(listRows).toHaveCount(40);
  await expect(listRows.first()).toHaveAttribute("data-product-id", firstBeforeSearch!);
});

test("year controls, late history, empty selection and language restoration", async ({ page }) => {
  await page.goto(`/en${ROUTE}#i=cumulative&r=2015-2026&sel=cpi.product.p0179`);
  await ready(page);
  await expect(page.getByTestId("product-cumulative-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("product-indicators")).toContainText("history starts 2019-01");
  await page.getByTestId("language-switch").first().getByRole("link", { name: "ქართული" }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/explorer\/inflation\/products#.*i=cumulative/);
  await expect(page.getByTestId("product-cumulative-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("product-cumulative-toggle").click();
  await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);
  await page.getByRole("button", { name: "ყველა", exact: true }).click();
  await expect(page.getByRole("slider", { name: "საწყისი წელი" })).toHaveAttribute("aria-valuenow", "2015");
  const start = page.getByRole("slider", { name: "საწყისი წელი" });
  await start.focus();
  await page.keyboard.press("End");
  await expect(start).toHaveAttribute("aria-valuenow", "2026");
  await expect(page.getByTestId("year-range-strip")).toContainText("2026–2026");
  await page.goto(`/en${ROUTE}#i=annual&r=2023-2026&sel=`);
  await ready(page);
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("inflation-product-download")).toBeEnabled();
  expect(new URL(page.url()).hash).toContain("sel=");
});

test("a mixed cumulative selection names the omitted product and marks the focused product", async ({ page }) => {
  await page.goto(`/en${ROUTE}#i=cumulative&r=2015-2026&sel=cpi.product.p0179,cpi.product.p0058`);
  await ready(page);
  await expect(page.getByTestId("product-chart-summary")).toContainText("Product lines shown: 1");
  await expect(page.getByTestId("product-chart-omissions")).toContainText("Coffee cup with saucer — history starts 2019-01");
  const tomato = page.locator('[data-series-id="cpi.product.p0058"]');
  const coffee = page.locator('[data-series-id="cpi.product.p0179"]');
  await expect(tomato).toContainText("Focus");
  await expect(coffee).not.toContainText("Focus");
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await coffee.getByTestId("series-row-toggle").click();
  await expect(page.getByTestId("product-chart-omissions")).toHaveCount(0);
  await coffee.getByTestId("series-row-toggle").click();
  await expect(coffee).toContainText("Focus");
  await expect(tomato).not.toContainText("Focus");
});

test("the complete list is reachable in descending cumulative order", async ({ page }) => {
  await page.goto(`/en${ROUTE}#i=cumulative&r=2015-2016&sel=`);
  await ready(page);
  const list = page.getByTestId("product-table");
  await expect(list.locator("tbody tr")).toHaveCount(40);
  const headers = await list.locator("thead th").allTextContents();
  expect(headers[1]).toContain("Cumulative change");
  expect(headers[2]).toContain("Latest 12-month change");
  for (let shown = 80; shown <= 320; shown += 40) {
    await page.getByTestId("product-more").click();
    await expect(list.locator("tbody tr")).toHaveCount(Math.min(shown, 305));
  }
  await expect(list.locator("tbody tr")).toHaveCount(305);
  const values = await list.locator("tbody tr td:nth-child(2)").allTextContents();
  let previous = Infinity;
  let unavailable = false;
  for (const text of values) {
    const match = /^\s*([+−-]?\d[\d,]*(?:\.\d+)?)%/.exec(text);
    if (!match) { unavailable = true; continue; }
    expect(unavailable).toBe(false);
    const value = Number(match[1]!.replace("−", "-").replaceAll(",", ""));
    expect(value).toBeLessThanOrEqual(previous);
    previous = value;
  }
  expect(unavailable).toBe(true);
  await expect(list.locator('tr[data-product-id="cpi.product.p0305"]')).toHaveCount(1);
  await expect(page.getByTestId("product-more")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("an empty selection downloads a valid full Summary workbook", async ({ page }, testInfo) => {
  await page.goto(`/en${ROUTE}#i=annual&r=2023-2026&sel=`);
  await ready(page);
  const pending = page.waitForEvent("download");
  await page.getByTestId("inflation-product-download").click();
  const result = await pending;
  expect(result.suggestedFilename()).toMatch(/^fiscal-inflation-products-2023-2026-08-en\.xlsx$/);
  const output = testInfo.outputPath("products-empty.xlsx");
  await result.saveAs(output);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(output);
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(workbook.worksheets[0]!.getCell("B4").value).toBeCloseTo(0.575291);
  expect(workbook.worksheets[0]!.getCell("B4").numFmt).toBe("0.0%");
  expect(workbook.worksheets[0]!.rowCount).toBeGreaterThan(305);
  expect(workbook.worksheets[1]!.rowCount).toBe(1);
  expect(workbook.worksheets[2]!.getCell("D4").hyperlink).toMatch(/^https:\/\/fiscal\.ge\/downloads\//);
});

test("all 305 selected products produce a complete full-history workbook", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const ids = Array.from({ length: 305 }, (_, offset) => `cpi.product.p${String(offset + 1).padStart(4, "0")}`);
  await page.goto(`/en${ROUTE}#i=annual&r=2015-2026&sel=${ids.join(",")}`);
  await ready(page);
  await expect(page.getByTestId("series-status")).toContainText("305 / 305");
  const pending = page.waitForEvent("download");
  await page.getByTestId("inflation-product-download").click();
  const result = await pending;
  const output = testInfo.outputPath("products-all.xlsx");
  await result.saveAs(output);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(output);
  expect(workbook.worksheets[0]!.rowCount).toBeGreaterThan(305);
  expect(workbook.worksheets[1]!.rowCount).toBeGreaterThan(40_000);
});
