import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

const DEFAULTS = ["total", "social_benefits", "investment", "compensation", "subsidies", "goods_services", "interest"].map(id => `spending_type.${id}`);
const pressed = '[data-testid="series-row-toggle"][aria-pressed="true"]';
const row = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;

for (const width of [375, 1440]) {
  test(`opens on total spending and six main types, listed under headings, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/explorer/expenditure-types");
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("ხარჯები ეკონომიკური კლასიფიკაციით");
    await expect(page.locator(pressed)).toHaveCount(7);
    for (const id of DEFAULTS) await expect(page.locator(row(id))).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-row-toggle")).toHaveCount(10);
    for (const heading of ["მიმდინარე ხარჯები", "ინვესტიციები"]) await expect(page.getByRole("complementary").getByText(heading, { exact: true })).toBeVisible();
    await expect(page.getByTestId("sector-highlights")).toHaveCount(0);
    await expect(page.getByTestId("economic-sectors-explorer").getByRole("tablist")).toHaveCount(0);
    const headline = page.getByTestId("sectors-headline");
    expect(await headline.evaluate((line) => line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight))).toBeLessThanOrEqual(1.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("offers amounts and share of GDP only; the share view keeps the total and heads with its share", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 1000 });
  await page.goto("/en/explorer/expenditure-types");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByRole("button", { name: "Real growth %", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "% of GDP", exact: true }).click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "share_of_gdp");
  await expect(page.locator(row("spending_type.total"))).toHaveAttribute("aria-pressed", "true");
  const headline = page.getByTestId("sectors-headline");
  await expect(headline).toHaveText("Spending · 2025: 28.4% · Preliminary");
  expect(await headline.evaluate((line) => line.getBoundingClientRect().height / parseFloat(getComputedStyle(line).lineHeight))).toBeLessThanOrEqual(1.1);
});

test("the table lists the selected types for the chosen years", async ({ page }) => {
  await page.goto("/en/explorer/expenditure-types#view=table&sel=spending_type.total,spending_type.interest&start=2002&end=2002");
  const table = page.getByTestId("explorer-table");
  await expect(table.locator("tbody tr", { hasText: "Total spending" })).toBeVisible();
  await expect(table.locator("tbody tr", { hasText: "Interest" })).toBeVisible();
});

test("the workbook carries the page's name, its rows and the archived original", async ({ page }, info) => {
  await page.goto("/en/explorer/expenditure-types#measure=nominal&sel=spending_type.total&start=2025&end=2025");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const pending = page.waitForEvent("download");
  await page.getByTestId("sectors-excel-download").click();
  const download = await pending, filename = info.outputPath(download.suggestedFilename());
  expect(download.suggestedFilename()).toMatch(/^fiscal-expenditure-types-nominal-2025-2025-en\.xlsx$/);
  await download.saveAs(filename);
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(filename);
  expect(book.worksheets.map(s => s.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(book.worksheets[0].getCell("B4").value).toBeCloseTo(29.7438, 4);
  expect(JSON.stringify(book.worksheets[2].model)).toContain("/downloads/methodology/expenditure-types/files/");
});

test("the Budget hub card, the sidebar and the methodology page reach the new page and its original", async ({ page }) => {
  await page.goto("/en/explorer");
  const card = page.getByRole("main").locator('a[href="/en/explorer/expenditure-types"]');
  await expect(card).toContainText("Spending by type");
  await expect(card).toContainText("2025");
  await page.goto("/en/explorer/expenditure");
  await page.getByTestId("section-link-expenditure-types").click();
  await expect(page).toHaveURL(/\/en\/explorer\/expenditure-types$/);
  await page.goto("/en/methodology/expenditure-types");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Spending by type");
  await expect(page.locator('a[href*="/downloads/methodology/expenditure-types/files/"]')).toHaveCount(1);
});
