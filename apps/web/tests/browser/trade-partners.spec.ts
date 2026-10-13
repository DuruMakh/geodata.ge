import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { SSF } from "xlsx";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { tableSeriesCount, tableSeriesValues } from "./explorer-table";
const toggle = (page: import("@playwright/test").Page, id: string) => page.locator(`[data-series-id="${id}"]`).getByTestId("series-row-toggle");

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`Partners defaults, full ranking and search-safe bulk selection ${prefix || "ka"} ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 }); await page.goto(`${prefix}/explorer/trade`);
    const cards = page.getByTestId("trade-hub").getByTestId("hub-card"); await expect(cards).toHaveCount(5); await cards.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/trade/partners$`));
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("series-status")).toContainText("1 / 218");
    await expect(toggle(page, "goods.total")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-list").getByTestId("series-row").nth(1)).toHaveAttribute("data-series-id", "partner.1995-2025.792");
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(10);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`partners-default-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    await page.getByTestId("trade-partners-show-all").click();
    expect(await page.getByTestId("trade-partners-ranking-row").count() + await page.getByTestId("trade-partners-unavailable-row").count()).toBe(212);
    await page.getByTestId("trade-partners-tab-groups").click();
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(5);
    await toggle(page, "group.eu").click();
    await page.getByTestId("trade-partners-tab-countries").click();
    await expect(page.getByTestId("trade-partners-off-tab")).toContainText(prefix ? "European Union" : "ევროკავშირი");
    await expect(toggle(page, "group.eu")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("series-search").fill("no-matching-partner-xyz");
    await expect(toggle(page, "group.eu")).toBeVisible();
    await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("0 / 218");
    await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("218 / 218");
    await page.getByTestId("series-toggle-all").click();
    await page.getByTestId("chart-mode-table").click(); await page.reload();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("trade-partners-ranking-row")).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const prefix of ["", "/en"]) for (const width of [390, 1440]) {
  test(`Mixed partners survive active navigation, keyboard range and language ${prefix || "ka"} ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/trade/partners#sel=partner.1995-2025.643,group.eu&view=table&tab=countries&measure=trade.exports&start=2023&end=2025`);
    await expect(page.getByTestId("series-status")).toContainText("2 / 218");
    const table = page.getByTestId("explorer-table");
    expect(await tableSeriesCount(table)).toBe(2);
    expect(await tableSeriesValues(table, prefix ? "Russia" : "რუსეთი")).toHaveLength(3);
    expect(await tableSeriesValues(table, prefix ? "European Union" : "ევროკავშირი")).toHaveLength(3);
    await page.getByTestId("trade-partners-tab-groups").click();
    await expect(page.getByTestId("trade-partners-off-tab")).toContainText(prefix ? "Russia" : "რუსეთი");
    const end = page.getByTestId("range-end-handle"); await end.focus(); await end.press("ArrowLeft");
    await expect(end).toHaveAttribute("aria-valuenow", "2024");
    await page.getByTestId("trade-partners-measure-trade.balance").click();
    await expect(page.getByTestId("trade-partners-ranking")).toHaveAttribute("data-has-share", "false");
    await expect(page.getByTestId("trade-partners-zero-axis").first()).toBeVisible();
    const before = page.url();
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("trade-partners-link").click(); await expect(page).toHaveURL(before);
    if (width < 900) await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
    await page.reload();
    await expect(page.getByTestId("series-status")).toContainText("2 / 218");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.balance");
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page.getByTestId("series-status")).toContainText("2 / 218");
    await expect(page.getByTestId("trade-partners-tab-groups")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("trade-partners-ranking")).toHaveAttribute("data-end-year", "2024");
    await page.screenshot({ path: info.outputPath(`partners-mixed-balance-${prefix ? "ka" : "en"}-${width}.png`), fullPage: true });
    await toggle(page, "partner.1995-2025.643").focus(); await toggle(page, "partner.1995-2025.643").press("Space");
    await expect(page.getByTestId("series-status")).toContainText("1 / 218");
    await page.goBack(); await expect(page.getByTestId("series-status")).toContainText("2 / 218");
    await page.goForward(); await expect(page.getByTestId("series-status")).toContainText("1 / 218");
  });
}

