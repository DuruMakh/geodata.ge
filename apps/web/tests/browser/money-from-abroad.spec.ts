import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { tableSeriesCount, tableSeriesValues } from "./explorer-table";
const toggle = (page: import("@playwright/test").Page, id: string) => page.locator(`[data-series-id="${id}"]`).getByTestId("series-row-toggle");

for (const prefix of ["", "/en"]) for (const width of [390, 768, 1440]) {
  test(`Money from abroad defaults, Received/Sent, one series list, ranking and search-safe bulk selection ${prefix || "ka"} ${width}px`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 }); await page.goto(`${prefix}/explorer/external`);
    const cards = page.getByTestId("external-hub").getByTestId("hub-card"); await expect(cards).toHaveCount(3);
    await expect(cards.nth(1)).not.toHaveAttribute("href", /./);
    await cards.nth(0).click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/explorer/external/money-from-abroad$`));
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("series-status")).toContainText("1 / 12");
    await expect(toggle(page, "transfer.total")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "received");
    await expect(page.getByTestId("chart-break")).toHaveCount(0);
    await expect(page.getByTestId("money-from-abroad-tab-countries")).toHaveCount(0);
    const ranking = page.getByTestId("money-from-abroad-ranking-row");
    await expect(ranking).toHaveCount(10);
    await expect(ranking.first()).toHaveAttribute("data-entity-id", "transfer.united_states_of_america");
    await expect(ranking.first()).toContainText("682.9");
    await expect(page.getByTestId("money-from-abroad-other-row")).toHaveCount(1);
    await expect(page.getByTestId("money-from-abroad-show-all")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`money-default-${prefix ? "en" : "ka"}-${width}.png`), fullPage: true });
    await page.getByTestId("money-from-abroad-measure-sent").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "sent");
    await expect(page.getByTestId("money-from-abroad-ranking")).toHaveAttribute("data-measure", "sent");
    await expect(ranking).toHaveCount(10);
    await toggle(page, "transfer.others").click();
    await page.getByTestId("series-search").fill("no-matching-series-xyz");
    await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("0 / 12");
    await page.getByTestId("series-toggle-all").click(); await expect(page.getByTestId("series-status")).toContainText("12 / 12");
    await page.getByTestId("series-toggle-all").click();
    await page.getByTestId("chart-mode-table").click(); await page.reload();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "sent");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

for (const prefix of ["", "/en"]) for (const width of [390, 1440]) {
  test(`A table with partial 2019 values survives sidebar, reload, language and history ${prefix || "ka"} ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${prefix}/explorer/external/money-from-abroad#measure=received&view=table&sel=transfer.total,transfer.greece,transfer.others&start=2009&end=2019`);
    await expect(page.getByTestId("series-status")).toContainText("3 / 12");
    const table = page.getByTestId("explorer-table");
    expect(await tableSeriesCount(table)).toBe(3);
    expect(await tableSeriesValues(table, prefix ? "Other countries" : "სხვა ქვეყნები")).toHaveLength(11);
    await expect(table).toContainText(prefix ? "partial" : "არასრ.");
    await expect(page.getByTestId("money-from-abroad-partial-note")).toBeVisible();
    const before = page.url();
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("money-from-abroad-link").click(); await expect(page).toHaveURL(before);
    if (width < 900) await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
    await page.reload();
    await expect(page.getByTestId("series-status")).toContainText("3 / 12");
    if (width < 900) await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("data-sidebar").getByRole("link", { name: prefix ? "ქართული" : "English", exact: true }).click();
    await expect(page.getByTestId("series-status")).toContainText("3 / 12");
    await expect(page.getByTestId("money-from-abroad-ranking")).toHaveAttribute("data-end-year", "2019");
    await page.screenshot({ path: info.outputPath(`money-mixed-${prefix ? "ka" : "en"}-${width}.png`), fullPage: true });
    await toggle(page, "transfer.greece").focus(); await toggle(page, "transfer.greece").press("Space");
    await expect(page.getByTestId("series-status")).toContainText("2 / 12");
    await page.goBack(); await expect(page.getByTestId("series-status")).toContainText("3 / 12");
    await page.goForward(); await expect(page.getByTestId("series-status")).toContainText("2 / 12");
  });
}

test("Excel follows the selection and measure and links the untouched NBG original", async ({ page, request }) => {
  await page.goto("/en/explorer/external/money-from-abroad#measure=sent&view=line&sel=transfer.total,transfer.greece,transfer.others&start=2019&end=2019");
  await expect(page.getByTestId("series-status")).toContainText("3 / 12");
  const pending = page.waitForEvent("download"); await page.getByTestId("money-from-abroad-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("fiscal-money-from-abroad-2019-2019-en.xlsx");
  const excel = new ExcelJS.Workbook(); await excel.xlsx.readFile((await download.path())!);
  expect(excel.worksheets.map(sheet => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  const values = excel.getWorksheet("Data")!.getSheetValues().flat().map(String);
  expect(values.some(value => value.includes("Greece"))).toBe(true);
  expect(values.some(value => value.includes("Other countries"))).toBe(true);
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
