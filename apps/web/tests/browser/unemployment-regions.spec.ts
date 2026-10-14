import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { tableSeriesCount, tableSeriesValues } from "./explorer-table";
import { REGIONAL_ECONOMY_REGIONS as UNEMPLOYMENT_REGIONS } from "../../lib/data/regionalEconomies/importRegionalEconomies";

// The 11 rows and map targets and the absent indicator control are pinned in unemploymentRegions.test.tsx.
for (const prefix of ["", "/en"]) for (const width of [390, 1440]) test(`region map opens separate pages ${prefix || "ka"} at ${width}px`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`${prefix}/explorer/unemployment/regions`);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.locator("[data-occupied-overlay]")).toHaveCount(2);
  await expect(page.getByTestId("regional-map-legend")).toContainText("7.0%");
  await expect(page.getByTestId("regional-map-legend")).toContainText("17.5%");
  await page.locator('[data-testid="regional-list-row"][data-region-id="region.imereti"]').click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/unemployment/regions/imereti$`));
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
  await expect(page.getByTestId("unemployment-indicator")).toHaveCount(0);
  await expect(page.locator('[data-series-id="region.imereti:unemployment_rate"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-series-id="region.imereti:employment_rate"]')).toHaveCount(0);
  await expect(page.locator('[data-series-id="region.imereti:hired"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(prefix ? "Imereti" : "იმერეთი");
  await expect(page.getByRole("heading", { level: 1 }).getByTestId("region-picker-trigger")).toHaveCount(1);
  await expect(page.getByTestId("unemployment-regions-link")).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

// Moved from unemployment.spec.ts's hub test, run once instead of at every width.
test("the regions index shows its map without a chart, and the comparison bulk action selects the 14 top-level rates", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/explorer/unemployment/regions");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("unemployment-region-map")).toBeVisible();
  await expect(page.getByTestId("chart-panel")).toHaveCount(0);
  await page.goto("/explorer/unemployment/regions#breakdown=region");
  await page.reload();
  await page.getByTestId("chart-mode-table").click();
  await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
  // §7.7: the bulk action selects the 14 top-level regional rates, not the rates under their carets.
  await expect(page.getByTestId("series-status")).toContainText("14 / 14");
  await expect.poll(() => tableSeriesCount(page.getByTestId("explorer-table"))).toBe(14);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("regional hover, bilingual search and keyboard links stay coordinated", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/regions");
  const row = page.locator('[data-testid="regional-list-row"][data-region-id="region.imereti"]');
  const target = page.locator('[data-region-map-target][data-region-id="region.imereti"]');
  await row.hover();
  await expect(target).toHaveAttribute("data-active", "true");
  await target.focus(); await expect(row).toHaveAttribute("data-active", "true");
  await target.press("Home");
  await expect(page.locator("[data-region-map-target]").first()).toBeFocused();
  await page.locator("[data-region-map-target]").first().press("End");
  await expect(page.locator("[data-region-map-target]").last()).toBeFocused();
  await page.getByRole("searchbox", { name: "Search regions", exact: true }).fill("გურია");
  await expect(page.getByTestId("regional-list-row")).toHaveCount(1);
  await expect(page.getByTestId("regional-list-row")).toContainText("Guria");
  await target.focus(); await target.press("Enter");
  await expect(page).toHaveURL(/\/en\/explorer\/unemployment\/regions\/imereti$/);
  await page.getByRole("heading", { level: 1 }).getByTestId("region-picker-trigger").click();
  const search = page.getByRole("combobox", { name: "Search regions" });
  await search.fill("Guria"); await search.press("ArrowDown"); await search.press("Enter");
  await expect(page).toHaveURL(/\/en\/explorer\/unemployment\/regions\/guria$/);
  await expect(page.getByTestId("year-range-strip")).toContainText("2017–2025");
  await page.getByTestId("region-picker-trigger").click();
  await page.getByRole("combobox", { name: "Search regions" }).press("ArrowDown");
  await page.getByRole("combobox", { name: "Search regions" }).press("Enter");
  await expect(page).toHaveURL(/\/en\/explorer\/unemployment\/regions$/);
});

// One width: the flow is width-independent and 390px overflow on region pages is checked above.
// It continues into the rates flow: the rate workbook, the rate/count unit switch and the 5 / 5 bulk action.
for (const prefix of ["", "/en"]) for (const width of [1440]) test(`regional employed children preserve source coverage and Excel values, and indicators, units and workbook agree ${prefix || "ka"} at ${width}px`, async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`${prefix}/explorer/unemployment/regions/tbilisi`);
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  const row = (indicator: string) => page.locator(`[data-series-id="region.tbilisi:${indicator}"]`);
  const toggle = (indicator: string) => row(indicator).getByTestId("series-row-toggle");
  await toggle("employed").click();
  await row("employed").locator("button[aria-expanded]").click();
  await expect(row("hired")).toContainText("361.2");
  await expect(row("self_employed")).toContainText("78.3");
  await toggle("hired").click(); await toggle("self_employed").click();
  await expect(toggle("unemployment_rate")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
  // Employed is the one top-level row; its two ticked children are reported beside the count (§7.7).
  await expect(page.getByTestId("series-status")).toContainText("1 / 5");
  await expect(page.getByTestId("series-status")).toContainText(prefix ? "Subcategories 2" : "ქვეკატეგორიები 2");
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2025");
  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  await expect.poll(() => tableSeriesCount(table)).toBe(3);
  const hired = await tableSeriesValues(table, prefix ? "Hired employees" : "დაქირავებული");
  expect(hired[9]).toBe("—");
  expect(hired.at(-1)).toBe("361.2");
  const saved = page.url(); await page.reload(); expect(page.url()).toBe(saved);
  await expect(toggle("hired")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2025");
  const promise = page.waitForEvent("download"); await page.getByTestId("unemployment-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe(`fiscal-unemployment-tbilisi-people-2010-2025${prefix ? "-en" : ""}.xlsx`);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  const sheet = workbook.worksheets[0];
  const hiredRow = [4, 5, 6].find(index => sheet.getCell(`A${index}`).value === (prefix ? "Hired employees" : "დაქირავებული"))!;
  expect(sheet.getCell(`K${hiredRow}`).value).toBeNull();
  expect(typeof sheet.getCell(`L${hiredRow}`).value).toBe("number");
  expect(sheet.getCell(`Q${hiredRow}`).value).toBe(361.23065568749558);
  expect(sheet.getCell(`Q${hiredRow}`).numFmt).toBe("#,##0.0");
  expect(workbook.worksheets[2].getCell("D4").value).toMatchObject({ hyperlink: expect.stringContaining("05-labour-force-indicators-by-region.xlsx") });
  await toggle("employed").click();
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2025");
  await toggle("unemployment_rate").click();
  await expect(row("employed").locator("button[aria-expanded]")).toHaveAttribute("aria-expanded", "false");
  await row("employed").locator("button[aria-expanded]").click();
  await expect(toggle("hired")).toHaveAttribute("aria-pressed", "false");
  await expect(toggle("self_employed")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2025");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto(`${prefix}/explorer/unemployment/regions/tbilisi#start=2025&end=2025&view=table`);
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await toggle("participation_rate").click();
  await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(2);
  await expect(page.getByTestId("explorer-table")).toContainText("17.5%");
  const ratesPromise = page.waitForEvent("download"); await page.getByTestId("unemployment-excel-download").click();
  const ratesDownload = await ratesPromise;
  expect(ratesDownload.suggestedFilename()).toBe(`fiscal-unemployment-tbilisi-rates-2025-2025${prefix ? "-en" : ""}.xlsx`);
  const rates = new ExcelJS.Workbook(); await rates.xlsx.readFile((await ratesDownload.path())!);
  expect(rates.worksheets).toHaveLength(3);
  expect(rates.worksheets[0].getCell("A1").value).toEqual(expect.stringContaining(prefix ? "Tbilisi" : "თბილისი"));
  expect(rates.worksheets[0].getCell("B4").value).toBeCloseTo(0.1745742771624716, 12);
  expect(rates.worksheets[2].getCell("D4").value).toMatchObject({ hyperlink: expect.stringContaining("05-labour-force-indicators-by-region.xlsx") });
  await toggle("employed").click();
  await expect(toggle("unemployment_rate")).toHaveAttribute("aria-pressed", "false");
  await expect(toggle("participation_rate")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "thousand_persons");
  await toggle("unemployed").click();
  await page.getByTestId("series-search").fill(prefix ? "Unemployed" : "უმუშევარი");
  await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
  // §7.7: the bulk action covers the five top-level people counts; hired and self-employed sit under employed.
  await expect(page.getByTestId("series-status")).toContainText("5 / 5");
  await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(5);
  const reloaded = page.url(); await page.reload(); expect(page.url()).toBe(reloaded);
  await expect(page.getByTestId("series-status")).toContainText("5 / 5");
  expect(errors).toEqual([]);
});

