import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { readTradeProductCatalogue } from "../../lib/data/tradeProducts/catalogue";
import type { ClientTradeProductsData } from "../../lib/data/tradeProducts/importTradeProducts";
import { encodeTradeProductsSelection } from "../../lib/explorer/tradeProductsSelection";
import { tableSeriesCount, tableSeriesValues } from "./explorer-table";

const root = path.resolve(process.cwd(), "../.."), output = path.resolve(process.cwd(), "output/trade-products");
let catalogue: ClientTradeProductsData;
test.beforeAll(async () => {
  const entities = (await readTradeProductCatalogue(root)).sort((a, b) => a.sourceBlock.localeCompare(b.sourceBlock, "en") || a.code.localeCompare(b.code, "en"));
  const catalogueFingerprint = createHash("sha256").update(await readFile(path.join(root, "data/imports/trade-products-catalogue.csv"))).digest("hex");
  catalogue = { entities, catalogueFingerprint, years: [], facts: [], nationalFacts: [] };
  await mkdir(output, { recursive: true });
});
const productToggle = (page: Page, id: string) => page.getByTestId("trade-products-picker").locator(`[data-series-id="${id}"]`).getByTestId("series-row-toggle");
const hash = (ids: string[], extra = "") => `#measure=trade.exports&view=line&sel=${encodeTradeProductsSelection(ids, catalogue)}${extra}`;

for (const prefix of ["", "/en"]) for (const width of [1366, 390]) {
  test(`opens the finder over the visible chart and cancels its draft ${prefix || "ka"} ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
    await page.goto(`${prefix}/explorer/trade/products`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "1");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.exports");
    const plot = page.getByTestId("trade-products-plot"), opener = page.getByTestId("trade-products-add"), picker = page.getByTestId("trade-products-picker");
    await expect(picker).toHaveCount(0);
    await expect(plot.locator("svg")).toBeVisible(); await page.evaluate(() => document.fonts.ready);
    const before = await plot.boundingBox(); expect(before!.y).toBeLessThan(page.viewportSize()!.height);
    await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2025");
    await expect(page.getByTestId("range-start-handle")).toHaveAttribute("aria-valuenow", "1995");
    await page.screenshot({ path: path.join(output, `${prefix ? "en" : "ka"}-${width}-page.png`), fullPage: true });
    const chartElement = await plot.locator("svg").elementHandle();
    await opener.click(); await expect(picker).toBeVisible();
    expect((await plot.boundingBox())!.y).toBeCloseTo(before!.y, 0);
    await expect(page.getByTestId("trade-products-close")).toBeFocused();
    await expect(page.getByTestId("trade-product-category")).toHaveCount(8);
    await expect(page.getByTestId("trade-product-result")).toHaveCount(0);
    await page.screenshot({ path: path.join(output, `${prefix ? "en" : "ka"}-${width}-picker.png`) });
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await picker.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await page.getByTestId("series-search").fill("cars");
    await productToggle(page, "goods.hs4.2020-2025.8703").click();
    await expect(page.getByTestId("series-status")).toContainText("2 / 4769");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "1");
    await page.keyboard.press("Escape"); await expect(picker).toHaveCount(0); await expect(opener).toBeFocused();
    expect(await chartElement!.evaluate(element => element.isConnected)).toBe(true);
    for (const method of ["close", "backdrop"] as const) {
      await page.evaluate(() => window.scrollTo(0, 120));
      const scroll = await page.evaluate(() => scrollY);
      await opener.click(); await page.getByTestId("series-search").fill("8703");
      await productToggle(page, "goods.hs4.2015-2019.8703").click();
      if (method === "close") await page.getByTestId("trade-products-close").click(); else await page.mouse.click(2, 2);
      await expect(picker).toHaveCount(0); await expect(opener).toBeFocused();
      expect(await page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
      await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "1");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const prefix of ["", "/en"]) {
  test(`historical comparisons retain gaps, navigation, empty selection and language ${prefix || "ka"}`, async ({ page }) => {
    await page.setViewportSize({ width: prefix ? 1366 : 390, height: 844 });
    const ids = ["goods.hs4.2015-2019.8703", "goods.hs4.2020-2025.8703"];
    await page.goto(`${prefix}/explorer/trade/products${hash(ids, "&start=2018&end=2025")}`);
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "2");
    await expect(page.getByTestId("trade-products-selected-label").first()).toContainText("8703 · 2015–2019");
    await page.getByTestId("chart-mode-table").click();
    const table = page.getByTestId("explorer-table");
    expect(await tableSeriesCount(table)).toBe(2);
    expect((await tableSeriesValues(table, "8703 · 2015–2019")).at(-1)).toBe("—");
    const end = page.getByTestId("range-end-handle"); await end.focus();
    for (let i = 0; i < 6; i++) await end.press("ArrowLeft");
    await expect(end).toHaveAttribute("aria-valuenow", "2019");
    expect((await tableSeriesValues(table, "8703 · 2020–2025")).every(value => value === "—")).toBe(true);
    await page.getByTestId("trade-products-measure-trade.imports").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.imports");
    await page.goBack(); await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.exports");
    await page.goForward(); await page.reload();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "2");
    const saved = page.url();
    if (!prefix) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("trade-products-link").click(); await expect(page).toHaveURL(saved);
    if (!prefix) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "2");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "trade.imports");
    await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2019");
    await page.goto(`${prefix}/explorer/trade/products${hash([])}`); await page.reload();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("trade-products-excel-download")).toBeDisabled();
    await expect(page.getByTestId("trade-products-selection-reset")).toHaveCount(0);
    await page.goto(`${prefix}/explorer/trade/products#sel=v1.${"0".repeat(64)}.bad`);
    await expect(page.getByTestId("trade-products-selection-reset")).toBeVisible();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "1");
  });
}

