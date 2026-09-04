import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";

async function expectAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));

  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 2);
}

function seriesRow(page: Page, id: string) {
  return page.locator(`[data-testid="series-row"][data-series-id="${id}"]`);
}

test.describe("Government Debt explorer", () => {
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1366, height: 768 },
  ] as const) {
    test(`renders the one-chart default with all nine rows expanded on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`${BASE_URL}/explorer/debt`);
      await expectAppReady(page);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText("რამდენია მთავრობის ვალი და როგორ ვიხდით მას");
      await expect(page.getByTestId("debt-explorer")).toHaveCount(1);
      await expect(page.getByTestId("chart-panel")).toHaveCount(1);
      await expect(page.getByRole("img", { name: "მრავალწლიანი დინამიკა" })).toHaveCount(1);
      await expect(page.getByTestId("explorer-table")).toHaveCount(0);

      const selector = page.getByTestId("series-selector");
      await expect(selector.getByTestId("series-row")).toHaveCount(9);
      await expect(selector.locator('[data-level="debt_parent"]')).toHaveCount(3);
      await expect(selector.locator('[data-level="debt_child"]')).toHaveCount(6);
      for (const parentId of ["debt.stock.total", "debt.service.total", "debt.rate.total"]) {
        await expect(seriesRow(page, parentId).locator('button[aria-expanded="true"]')).toHaveCount(1);
      }

      await expect(selector.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
      await expect(seriesRow(page, "debt.stock.total").getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
      await expect(selector.getByTestId("series-status")).toContainText("1 / 9");
      await expect(page.getByTestId("year-range-strip")).toContainText("2013–2025");
      await expect(page.getByTestId("chart-mode-line")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("measure-share-toggle")).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByTestId("debt-excel")).toBeEnabled();

      await page.getByTestId("measure-share-toggle").click();
      await expect(page.getByTestId("measure-share-toggle")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "percent");
      await expect(page.getByTestId("debt-measure-label")).toHaveText("% მშპ-ში");
      await expectNoPageOverflow(page);
    });
  }

  test("keeps same-family multi-selection and clears incompatible selections and ranges", async ({ page }) => {
    await page.goto(`${BASE_URL}/explorer/debt`);
    await expectAppReady(page);

    const startHandle = page.getByTestId("range-start-handle");
    await startHandle.press("ArrowRight");
    await startHandle.press("ArrowRight");
    await expect(startHandle).toHaveAttribute("aria-valuenow", "2015");

    await seriesRow(page, "debt.stock.domestic").getByTestId("series-row-toggle").click();
    await seriesRow(page, "debt.stock.external").getByTestId("series-row-toggle").click();
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(3);
    await expect(page.getByTestId("series-status")).toContainText("3 / 9");

    await seriesRow(page, "debt.service.interest").getByTestId("series-row-toggle").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-family", "service");
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
    await expect(seriesRow(page, "debt.service.interest").getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("year-range-strip")).toContainText("2013–2030");
    await expect(page.getByTestId("measure-share-toggle")).toHaveCount(0);

    await page.getByTestId("range-end-handle").press("ArrowLeft");
    await expect(page.getByTestId("range-end-handle")).toHaveAttribute("aria-valuenow", "2029");
    await seriesRow(page, "debt.rate.external").getByTestId("series-row-toggle").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-family", "rate");
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
    await expect(seriesRow(page, "debt.rate.external").getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("year-range-strip")).toContainText("2015–2025");
    await expect(page.getByTestId("debt-measure-label")).toHaveText("%");
  });

  test("shows published rate gaps in the table and switches back to the one line chart", async ({ page }) => {
    await page.goto(`${BASE_URL}/explorer/debt#f=rate&m=table&r=2015-2025&sel=debt.rate.external`);
    await expectAppReady(page);

    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-family", "rate");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("measure-share-toggle")).toHaveCount(0);
    const rateRow = page.getByTestId("explorer-table").getByRole("row").filter({ hasText: "საგარეო განაკვეთი" });
    await expect(rateRow.getByText("—", { exact: true })).toHaveCount(7);
    await expect(rateRow).toContainText("0.9%");
    await expect(rateRow).toContainText("3.1%");

    await page.getByTestId("chart-mode-line").click();
    await expect(page.getByTestId("explorer-table")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "მრავალწლიანი დინამიკა" })).toHaveCount(1);
  });

  test("marks the service forecast and downloads its active actual and forecast rows", async ({ page }) => {
    await page.goto(`${BASE_URL}/explorer/debt#f=service&m=line&r=2024-2026&sel=debt.service.total`);
    await expectAppReady(page);

    await expect(page.getByTestId("chart-series-debt.service.total-actual")).toBeVisible();
    const forecastPath = page.getByTestId("chart-series-debt.service.total-forecast");
    await expect(forecastPath).toBeVisible();
    await expect(forecastPath).toHaveAttribute("stroke-dasharray", "6 5");
    await expect(page.getByTestId("range-marker")).toContainText("პროგნოზი");
    await expect(page.getByTestId("debt-forecast-note")).toContainText("2025-12-31");
    await expect(page.getByTestId("debt-forecast-note")).toContainText("არ წარმოადგენს მომავალი ბიუჯეტის სრულ პროგნოზს");

    await page.getByTestId("chart-mode-table").click();
    await expect(page.getByTestId("explorer-table")).toBeVisible();
    await expect(page.getByTestId("explorer-table").getByText("პროგნოზი", { exact: true })).toHaveCount(1);

    const button = page.getByTestId("debt-excel");
    await expect(button).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("fiscal-government-debt-service-2024-2026.xlsx");
    const path = await download.path();
    if (!path) throw new Error("Expected a local XLSX download path");
    const bytes = await readFile(path);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(bytes).buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
    const dataRows = (workbook.getWorksheet("მონაცემები")!.getRows(2, 10) ?? [])
      .filter((row) => row.getCell(1).value !== null);
    expect(dataRows.map((row) => [row.getCell(1).value, row.getCell(5).value])).toEqual([
      [2024, "ფაქტი"],
      [2025, "ფაქტი"],
      [2026, "პროგნოზი"],
    ]);
  });
});
