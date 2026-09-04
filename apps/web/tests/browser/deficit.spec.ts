import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { TEST_BASE_URL } from "./test-base-url";

test.describe("General-government deficit explorer", () => {
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1366, height: 768 },
  ] as const) {
    test(`renders the percentage-first actual and projection series on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`${TEST_BASE_URL}/explorer/deficit`);
      await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("რამდენია საქართველოს ბიუჯეტის დეფიციტი");
      await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "percent");
      await expect(page.getByTestId("deficit-deck")).toContainText("2025: ზოგადი მთავრობის ბალანსი · −1.5%");
      await expect(page.getByTestId("series-row")).toHaveCount(1);
      await expect(page.getByTestId("chart-series-deficit.general_government_balance-actual")).toBeVisible();
      await expect(page.getByTestId("chart-series-deficit.general_government_balance-forecast")).toHaveAttribute("stroke-dasharray", "6 5");
      await expect(page.getByTestId("range-marker")).toContainText("პროგნოზი");
      const overflow = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 2);
    });
  }

  test("switches between GDP percentage, nominal GEL and the forecast-labelled table", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/deficit`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

    await page.getByTestId("measure-share-toggle").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "amount");
    await expect(page.getByTestId("deficit-measure-label")).toHaveText("მლრდ ₾");
    await page.getByTestId("chart-mode-table").click();
    await expect(page.getByTestId("explorer-table")).toBeVisible();
    await expect(page.getByTestId("explorer-table").getByText("პროგნოზი", { exact: true })).toHaveCount(6);
  });

  test("restores and updates its shareable URL state", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/deficit#m=table&sh=0&r=2001-2026&sel=deficit.general_government_balance`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "amount");
    await expect(page.getByRole("slider", { name: "საწყისი წელი" })).toHaveAttribute("aria-valuenow", "2001");
    await expect(page.getByRole("slider", { name: "საბოლოო წელი" })).toHaveAttribute("aria-valuenow", "2026");

    await page.getByTestId("series-row-toggle").click();
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page).toHaveURL(/#m=table&sh=0&r=2001-2026&sel=$/);
  });

  test("downloads the active range with IMF source and projection status", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/deficit`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("deficit-excel").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("fiscal-general-government-deficit-1995-2031.xlsx");
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error("Expected a local XLSX download path");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(await readFile(downloadPath)).buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
    const dataRows = workbook.getWorksheet("მონაცემები")!.getRows(2, 50) ?? [];
    expect(dataRows.find((row) => row.getCell(1).value === 2025)?.getCell(5).value).toBe("ფაქტი");
    expect(dataRows.find((row) => row.getCell(1).value === 2026)?.getCell(5).value).toBe("პროგნოზი");
    expect(workbook.getWorksheet("წყაროები")!.getCell("C4").value).toContain("IMF");
  });
});