test("regional language switch preserves indicators, years and view", async ({ page }) => {
  await page.goto("/explorer/unemployment/regions/tbilisi#sel=region.tbilisi:unemployment_rate,region.tbilisi:participation_rate&start=2022&end=2025&view=table");
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  const hash = new URL(page.url()).hash;
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/en/explorer/unemployment/regions/tbilisi#"));
  expect(new URL(page.url()).hash).toBe(hash);
  await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(2);
  await expect(page.getByTestId("year-range-strip")).toContainText("2022–2025");
});

test("regional comparison keeps parent history when a region employment child is selected", async ({ page }) => {
  await page.goto("/en/explorer/unemployment/regions#breakdown=region&sel=georgia:employed,region.tbilisi:employed,region.tbilisi:hired&range=all&view=table");
  const table = page.getByTestId("explorer-table");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2025");
  const georgia = table.locator("tbody tr").filter({ hasText: /Georgia.*Employed/ });
  const hired = table.locator("tbody tr").filter({ hasText: /Tbilisi.*Hired/ });
  await expect(georgia.locator("td").nth(0)).not.toHaveText("—");
  await expect(hired.locator("td").nth(9)).toHaveText("—");
  await expect(hired.locator("td").last()).toHaveText("361.2");
  await page.reload();
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2025");
});

test("all eleven regional routes are static and unknown regions return 404", async ({ request }) => {
  for (const prefix of ["", "/en"]) for (const region of UNEMPLOYMENT_REGIONS) {
    const response = await request.get(`${prefix}/explorer/unemployment/regions/${region.id.slice("region.".length)}`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('data-testid="unemployment-explorer"');
  }
  expect((await request.get("/explorer/unemployment/regions/unknown")).status()).toBe(404);
});

for (const prefix of ["", "/en"]) test(`historical comparison explains the combined regions without an absent map ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/unemployment/regions#breakdown=region`);
  await expect(page.getByTestId("unemployment-explorer")).toBeVisible();
  await expect(page.getByTestId("unemployment-region-map")).toHaveCount(0);
  await expect(page.getByText(prefix ? "Select a region on the map" : "აირჩიეთ რეგიონი რუკაზე", { exact: false })).toHaveCount(0);
  // No instruction paragraph under the heading (DESIGN §17); the combined-region disclosure sits under the chart.
  await expect(page.getByText(prefix ? "Earlier combined regions remain distinct." : "ადრინდელი გაერთიანებული რეგიონები ცალკე რჩება.", { exact: false })).toBeVisible();
});
