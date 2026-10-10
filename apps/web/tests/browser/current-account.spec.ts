import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { tableSeriesCount } from "./explorer-table";
const toggle = (page: import("@playwright/test").Page, id: string) => page.locator(`[data-series-id="${id}"]`).getByTestId("series-row-toggle");

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`Current account balance, money in and % of GDP ${prefix || "ka"} ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 }); await page.goto(`${prefix}/explorer/external`);
    await page.getByTestId("external-hub").getByTestId("hub-card").nth(2).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/external/current-account$`));
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    const panel = page.getByTestId("chart-panel");
    await expect(panel).toHaveAttribute("data-tab", "balance");
    await expect(panel).toHaveAttribute("data-unit", "usd");
    await expect(page.getByRole("img", { name: prefix ? "Current account balance and its four parts by year" : /მიმდინარე ანგარიში/ }).first()).toBeVisible();
    const key = page.getByTestId("current-account-key");
    await expect(key.locator("[data-series-id]")).toHaveCount(5);
    await expect(page.getByTestId("series-row-toggle")).toHaveCount(0);
    await expect(page.getByTestId("current-account").locator("h1 + p")).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`balance-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    await page.getByTestId("measure-share-toggle").click();
    await expect(panel).toHaveAttribute("data-unit", "gdp");
    await expect(key.locator('[data-series-id="ca.balance"]')).toContainText(/[−-]2\.9/);
    await expect(page.getByTestId("source-label")).toContainText("2025");
    await page.getByTestId("current-account-tab-in").click();
    await expect(panel).toHaveAttribute("data-tab", "in");
    await expect(panel).toHaveAttribute("data-unit", "gdp");
    await expect(page.getByTestId("series-status")).toContainText("1 / 5");
    await expect(toggle(page, "ca.balance")).toHaveAttribute("aria-pressed", "true");
    await toggle(page, "ca.services").click();
    await page.getByTestId("current-account-tab-out").click();
    await expect(page.getByTestId("series-status")).toContainText("2 / 5");
    await page.getByTestId("series-search").fill("no-matching-series-xyz");
    await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("0 / 5");
    await page.getByTestId("chart-mode-table").click(); await page.reload();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(panel).toHaveAttribute("data-mode", "table");
    await expect(panel).toHaveAttribute("data-tab", "out");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const prefix of ["", "/en"]) for (const width of [390, 1440]) {
  test(`A balance table survives sidebar, reload, language and history ${prefix || "ka"} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/external/current-account#view=table&start=2015&end=2025`);
    const table = page.getByTestId("explorer-table");
    expect(await tableSeriesCount(table)).toBe(5);
    await expect(table.locator("tbody tr").first()).toContainText(prefix ? "Current account" : "მიმდინარე ანგარიში");
    const before = page.url();
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("current-account-link").click(); await expect(page).toHaveURL(before);
    await page.reload();
    expect(await tableSeriesCount(table)).toBe(5);
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page).toHaveURL(/start=2015/);
    await page.getByTestId("current-account-tab-in").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-tab", "in");
    await page.goBack(); await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-tab", "balance");
    await page.goForward(); await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-tab", "in");
  });
}

test("Excel follows the tab and unit and links the untouched NBG workbook", async ({ page, request }) => {
  await page.goto("/en/explorer/external/current-account#tab=in&unit=gdp&sel=ca.balance,ca.services&start=2020&end=2025");
  await expect(page.getByTestId("series-status")).toContainText("2 / 5");
  const pending = page.waitForEvent("download"); await page.getByTestId("current-account-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toContain("current-account-2020-2025-en.xlsx");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile((await download.path())!);
  expect(excel.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  const values = excel.getWorksheet("Data")!.getSheetValues().flat().map(String);
  expect(values.some(value => value.includes("Services"))).toBe(true);
  expect(values.some(value => value.includes("Goods"))).toBe(false);
  const rows = parse(await readFile("../../data/methodology/source-archives/external-flows.csv"), { columns: true, bom: true }) as Record<string, string>[];
  const links = excel.getWorksheet("Sources")!.getColumn(4).values.filter(value => typeof value === "object" && value !== null && "hyperlink" in value) as { hyperlink: string }[];
  expect(links).toHaveLength(1);
  for (const link of links) {
    const pathname = new URL(link.hyperlink).pathname, source = rows.find(row => `/${row.public_download_path}` === pathname)!;
    const response = await request.get(pathname); expect(response.ok()).toBe(true);
    expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(source.sha256);
  }
  const dataset = JSON.parse(await page.getByTestId("explorer-dataset-json-ld").textContent() ?? "{}");
  expect(dataset.temporalCoverage).toBe("2000/2025");
});
