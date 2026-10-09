import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`age dropdown and heatmap stay in sync ${prefix || "ka"} at ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/unemployment/age`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    const selector = page.getByTestId("unemployment-indicator"), heatmap = page.getByTestId("unemployment-age-heatmap");
    await expect(selector.locator("option")).toHaveCount(8);
    await expect(selector.locator("optgroup")).toHaveCount(2);
    await expect(selector).toHaveAccessibleName(prefix ? "Indicator" : "მაჩვენებელი");
    await expect(page.locator('[data-series-id="georgia"]')).toHaveCount(0);
    await expect(page.locator('[data-series-id="age.15_24"]')).toHaveCount(0);
    // The page opens on a comparison: the youngest group beside a prime-age group.
    await expect(page.getByTestId("series-status")).toContainText("2 / 11");
    for (const id of ["age.15_19", "age.25_29"]) await expect(page.locator(`[data-series-id="${id}"] [data-testid="series-row-toggle"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("year-range-strip")).toContainText("2020–2025");
    await expect(heatmap.locator("tbody tr")).toHaveCount(11);
    await expect(page.getByTestId("age-heatmap-scroll-hint")).toHaveCount(0);
    await expect(heatmap.locator('[data-heatmap-cell="age.20_24:2025"]')).toHaveText("30.2%");
    await page.screenshot({ path: info.outputPath(`age-heatmap-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    await selector.selectOption("employed");
    await expect(heatmap).toHaveAttribute("data-unit", "thousand_persons");
    await expect(heatmap.locator('[data-heatmap-cell="age.20_24:2025"]')).toHaveText("70.0");
    await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(heatmap.locator("tbody tr")).toHaveCount(11);
    await expect(page.getByTestId("unemployment-excel-download")).toBeDisabled();
    await page.getByTestId("series-toggle-all").click();
    await page.getByTestId("chart-mode-table").click();
    await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(11);
    await selector.selectOption("participation_rate");
    await expect(heatmap).toHaveAttribute("data-unit", "percent");
    const region = heatmap.getByRole("region");
    await region.focus(); await expect(region).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("age saved settings, heatmap, table and downloaded workbook retain matching figures", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/age#indicator=employed&start=2024&end=2025&sel=age.20_24&view=table");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const heatmap = page.getByTestId("unemployment-age-heatmap");
  await expect(heatmap.locator("thead th")).toHaveCount(3);
  await expect(heatmap.locator('[data-heatmap-cell="age.20_24:2025"]')).toHaveText("70.0");
  await expect(page.getByTestId("explorer-table")).toContainText("70.0");
  const promise = page.waitForEvent("download"); await page.getByTestId("unemployment-excel-download").click();
  const download = await promise;
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.getWorksheet("Summary")!.getCell("C4").value).toBeCloseTo(69.99734573208089, 6);
  expect(workbook.getWorksheet("Sources")!.getCell("D4").value).toMatchObject({ hyperlink: "https://fiscal.ge/downloads/methodology/unemployment/files/04-labour-force-indicators-by-age.xlsx" });
  await page.getByTestId("unemployment-indicator").selectOption("unemployment_rate");
  await expect(heatmap).toHaveAttribute("data-unit", "percent");
  await page.goBack(); await expect(heatmap).toHaveAttribute("data-indicator", "employed");
  await page.goForward(); await expect(heatmap).toHaveAttribute("data-indicator", "unemployment_rate");
  await page.getByRole("link", { name: "ქართული", exact: true }).click();
  await expect(page.getByTestId("year-range-strip")).toContainText("2024–2025");
  await expect(page.getByTestId("unemployment-indicator")).toHaveValue("unemployment_rate");
  await expect(page.locator('[data-series-id="age.20_24"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
});

test("historic age links normalize to 2020 onward and remove the country selection", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/age#start=2010&end=2025&sel=georgia,age.15_24,age.20_24");
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2025");
  await expect(page.getByTestId("series-status")).toContainText("1 / 11");
  await expect(page.locator('[data-series-id="age.20_24"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
  // Owner decision D2 (2026-10-07): the latest value now sits under the title.
  await expect(page.getByTestId("unemployment-latest")).toContainText(/ · \d{4}: /);
});
