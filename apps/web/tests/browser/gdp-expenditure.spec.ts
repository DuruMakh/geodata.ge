import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

const DEFAULTS = ["economy.gdp_total", "gdp_use.households", "gdp_use.government", "gdp_use.investment", "gdp_use.exports", "gdp_use.imports"];
const pressed = '[data-testid="series-row-toggle"][aria-pressed="true"]';
const row = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;

for (const width of [390, 1440]) {
  test(`opens on GDP and its five main parts, listed under headings, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/explorer/economy/expenditure");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("მშპ დანახარჯების მიხედვით");
    await expect(page.locator(pressed)).toHaveCount(6);
    for (const id of DEFAULTS) await expect(page.locator(row(id))).toHaveAttribute("aria-pressed", "true");
    // Sixteen rows: every amount row; the combined households line has no amounts.
    await expect(page.getByTestId("series-row-toggle")).toHaveCount(16);
    for (const heading of ["მოხმარება", "ინვესტიცია", "ექსპორტი", "იმპორტი"]) await expect(page.getByRole("complementary").getByText(heading, { exact: true })).toBeVisible();
    await expect(page.getByTestId("sector-highlights")).toHaveCount(0);
    await expect(page.getByTestId("economic-sectors-explorer").getByRole("tablist")).toHaveCount(0);
    const headline = page.getByTestId("sectors-headline");
    expect(await headline.evaluate((line) => line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight))).toBeLessThanOrEqual(1.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("real growth swaps households for the combined line and back, and lists only rows with growth", async ({ page }) => {
  await page.goto("/en/explorer/economy/expenditure");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.getByRole("button", { name: "Real growth %", exact: true }).click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "real_growth");
  await expect(page.locator(row("gdp_use.households_npish"))).toHaveAttribute("aria-pressed", "true");
  for (const id of ["gdp_use.households", "gdp_use.npish", "gdp_use.inventories"]) await expect(page.locator(row(id))).toHaveCount(0);
  await expect(page.getByTestId("series-row-toggle")).toHaveCount(14);
  await expect(page.getByText("Households and non-profits are combined.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Value in GEL", exact: true }).click();
  await expect(page.locator(pressed)).toHaveCount(6);
  await expect(page.locator(row("gdp_use.households"))).toHaveAttribute("aria-pressed", "true");
});

test("the share view's line is household consumption's share of GDP", async ({ page }) => {
  await page.goto("/en/explorer/economy/expenditure");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await page.getByRole("button", { name: "% of GDP", exact: true }).click();
  await expect(page.getByTestId("sectors-headline")).toHaveText("Household consumption · 2025: 69.1% · Preliminary");
  await expect(page.getByText("Because of imports, the shares do not add up to 100%.", { exact: false })).toBeVisible();
});

test("negative inventories show as negative values in the table", async ({ page }) => {
  await page.goto("/en/explorer/economy/expenditure#view=table&sel=gdp_use.inventories&start=2017&end=2017");
  await expect(page.getByTestId("explorer-table").locator("tbody tr", { hasText: "Change in inventories" })).toContainText("−");
});

test("the workbook carries the page's name, its rows and the archived originals", async ({ page }, info) => {
  await page.goto("/en/explorer/economy/expenditure#measure=nominal&sel=gdp_use.households&start=2025&end=2025");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const pending = page.waitForEvent("download");
  await page.getByTestId("sectors-excel-download").click();
  const download = await pending, filename = info.outputPath(download.suggestedFilename());
  expect(download.suggestedFilename()).toMatch(/^fiscal-gdp-expenditure-nominal-2025-2025-en\.xlsx$/);
  await download.saveAs(filename);
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(filename);
  expect(book.worksheets.map(s => s.name)).toEqual(["Summary", "Data", "Sources"]);
  const cell = book.worksheets[0].getCell("B4");
  expect(cell.value).toBeCloseTo(72.26749753651864, 10);
  expect(cell.numFmt).toContain("Preliminary");
  expect(JSON.stringify(book.worksheets[2].model)).toContain("/downloads/methodology/gdp-expenditure/files/");
});

test("the sidebar and the methodology page reach the new page and its three originals", async ({ page }) => {
  await page.goto("/en/explorer/economy");
  await page.getByTestId("economy-expenditure-link").click();
  await expect(page).toHaveURL(/\/en\/explorer\/economy\/expenditure$/);
  await page.goto("/en/methodology/gdp-expenditure");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("GDP by expenditure");
  await expect(page.locator('a[href*="/downloads/methodology/gdp-expenditure/files/"]')).toHaveCount(3);
});