test("global filtered selection plots and exports every historical product beyond all visible pages", async ({ page, request }, info) => {
  test.setTimeout(240_000);
  const timings: Record<string, number> = {}, errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 }); await page.goto("/en/explorer/trade/products");
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
  let start = Date.now(); await page.getByTestId("trade-products-add").click(); await expect(page.getByTestId("trade-product-category")).toHaveCount(8); timings.openMs = Date.now() - start;
  await page.getByTestId("trade-product-category").filter({ hasText: "Vehicles and transport" }).click();
  expect(await page.getByTestId("trade-product-result").count()).toBe(25);
  await page.getByTestId("series-search").fill("no-matching-product-xyz");
  await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("0 / 4769");
  await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("4769 / 4769");
  await page.getByTestId("trade-products-tab-selected").click();
  await expect(page.getByTestId("trade-product-result")).toHaveCount(25);
  await page.getByTestId("trade-products-next").click(); await expect(page.getByTestId("trade-product-result")).toHaveCount(25);
  start = Date.now(); await page.getByTestId("trade-products-compare").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "4769"); timings.applyAllMs = Date.now() - start;
  expect(new URL(page.url()).hash.length).toBeLessThan(1024);
  await expect(page.locator('[data-testid="trade-products-selected-label"]:visible')).toHaveCount(4);
  const facts = parse(await readFile(path.join(root, "data/imports/trade-products-annual.csv")), { columns: true, bom: true }) as Record<string, string>[];
  const numericalExports = new Set(facts.filter(fact => fact.indicator_id === "trade.exports" && fact.value_status === "numeric").map(fact => fact.entity_id));
  await expect(page.getByTestId("trade-products-plot").locator('svg circle[r="3.5"]:not([stroke])')).toHaveCount(numericalExports.size + 1);
  await writeFile(path.join(output, "timings.json"), JSON.stringify(timings, null, 2));
  start = Date.now(); await page.getByTestId("trade-products-more").click(); await expect(page.getByTestId("series-status")).toContainText("4769 / 4769"); timings.reopenAllMs = Date.now() - start;
  start = Date.now(); await page.getByTestId("series-search").fill("8703"); await expect(page.getByTestId("trade-product-result")).toHaveCount(4); timings.searchAllMs = Date.now() - start;
  await page.getByTestId("trade-products-close").click(); await expect(page.getByTestId("trade-products-more")).toBeFocused();
  await page.getByTestId("chart-mode-table").click(); expect(await tableSeriesCount(page.getByTestId("explorer-table"))).toBe(25);
  await page.getByTestId("trade-products-table-next").click(); expect(await tableSeriesCount(page.getByTestId("explorer-table"))).toBe(25);
  start = Date.now(); const pending = page.waitForEvent("download", { timeout: 180_000 }); await page.getByTestId("trade-products-excel-download").click(); const download = await pending; timings.exportAllMs = Date.now() - start;
  await writeFile(path.join(output, "timings.json"), JSON.stringify(timings, null, 2));
  const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile((await download.path())!);
  expect(excel.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(excel.getWorksheet("Data")!.rowCount).toBe(4769 * 31 + 1);
  expect(excel.getWorksheet("Summary")!.rowCount).toBe(4769 + 4);
  expect(excel.getWorksheet("Data")!.getCell("D1").value).toBe("Amount (USD)");
  for (const period of ["1995–1999", "2000–2014", "2015–2019", "2020–2025"]) {
    expect(excel.getWorksheet("Summary")!.getColumn(1).values.some(value => String(value).includes(`8703 · ${period}`))).toBe(true);
  }
  const sourceSheet = excel.getWorksheet("Sources")!; expect(sourceSheet.rowCount).toBe(7);
  for (const row of [4, 5, 6, 7]) {
    const link = sourceSheet.getCell(row, 4).value as { hyperlink: string };
    expect(link.hyperlink).toContain("https://fiscal.ge/downloads/methodology/trade/files/");
    const response = await request.get(new URL(link.hyperlink).pathname); expect(response.ok()).toBe(true);
  }
  await page.getByTestId("trade-products-more").click(); await page.getByTestId("series-search").fill("8703");
  await productToggle(page, "goods.hs4.1995-1999.8703").click(); await page.getByTestId("trade-products-compare").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-selected-count", "4768");
  await page.getByTestId("trade-partners-show-all").click();
  expect(await page.getByTestId("trade-partners-ranking-row").count()).toBe(25);
  await page.getByTestId("trade-products-ranking-next").click();
  expect(await page.getByTestId("trade-partners-ranking-row").count()).toBe(25);
  for (let index = 0; index < 100 && !(await page.getByTestId("trade-partners-unavailable-row").count()); index++) await page.getByTestId("trade-products-ranking-next").click();
  expect(await page.getByTestId("trade-partners-unavailable-row").count()).toBeGreaterThan(0);
  expect(await page.getByTestId("trade-partners-unavailable-row").count() + await page.getByTestId("trade-partners-ranking-row").count()).toBeLessThanOrEqual(25);
  expect(errors).toEqual([]);
  await writeFile(path.join(output, "timings.json"), JSON.stringify(timings, null, 2));
  await info.attach("all-products-timings", { body: JSON.stringify(timings), contentType: "application/json" });
});
