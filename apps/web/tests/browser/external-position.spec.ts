import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { topicCards } from "./group-cards";

const PAGES = ["foreign-debt", "reserves"] as const;
const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

/** The table cell of the row labelled `label` in the column whose header starts with `year`. */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  // The row label is the row's <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column - 1);
}

// The old hub is the section #t-external of the External sector page.
test("the external flows section shows five cards, each linking to its page", async ({ page }) => {
  await page.goto("/en/explorer/external");
  const cards = topicCards(page, "external");
  await expect(cards).toHaveCount(5);
  await expect(cards.nth(3)).toHaveAttribute("href", /\/en\/explorer\/external\/foreign-debt$/);
  await expect(cards.nth(4)).toHaveAttribute("href", /\/en\/explorer\/external\/reserves$/);
});

test("reserves opens on the total alone and its latest line names the September amount", async ({ page }) => {
  await page.goto("/en/explorer/external/reserves");
  await ready(page);
  await expect(page.getByTestId("series-status")).toContainText("1 / 4");
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(1);
  await expect(page.locator(pressed("reserves.total"))).toHaveAttribute("aria-pressed", "true");
  const latest = page.getByTestId("position-latest");
  await expect(latest).toContainText("2026 (Sep)");
  await expect(latest).toContainText("8.17");
  // No tabs and no note under the heading: the measure switch is two icons, a $ glyph and a pie.
  await expect(page.getByTestId("position-measure-amount")).toHaveText("$");
  await expect(page.getByTestId("position-measure-gdp").locator("svg.lucide-chart-pie")).toHaveCount(1);
  await expect(page.getByTestId("position-unit-label")).toHaveText("billion USD");
  // The 2026 point is the one hollow dot on the line.
  await expect(page.getByTestId("chart-panel").locator('svg circle[fill="#F7F2E9"]')).toHaveCount(1);
  await expect(page.getByTestId("source-label")).toContainText("National Bank of Georgia");
  await expect(page.getByTestId("source-label").getByRole("link")).toHaveAttribute("href", "/en/methodology/external-flows");
});

test("the reserves table marks the 2026 column with its month and shows gold's published zero", async ({ page }) => {
  await page.goto("/en/explorer/external/reserves#tab=amount&view=table&sel=reserves.total,reserves.gold");
  await ready(page);
  const headers = await page.getByTestId("explorer-table").locator("thead th").allInnerTexts();
  expect(headers.some(text => text.trim() === "2026 (Sep)")).toBe(true);
  expect(headers.filter(text => text.trim().startsWith("2026"))).toHaveLength(1);
  // Gold before 2024 is a real zero, not a gap.
  await expect(await cell(page, "Gold", 2010)).toHaveText(/^0\.0+$/);
  await expect(await cell(page, "Gold", 2026)).not.toHaveText("—");
});

test("foreign debt's % of GDP view ends at 2025", async ({ page }) => {
  await page.goto("/en/explorer/external/foreign-debt");
  await ready(page);
  await expect(page.getByTestId("position-latest")).toContainText("2026 (Jun)");
  await page.getByTestId("chart-mode-table").click();
  expect((await page.getByTestId("explorer-table").locator("thead th").allInnerTexts()).some(text => text.trim().startsWith("2026"))).toBe(true);
  await page.getByTestId("position-measure-gdp").click();
  await expect(page.getByTestId("position-measure-gdp")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "percent");
  await expect(page.getByTestId("position-unit-label")).toHaveText("%");
  expect((await page.getByTestId("explorer-table").locator("thead th").allInnerTexts()).some(text => text.trim().startsWith("2026"))).toBe(false);
  await expect(page.getByTestId("position-latest")).toHaveText(/Foreign debt, % of GDP · 2025: \d+\.\d%$/);
  await expect(page.getByTestId("source-label")).toContainText("GDP: Geostat, at current prices.");
  await expect(page.getByTestId("source-label")).toContainText("GDP for 2025 is preliminary.");
  await expect(page).toHaveURL(/tab=gdp/);
});

test("ticking a group then clearing the selection shows the empty callout", async ({ page }) => {
  await page.goto("/en/explorer/external/foreign-debt");
  await ready(page);
  await expect(page.getByTestId("series-status")).toContainText("1 / 6");
  await expect(page.locator('[data-series-id] [aria-expanded]')).toHaveCount(0);
  await page.locator(pressed("ext_debt.banks")).click();
  await expect(page.locator(pressed("ext_debt.banks"))).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/sel=ext_debt\.total(%2C|,)ext_debt\.banks(&|$)/);
  await expect(page.getByTestId("position-excel-download")).toBeEnabled();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.locator(`[data-testid="series-row-toggle"][aria-pressed="true"]`)).toHaveCount(0);
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("position-excel-download")).toBeDisabled();
  // Neither list has a search field.
  await expect(page.getByTestId("series-search")).toHaveCount(0);
});

for (const section of PAGES) {
  test(`${section} downloads an Excel workbook`, async ({ page }) => {
    await page.goto(`/en/explorer/external/${section}`);
    await ready(page);
    const download = page.waitForEvent("download");
    await page.getByTestId("position-excel-download").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await file.path())!);
    expect(workbook.worksheets).toHaveLength(3);
  });

  test(`${section} keeps its view when the language changes`, async ({ page }) => {
    // The open section list puts the sidebar's language link below a 720px fold.
    await page.setViewportSize({ width: 1280, height: 1000 });
    const total = section === "foreign-debt" ? "ext_debt.total" : "reserves.total";
    await page.goto(`/explorer/external/${section}#tab=gdp&view=table&sel=${total}&start=2010&end=2020`);
    await ready(page);
    await page.getByTestId("language-switch").getByRole("link", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/en/explorer/external/${section}#`));
    await ready(page);
    await expect(page.getByTestId("position-measure-gdp")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("year-range-strip")).toContainText("2010–2020");
    await expect(page.locator(pressed(total))).toHaveAttribute("aria-pressed", "true");
  });

  for (const hash of ["", "#tab=amount&view=table"]) {
    test(`${section}${hash ? " table" : ""} has no horizontal scroll at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(`/explorer/external/${section}${hash}`);
      await ready(page);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