test("mixed Excel download contains the exact selected figures and all four untouched originals", async ({ page, request }) => {
  await page.goto("/en/explorer/trade/partners#sel=partner.1995-2025.643,group.eu&view=table&tab=countries&measure=trade.balance&start=2025&end=2025");
  await expect(page.getByTestId("series-status")).toContainText("2 / 218");
  const pending = page.waitForEvent("download"); await page.getByTestId("trade-partners-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("fiscal-trade-partners-2025-2025-en.xlsx");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile((await download.path())!);
  expect(excel.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  const data = excel.getWorksheet("Data")!;
  expect(data.getCell("C2").value).toBe("Russia");
  expect(data.getCell("D2").value).toBeCloseTo(-1191302071.08252312, 5);
  expect(data.getCell("C3").value).toContain("European Union");
  expect(data.getCell("E2").value).toBe("Actual"); expect(data.getCell("F2").value).toBe("Unspecified");
  const rows = parse(await readFile("../../data/methodology/source-archives/trade.csv"), { columns: true, bom: true }) as Record<string, string>[];
  const links = excel.getWorksheet("Sources")!.getColumn(4).values.filter(value => typeof value === "object" && value !== null && "hyperlink" in value) as { hyperlink: string }[];
  expect(links).toHaveLength(4);
  for (const link of links) {
    const pathname = new URL(link.hyperlink).pathname, source = rows.find(row => `/${row.public_download_path}` === pathname)!;
    const response = await request.get(pathname); expect(response.ok()).toBe(true);
    expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(source.sha256);
  }
  const dataset = JSON.parse(await page.getByTestId("explorer-dataset-json-ld").textContent() ?? "{}");
  expect(dataset.temporalCoverage).toBe("1995/2025"); expect(dataset).not.toHaveProperty("distribution");
});

test("Qatar's downloaded Summary keeps its small 2025 turnover visibly nonzero", async ({ page }) => {
  await page.goto("/en/explorer/trade/partners#sel=partner.1995-2025.634&measure=trade.turnover&start=2025&end=2025");
  await expect(page.getByTestId("series-status")).toContainText("1 / 218");
  const pending = page.waitForEvent("download"); await page.getByTestId("trade-partners-excel-download").click();
  const download = await pending, excel = new ExcelJS.Workbook(); await excel.xlsx.readFile((await download.path())!);
  const amount = excel.worksheets[0].getCell("B4");
  expect(amount.value).toBeCloseTo(4_736_258.239671868 / 1_000_000_000, 14);
  expect(Number(SSF.format(amount.numFmt, amount.value))).toBeGreaterThan(0);
  expect(excel.worksheets[1].getCell("D2").value).toBeCloseTo(4_736_258.239671868, 6);
});

test("an explicitly empty selection and Back restore the same view", async ({ page }) => {
  await page.goto("/en/explorer/trade/partners#sel=&view=line&tab=countries&measure=trade.exports");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await page.locator('[data-series-id="goods.total"]').getByTestId("series-row-toggle").click();
  await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
});

// U21-01/05: the 218 countries (187 on Domestic exports) scroll inside their panel at every
// width, the Excel button sits above them, and a skip button leads past them to the ranking.
for (const path of ["/explorer/trade/partners", "/en/explorer/trade/domestic-exports#section=countries"]) {
  test(`the country list scrolls inside its panel and the ranking is within two screens of the chart ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    const list = page.getByTestId("series-list");
    expect(await list.evaluate(element => element.querySelectorAll("[data-testid='series-row']").length)).toBeGreaterThan(150);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThan(4000);
    expect(await list.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    const chart = (await page.getByTestId("chart-panel").boundingBox())!, ranking = (await page.getByTestId("trade-partners-ranking").boundingBox())!;
    expect(ranking.y - chart.y).toBeLessThan(2 * 812);
    expect(await page.getByTestId("trade-partners-excel-download").evaluate((excel, element) => Boolean(excel.compareDocumentPosition(element!) & Node.DOCUMENT_POSITION_FOLLOWING), await list.elementHandle())).toBe(true);
    await page.getByTestId("series-skip-list").focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Tab");
    await expect(page.getByTestId("trade-partners-show-all")).toBeFocused();
  });
}
