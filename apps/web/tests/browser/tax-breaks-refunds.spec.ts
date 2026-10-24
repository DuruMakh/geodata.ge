import { expect, test, type Page } from "@playwright/test";

const PATH = "/explorer/tax-breaks-refunds";
const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

for (const prefix of ["", "/en"]) {
  test(`tax breaks and refunds opens with both totals ${prefix || "ka"}`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${prefix}${PATH}`);
    await ready(page);
    await expect(page.locator("h1")).toHaveText(prefix ? "Tax breaks and refunds" : "საგადასახადო შეღავათები და დაბრუნება");
    await expect(page.getByTestId("tax-breaks-refunds-latest")).toContainText("2025");
    await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(2);
    await expect(page.locator(pressed("tax_breaks.total"))).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(pressed("tax_refunds.total"))).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-heading")).toHaveCount(4);
    await expect(page.getByTestId("year-range-strip")).toContainText("2008");
    await expect(page.getByTestId("year-range-strip")).toContainText("2025");
    expect(errors).toEqual([]);
  });
}

test("the % of GDP switch shows shares and names preliminary 2025 GDP", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  await page.getByRole("group", { name: "Measure" }).getByRole("button", { name: "Compared with GDP" }).click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-view", "gdp");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await expect(page.getByTestId("tax-breaks-refunds-unit-label")).toHaveText("%");
  await expect(page.getByTestId("tax-breaks-refunds-latest")).toContainText("2.6%");
  await expect(page.getByTestId("source-label")).toContainText("2025");
  expect(page.url()).toContain("tab=gdp");
  // The switch survives a reload.
  await page.reload();
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-view", "gdp");
});

test("tax breaks alone cover 2018-2024 and the table shows gaps as dashes", async ({ page }) => {
  await page.goto(`${PATH}#view=table&sel=tax_breaks.total,tax_refunds.total`);
  await ready(page);
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await expect(page.getByTestId("explorer-table").locator("tbody")).toContainText("—");
  await page.locator(pressed("tax_refunds.total")).click();
  await expect(page.getByTestId("year-range-strip")).toContainText("2018");
  await expect(page.getByTestId("year-range-strip")).not.toContainText("2008");
});

test("the Excel download starts", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  const promise = page.waitForEvent("download");
  await page.getByTestId("tax-breaks-refunds-excel-download").click();
  expect((await promise).suggestedFilename()).toBe("fiscal-tax-breaks-refunds-2008-2025-en.xlsx");
});

for (const prefix of ["", "/en"]) test(`the heading line stays on one line at 375px ${prefix || "ka"}`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${prefix}${PATH}`);
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const lines = await page.getByTestId("tax-breaks-refunds-latest").evaluate(element => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight));
  expect(lines).toBeLessThanOrEqual(1.6);
});

test("the Budget hub card and the sidebar link open the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer");
  const card = page.getByTestId("hub-card").nth(3);
  await expect(card).toContainText("შეღავათები და დაბრუნება");
  await expect(card).toContainText("2025 · დაბრუნება 2.7");
  await card.click();
  await expect(page).toHaveURL(new RegExp(`${PATH}$`));
  await ready(page);
  await page.getByTestId("section-link-revenue").click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await page.getByTestId("section-link-tax-breaks-refunds").click();
  await expect(page).toHaveURL(new RegExp(`${PATH}`));
});
