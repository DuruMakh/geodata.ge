import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { tableSeriesCount } from "./explorer-table";
const toggle = (page: import("@playwright/test").Page, id: string) => page.locator(`[data-series-id="${id}"]`).getByTestId("series-row-toggle");

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`Foreign investment defaults, tabs, ranking and search-safe bulk selection ${prefix || "ka"} ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 }); await page.goto(`${prefix}/explorer/external`);
    await page.getByTestId("external-hub").getByTestId("hub-card").nth(1).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/external/foreign-investment$`));
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("series-status")).toContainText("1 / 12");
    await expect(toggle(page, "fdi.total")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-dimension", "country");
    const ranking = page.getByTestId("foreign-investment-ranking-row");
    await expect(ranking).toHaveCount(10);
    await expect(ranking.first()).toHaveAttribute("data-entity-id", "fdi.country.m49_826");
    await expect(ranking.first()).toContainText("426.6");
    await expect(page.getByTestId("foreign-investment-other-row")).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`fdi-country-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    await toggle(page, "fdi.country.m49_826").click();
    await page.getByTestId("foreign-investment-tab-region").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-dimension", "region");
    await expect(page.getByTestId("series-status")).toContainText("1 / 12");
    await expect(page.getByTestId("foreign-investment-ranking")).toHaveAttribute("data-dimension", "region");
    await expect(ranking).toHaveCount(11);
    await expect(ranking.first()).toHaveAttribute("data-entity-id", "fdi.region.tbilisi");
    await expect(ranking.last()).toHaveAttribute("data-entity-id", "fdi.region.imereti");
    await expect(ranking.last()).toContainText("−64.2");
    await page.screenshot({ path: info.outputPath(`fdi-region-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    await page.getByTestId("foreign-investment-tab-sector").click();
    await expect(page.getByTestId("series-status")).toContainText("1 / 19");
    await expect(ranking).toHaveCount(18);
    await page.getByTestId("series-search").fill("no-matching-series-xyz");
    await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("0 / 19");
    await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("19 / 19");
    await page.getByTestId("series-toggle-all").click();
    await page.getByTestId("chart-mode-table").click(); await page.reload();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-dimension", "sector");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const prefix of ["", "/en"]) for (const width of [390, 1440]) {
  test(`A region table with gaps before 2016 survives sidebar, reload, language and history ${prefix || "ka"} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/external/foreign-investment#tab=region&view=table&sel=fdi.total,fdi.region.guria,fdi.region.tbilisi&start=2012&end=2018`);
    await expect(page.getByTestId("series-status")).toContainText("3 / 12");
    const table = page.getByTestId("explorer-table");
    expect(await tableSeriesCount(table)).toBe(3);
    await expect(table).toContainText("—");
    const before = page.url();
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("foreign-investment-link").click(); await expect(page).toHaveURL(before);
    await page.reload();
    await expect(page.getByTestId("series-status")).toContainText("3 / 12");
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page.getByTestId("series-status")).toContainText("3 / 12");
    await expect(page.getByTestId("foreign-investment-ranking")).toHaveAttribute("data-end-year", "2018");
    await toggle(page, "fdi.region.guria").focus(); await toggle(page, "fdi.region.guria").press("Space");
    await expect(page.getByTestId("series-status")).toContainText("2 / 12");
    await page.goBack(); await expect(page.getByTestId("series-status")).toContainText("3 / 12");
    await page.goForward(); await expect(page.getByTestId("series-status")).toContainText("2 / 12");
  });
}

test("Excel follows the tab and selection and links the untouched Geostat originals", async ({ page, request }) => {
  await page.goto("/en/explorer/external/foreign-investment#tab=sector&view=line&sel=fdi.total,fdi.sector.k&start=2020&end=2025");
  await expect(page.getByTestId("series-status")).toContainText("2 / 19");
  const pending = page.waitForEvent("download"); await page.getByTestId("foreign-investment-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("fiscal-foreign-investment-2020-2025-en.xlsx");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile((await download.path())!);
  expect(excel.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  const values = excel.getWorksheet("Data")!.getSheetValues().flat().map(String);
  expect(values.some(value => value.includes("Financial and insurance activities"))).toBe(true);
  const rows = parse(await readFile("../../data/methodology/source-archives/external-flows.csv"), { columns: true, bom: true }) as Record<string, string>[];
  const links = excel.getWorksheet("Sources")!.getColumn(4).values.filter(value => typeof value === "object" && value !== null && "hyperlink" in value) as { hyperlink: string }[];
  expect(links).toHaveLength(3);
  for (const link of links) {
    const pathname = new URL(link.hyperlink).pathname, source = rows.find(row => `/${row.public_download_path}` === pathname)!;
    const response = await request.get(pathname); expect(response.ok()).toBe(true);
    expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(source.sha256);
  }
  const dataset = JSON.parse(await page.getByTestId("explorer-dataset-json-ld").textContent() ?? "{}");
  expect(dataset.temporalCoverage).toBe("1996/2025");
});
