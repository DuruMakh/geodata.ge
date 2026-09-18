import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { TEST_BASE_URL } from "./test-base-url";

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
      await page.goto(`${TEST_BASE_URL}/explorer/debt`);
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
      for (const childId of [
        "debt.stock.domestic",
        "debt.stock.external",
        "debt.service.principal",
        "debt.service.interest",
        "debt.rate.domestic",
        "debt.rate.external",
      ]) {
        await expect(seriesRow(page, childId)).toBeVisible();
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

      if (viewport.name === "mobile") {
        await selector.scrollIntoViewIfNeeded();
        const childToggle = seriesRow(page, "debt.stock.domestic").getByTestId("series-row-toggle");
        await childToggle.scrollIntoViewIfNeeded();
        await expect(childToggle).toBeInViewport();
        await expect(seriesRow(page, "debt.stock.domestic").getByTestId("series-label")).toHaveCSS("font-size", "12px");
        await childToggle.click();
        await expect(childToggle).toHaveAttribute("aria-pressed", "true");
      }
    });
  }

  test("keeps same-family multi-selection and clears incompatible selections and ranges", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/debt`);
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
    await page.goto(`${TEST_BASE_URL}/explorer/debt#f=rate&m=table&r=2015-2025&sel=debt.rate.external`);
    await expectAppReady(page);

    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-family", "rate");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("measure-share-toggle")).toHaveCount(0);
    const table = page.getByTestId("explorer-table");
    const expectedByYear = [
      [2015, "—"],
      [2016, "—"],
      [2017, "—"],
      [2018, "—"],
      [2019, "—"],
      [2020, "—"],
      [2021, "0.9%"],
      [2022, "2.2%"],
      [2023, "3.4%"],
      [2024, "3.1%"],
      [2025, "—"],
    ] as const;
    await expect(table.getByRole("columnheader")).toHaveText(["სერია", ...expectedByYear.map(([year]) => String(year))]);
    const rateRow = table.getByRole("row").filter({ hasText: "საგარეო განაკვეთი" });
    await expect(rateRow.getByRole("cell")).toHaveText(["საგარეო განაკვეთი", ...expectedByYear.map(([, value]) => value)]);

    await page.getByTestId("chart-mode-line").click();
    await expect(page.getByTestId("explorer-table")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "მრავალწლიანი დინამიკა" })).toHaveCount(1);
  });

  test("restores the family total for unknown-only selections but preserves explicit empty selection", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/debt#f=rate&m=line&r=2015-2025&sel=obsolete.rate.series`);
    await expectAppReady(page);

    await expect(seriesRow(page, "debt.rate.total").getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("series-status")).toContainText("1 / 9");
    await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);

    // Change the document URL as well as the hash: the explorer intentionally
    // parses shared-link state once per mount, so a hash-only navigation would
    // keep the first case's live state instead of exercising a fresh restore.
    await page.goto(`${TEST_BASE_URL}/explorer/debt?case=empty#f=rate&m=line&r=2015-2025&sel=`);
    await expectAppReady(page);
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByTestId("series-status")).toContainText("0 / 9");
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  });

  test("shows the no-range-data callout for an all-gap rate interval in line and table modes", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/debt#f=rate&m=line&r=2015-2017&sel=debt.rate.external`);
    await expectAppReady(page);

    const callout = page.getByTestId("no-range-data-callout");
    await expect(callout).toContainText("არჩეული სერიებისთვის ამ დიაპაზონში მონაცემები არ არის");
    await expect(page.getByRole("img", { name: "მრავალწლიანი დინამიკა" })).toHaveCount(0);

    await page.getByTestId("chart-mode-table").click();
    await expect(callout).toBeVisible();
    await expect(page.getByTestId("explorer-table")).toHaveCount(0);
  });

  test("keeps the deck on the latest actual year for every family", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/debt#f=stock&m=line&r=2013-2024&sel=debt.stock.total`);
    await expectAppReady(page);

    await expect(page.getByTestId("debt-deck")).toContainText("2025: მთავრობის ვალი");
    await expect(page.getByTestId("debt-deck")).toContainText("+8.3%");
    await expect(page.getByTestId("debt-deck")).toContainText("წინა წელთან");

    await page.goto(`${TEST_BASE_URL}/explorer/debt?case=service-deck#f=service&m=line&r=2013-2025&sel=debt.service.total`);
    await expectAppReady(page);
    await expect(page.getByTestId("debt-deck")).toContainText("2025: ვალის გადახდა · 4.4 მლრდ ₾");
    await expect(page.getByTestId("debt-deck")).toContainText("−9.2%");
    await expect(page.getByTestId("debt-deck")).not.toContainText("პროგნოზი");

    await page.goto(`${TEST_BASE_URL}/explorer/debt?case=rate-deck#f=rate&m=line&r=2015-2025&sel=debt.rate.total`);
    await expectAppReady(page);
    await expect(page.getByTestId("debt-deck")).toContainText("2025: საპროცენტო განაკვეთი · 4.7%");
    await expect(page.getByTestId("debt-deck")).toContainText("−0.2 პპ");
  });

  test("marks the service forecast and downloads its active actual and forecast rows", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/debt#f=service&m=line&r=2024-2026&sel=debt.service.total`);
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
