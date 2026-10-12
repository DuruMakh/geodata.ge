import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { tableSeriesCount } from "./explorer-table";

const section = (page: Page, name: string) => page.getByTestId(`trade-domestic-section-${name}`);

for (const prefix of ["", "/en"]) for (const width of [390, 1440]) {
  test(`Domestic views retain comparisons, range and language ${prefix || "ka"} ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/trade`);
    await page.getByTestId("trade-hub").getByTestId("hub-card").nth(3).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/trade/domestic-exports$`));
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("series-status")).toContainText("1 / 3");
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuemin", "2014");
    await expect(page.getByTestId("trade-balance-context")).toHaveCount(0);
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`domestic-overview-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    await page.getByTestId("chart-mode-table").click();
    expect(await tableSeriesCount(page.getByTestId("explorer-table"))).toBe(3);

    await section(page, "countries").click();
    await expect(page.getByTestId("series-status")).toContainText("1 / 187");
    await expect(page.getByTestId("trade-partners-tab-groups")).toHaveCount(0);
    await expect(page.getByTestId("trade-partners-ranking")).not.toContainText(prefix ? "Country groups overlap" : "ქვეყნების ჯგუფები ერთმანეთს გადაფარავს");
    await page.getByTestId("year-range-strip").getByRole("button", { name: prefix ? "5y" : "5წ", exact: true }).click();
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2021");
    await page.goBack();
    await expect(page.getByTestId("trade-domestic")).toHaveAttribute("data-section", "overview");
    expect(await tableSeriesCount(page.getByTestId("explorer-table"))).toBe(3);
    await section(page, "countries").click();
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "2021");
    await page.getByTestId("trade-partners-measure-trade.reexports").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.reexports");
    await page.screenshot({ path: info.outputPath(`domestic-countries-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });

    await section(page, "products").click();
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuemin", "2020");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.domestic_exports");
    await page.getByTestId("trade-products-add").click();
    await page.getByTestId("series-search").fill(prefix ? "Other commodities" : "სხვა საქონელი");
    await expect(page.getByTestId("trade-product-result")).toHaveCount(1);
    await page.getByTestId("series-search").fill("no-matching-product-xyz");
    await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
    await expect(page.getByTestId("series-status")).toContainText("101 / 101");
    await page.getByTestId("trade-products-compare").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "101");
    await page.screenshot({ path: info.outputPath(`domestic-products-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page.getByTestId("trade-domestic")).toHaveAttribute("data-section", "products");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "101");
    await page.getByTestId("trade-products-more").click(); await page.getByTestId("series-toggle-all").click();
    await page.getByTestId("trade-products-compare").click(); await page.reload();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("trade-products-excel-download")).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("Domestic Excel preserves the national split, unavailable country match and product remainder", async ({ page, request }) => {
  test.setTimeout(60_000);
  const download = async (id: string) => {
    const pending = page.waitForEvent("download"); await page.getByTestId(id).click();
    const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile((await (await pending).path())!); return excel;
  };
  await page.goto("/en/explorer/trade/domestic-exports#section=overview&view=table&sel=trade.exports,trade.domestic_exports,trade.reexports&start=2025&end=2025");
  await expect(page.getByTestId("series-status")).toContainText("3 / 3");
  const national = await download("trade-excel-download");
  expect(national.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  for (const [index, amount] of [7287805027.574291, 3360329267.0083367, 3927475760.5659541].entries()) {
    expect(national.getWorksheet("Data")!.getCell(index + 2, 4).value).toBeCloseTo(amount, 5);
  }
  expect(national.getWorksheet("Summary")!.getRow(2).height).toBeGreaterThan(15);

  await page.goto("/en/explorer/trade/domestic-exports#section=countries&view=table&measure=trade.reexports&sel=partner.2014-2025.807,partner.2014-2025.643");
  await expect(page.getByTestId("series-status")).toContainText("2 / 187");
  const countries = await download("trade-partners-excel-download");
  const unavailable: ExcelJS.Row[] = [];
  countries.getWorksheet("Data")!.eachRow(row => { if (row.getCell(3).value === "Macedonia (FYR)") unavailable.push(row); });
  expect(unavailable).toHaveLength(12);
  expect(unavailable.every(row => row.getCell(4).value === null)).toBe(true);

  await section(page, "products").click(); await page.getByTestId("trade-products-add").click();
  await page.getByTestId("series-toggle-all").click(); await page.getByTestId("series-toggle-all").click();
  await page.getByTestId("trade-products-compare").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "101");
  const products = await download("trade-products-excel-download");
  expect(products.getWorksheet("Data")!.rowCount).toBe(607);
  const remainder: ExcelJS.Row[] = [];
  products.getWorksheet("Data")!.eachRow(row => { if (row.getCell(3).value === "Other commodities" && row.getCell(1).value === 2025) remainder.push(row); });
  expect(remainder).toHaveLength(1);
  expect(remainder[0].getCell(4).value).toBeCloseTo(429174637.2342389, 5);
  for (const [filename, hash] of [
    ["domestic-export-country-2014-2026.xlsx", "c4591642eb78303086d4e1538aed31615e8b612b74b203bbbfcda98f826d972c"],
    ["domestic-exports-by-4-digit-2014-2026.xlsx", "512d7a9511a0312b3c184b57e05862e414f737d663d1b02cb1941df435248679"],
  ]) {
    const response = await request.get(`/downloads/methodology/trade/files/${filename}`);
    expect(response.ok()).toBe(true); expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(hash);
  }
});

test("nothing but the heading sits above the controls (DESIGN §17)", async ({ page }) => {
  await page.goto("/en/explorer/trade/domestic-exports");
  expect(await page.locator("h1").evaluate(heading => heading.nextElementSibling?.tagName)).not.toBe("P");
});
