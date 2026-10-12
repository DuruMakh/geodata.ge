import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`living standards hub and poverty pages render ${prefix || "ka"} at ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/living-standards`);
    const hub = page.getByTestId("living-standards-hub");
    await expect(hub.locator("a")).toHaveCount(4);
    await expect(hub.locator("a").nth(2)).toHaveAttribute("href", `${prefix}/explorer/living-standards/poverty`);
    for (const section of ["poverty", "inequality"]) {
      await page.goto(`${prefix}/explorer/living-standards/${section}`);
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
      await expect(page.getByTestId("series-status")).toContainText("1 /");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test("rates default to Georgia's poverty line and tabs keep the clamped years", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/poverty");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("poverty-latest")).toContainText("2025: 7.1%");
  await expect(page.getByTestId("poverty-tab-absolute")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("poverty.absolute|georgia"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2004–2025");
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table").locator("tbody tr").first()).toContainText("Georgia");
  await expect(page.getByTestId("explorer-table").locator("tbody tr").first()).toContainText("7.1%");
  await expect(page.getByTestId("explorer-table")).not.toContainText("710");
  await page.getByTestId("poverty-tab-international").click();
  await expect(page.locator(pressed("poverty.international_300|georgia"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2004–2024");
  await expect(page.getByTestId("source-label")).toContainText("World Bank");
  await expect(page.getByTestId("series-status")).toContainText("1 / 3");
});

test("a series caret is a full 24px target named after its row", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/en/explorer/living-standards/poverty#tab=relative");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const caret = page.locator('[data-series-id="poverty.relative_40|georgia"] [aria-expanded]');
  await expect(caret).toHaveAccessibleName(/Georgia/);
  expect((await caret.boundingBox())!.width).toBeGreaterThanOrEqual(24);
});

test("relative lines nest towns and villages without changing the top-level count", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/poverty#tab=relative");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("series-status")).toContainText("1 / 2");
  await page.locator('[data-series-id="poverty.relative_40|georgia"] [aria-expanded]').click();
  await page.locator(pressed("poverty.relative_40|settlement.rural")).click();
  await expect(page.getByTestId("series-status")).toContainText("1 / 2");
  await expect(page).toHaveURL(/sel=poverty\.relative_60%7Cgeorgia%2Cpoverty\.relative_40%7Csettlement\.rural|sel=poverty\.relative_60\|georgia,poverty\.relative_40\|settlement\.rural/);
  // A link from another tab keeps only this tab's series; the language switch keeps the state.
  await page.getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("poverty-tab-relative")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("poverty.relative_40|settlement.rural"))).toHaveAttribute("aria-pressed", "true");
});

test("inequality shows the Gini coefficient with two decimals and no tabs, and exports Excel", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/inequality#view=table&start=2020&end=2025");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("poverty-latest")).toContainText("2025: 0.34");
  await expect(page.getByTestId("poverty-tabs")).toHaveCount(0);
  await expect(page.getByTestId("explorer-table")).toContainText("0.34");
  const promise = page.waitForEvent("download"); await page.getByTestId("poverty-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
});
