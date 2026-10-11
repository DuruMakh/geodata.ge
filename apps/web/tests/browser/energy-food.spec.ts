import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const SECTIONS = ["energy-supply", "electricity", "energy-use", "food-self-sufficiency"] as const;
const toggle = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const caret = (id: string) => `[data-series-id="${id}"] [aria-expanded]`;
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

test("the hub shows one card per page, each linking to it", async ({ page }) => {
  await page.goto("/explorer/energy-food");
  const cards = page.getByTestId("energy-food-hub").locator("a");
  await expect(cards).toHaveCount(4);
  for (const [index, section] of SECTIONS.entries()) await expect(cards.nth(index)).toHaveAttribute("href", `/explorer/energy-food/${section}`);
});

for (const prefix of ["", "/en"]) {
  test(`every ${prefix || "ka"} page shows no page tabs, selects only its total and fits 390px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 900 });
    for (const section of SECTIONS) {
      await page.goto(`${prefix}/explorer/energy-food/${section}`);
      await ready(page);
      await expect(page.getByTestId(`energy-food-${section}`)).toBeVisible();
      await expect(page.locator('[data-testid^="energy-food-tab"]')).toHaveCount(0);
      await expect(page.getByTestId("series-status")).toContainText("1 /");
      await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test("energy supply defaults to domestic supply and states the latest supply and imports", async ({ page }) => {
  await page.goto("/en/explorer/energy-food/energy-supply");
  await ready(page);
  await expect(page.getByTestId("energy-food-latest")).toHaveText("Energy supply · 2024: 5,914.5 · imports 5,099.0");
  await expect(page.locator(toggle("energy.supply.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(toggle("energy.production.total"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("series-status")).toContainText("1 / 4");
  await expect(page.getByTestId("source-label")).toContainText("Energy Balance of Georgia");
  await expect(page.getByTestId("source-label").getByRole("link")).toHaveAttribute("href", "/en/methodology/energy-food");
});

test("electricity supply 2023 is negative in the table (Review Focus 3)", async ({ page }) => {
  await page.goto("/en/explorer/energy-food/energy-supply");
  await ready(page);
  await page.locator(caret("energy.supply.total")).click();
  await page.locator(toggle("energy.supply.electricity")).click();
  await expect(page.getByTestId("series-status")).toContainText("1 / 4");
  const start = page.getByTestId("range-start-handle");
  for (let presses = 0; await start.getAttribute("aria-valuenow") !== "2022"; presses++) {
    expect(presses, "the start handle should reach 2022 within 20 presses").toBeLessThan(20);
    await start.press("ArrowRight");
  }
  // The axis reaches below zero rather than clipping the 2023 value.
  await expect(page.getByTestId("chart-panel").getByText("−2,500", { exact: true })).toHaveCount(1);
  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  await expect(table.locator("thead")).toContainText("2022");
  await expect(table.locator("thead")).not.toContainText("2021");
  const electricity = table.locator("tbody tr", { hasText: "Electricity" });
  await expect(electricity).toContainText("−58.3");
  await expect(page).toHaveURL(/start=2022/);
});

test("electricity keeps the wind gap before 2016 as a chart, not the empty callout (Review Focus 4)", async ({ page }) => {
  await page.goto("/en/explorer/energy-food/electricity#start=2013&end=2015&sel=electricity.production.total,electricity.production.wind");
  await ready(page);
  await expect(page.getByTestId("energy-food-latest")).toHaveText("Electricity production · 2024: 14,234.1 GWh · imports 2,301.8 · exports 2,121.7");
  await expect(page.locator(toggle("electricity.production.wind"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);
  await expect(page.getByTestId("chart-panel").locator("svg").first()).toBeVisible();
  // The panel names the unit; axis ticks carry numbers only.
  await expect(page.getByTestId("chart-panel").locator("svg").first()).not.toContainText("GWh");
  await page.getByTestId("chart-mode-table").click();
  const wind = page.getByTestId("explorer-table").locator("tbody tr", { hasText: "Wind plants" });
  await expect(wind).toContainText("—");
  await expect(wind).not.toContainText(/\b0\.0\b/);
});

test("energy use states the latest final use", async ({ page }) => {
  await page.goto("/en/explorer/energy-food/energy-use");
  await ready(page);
  await expect(page.getByTestId("energy-food-latest")).toHaveText("Final energy use · 2024: 5,456.7");
  await expect(page.getByTestId("series-status")).toContainText("1 / 7");
});

test("food shows whole-number wheat self-sufficiency and nests four meats under meat", async ({ page }) => {
  await page.goto("/en/explorer/energy-food/food-self-sufficiency");
  await ready(page);
  await expect(page.getByTestId("energy-food-latest")).toHaveText("Wheat self-sufficiency · 2025: 19%");
  await expect(page.locator('[data-series-id="food.self_sufficiency.beef"]')).toHaveCount(0);
  await page.locator(caret("food.self_sufficiency.meat")).click();
  for (const meat of ["beef", "pork", "sheep_goat_meat", "poultry_meat"]) await expect(page.locator(`[data-series-id="food.self_sufficiency.${meat}"]`)).toBeVisible();
  await page.locator(toggle("food.self_sufficiency.beef")).click();
  // A nested tick is counted apart; the top-level count stays.
  await expect(page.getByTestId("series-status")).toContainText("1 / 8");
  await page.getByTestId("chart-mode-table").click();
  const wheat = page.getByTestId("explorer-table").locator("tbody tr").first();
  await expect(wheat).toContainText("Wheat");
  await expect(wheat.locator("td").last()).toHaveText("19%");
  await expect(page.getByTestId("explorer-table")).not.toContainText("19.0");
});

test("clearing the selection shows the empty callout and disables Excel", async ({ page }) => {
  await page.goto("/en/explorer/energy-food/energy-supply");
  await ready(page);
  await expect(page.getByTestId("energy-food-excel-download")).toBeEnabled();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("energy-food-excel-download")).toBeDisabled();
});

test("Excel downloads an .xlsx of the selection", async ({ page }) => {
  await page.goto("/en/explorer/energy-food/electricity#start=2020&end=2024");
  await ready(page);
  const promise = page.waitForEvent("download"); await page.getByTestId("energy-food-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  // The Sources sheet links to the fiscal.ge archive copies of the Geostat workbooks.
  const links: string[] = [];
  workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toContain("/downloads/methodology/energy-food/files/");
});

test("switching to English keeps range, selection and table mode (Review Focus 5)", async ({ page }) => {
  await page.goto("/explorer/energy-food/energy-use#view=table&start=2018&end=2022&sel=energy.final.total,energy.final_fuel.natural_gas");
  await ready(page);
  await page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/energy-food\/energy-use#/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(toggle("energy.final_fuel.natural_gas"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2018–2022");
  await expect(page).toHaveURL(/start=2018/);
});
