import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;

// One test per locale walks the review widths; the hub's links are checked in hubs.spec.ts.
for (const prefix of ["", "/en"]) {
  test(`poverty pages render ${prefix || "ka"} at 390, 768 and 1440px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    for (const section of ["poverty", "inequality"]) {
      await page.goto(`${prefix}/explorer/living-standards/${section}`);
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.getByTestId("series-status")).toContainText("1 /");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${section} ${width}`).toBe(true);
      }
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

// U20-02: the one line under the heading describes the chart below it, not the
// national poverty-line rate on every tab (DESIGN §17).
test("the poverty lead names the series of the active tab", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/poverty");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const lead = page.getByTestId("poverty-latest");
  await expect(lead).toHaveText("Share of people below the poverty line · 2025: 7.1%");
  for (const [tab, id, measure, year] of [
    ["relative", "poverty.relative_60|georgia", "Below 60% of median consumption", "2025"],
    // The international lines stop a year earlier; the lead quotes their own latest year.
    ["international", "poverty.international_300|georgia", "Below $3.00 a day", "2024"],
  ] as const) {
    await page.getByTestId(`poverty-tab-${tab}`).click();
    await expect(lead).toContainText(`${measure} · ${year}: `);
    const value = (await lead.locator("span").textContent())!;
    await expect(page.locator(`[data-series-id="${id}"]`).first()).toContainText(value.replace("%", ""));
  }
});

// U20-16: the Georgian rates page with nothing selected.
test("clearing the selection shows the empty callout and disables Excel", async ({ page }) => {
  await page.goto("/explorer/living-standards/poverty");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);
  await expect(page.getByTestId("poverty-excel-download")).toBeEnabled();
  await page.getByTestId("series-toggle-all").click();
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("poverty-excel-download")).toBeDisabled();
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

test("an old poverty bookmark lands on the new address with its tab", async ({ page }) => {
  // Redirects come from next.config and next dev serves them too (the municipality redirect specs run there); this one is skipped on the default local dev webServer and runs against a served build (PLAYWRIGHT_BASE_URL) or in CI.
  test.skip(!process.env.PLAYWRIGHT_BASE_URL && !process.env.CI, "redirects are checked against a served build");
  await page.goto("/en/explorer/poverty/rates#tab=relative");
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/poverty#tab=relative/);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("poverty-tab-relative")).toHaveAttribute("aria-pressed", "true");
});
