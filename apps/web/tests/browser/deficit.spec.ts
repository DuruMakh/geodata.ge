import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { TEST_BASE_URL } from "./test-base-url";

test.describe("General-government deficit explorer", () => {
  // The 390px page overflow is checked by the layout pass in mobile-fit-charts.spec.ts.
  test("renders the percentage-first actual and projection series on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${TEST_BASE_URL}/explorer/deficit`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("რამდენია საქართველოს ბიუჯეტის დეფიციტი");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "percent");
    await expect(page.getByTestId("deficit-deck")).toContainText("2025: ზოგადი მთავრობის ბალანსი · −1.5%");
    await expect(page.getByTestId("series-row")).toHaveCount(1);
    // One series: no search field.
    await expect(page.getByTestId("series-search")).toHaveCount(0);
    await expect(page.getByTestId("chart-series-deficit.general_government.balance-actual")).toBeVisible();
    await expect(page.getByTestId("chart-series-deficit.general_government.balance-forecast")).toHaveAttribute("stroke-dasharray", "6 5");
    await expect(page.getByTestId("range-marker")).toContainText("პროგნოზი");
    // The projection, actual-period and sign notes; the explorer renders no footer of its own.
    const explorer = page.getByTestId("deficit-explorer");
    await expect(explorer).toContainText("2026–2031 წლები IMF-ის პროგნოზია");
    await expect(explorer).toContainText("1995–2025 წლები ამ WEO გამოცემაში ფაქტობრივ პერიოდადაა მონიშნული");
    await expect(explorer).toContainText("უარყოფითი მნიშვნელობა დეფიციტია");
    await expect(explorer.getByTestId("site-footer")).toHaveCount(0);
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 2);
  });

  test("switches between GDP percentage, nominal GEL and the forecast-labelled table", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/deficit`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("series-row")).toContainText("−1.5%");

    await page.getByTestId("measure-share-toggle").click();
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "amount");
    await expect(page.getByTestId("deficit-measure-label")).toHaveText("მლრდ ₾");
    // U07-13: the deck and the series row at the table's two decimals, one figure on one screen.
    await expect(page.getByTestId("series-row")).toContainText("−1.53 მლრდ ₾");
    await expect(page.getByTestId("deficit-deck")).toContainText("−1.53 მლრდ ₾");
    await expect(page.getByTestId("series-row")).not.toContainText("−1.5%");
    await page.getByTestId("chart-mode-table").click();
    await expect(page.getByTestId("explorer-table")).toBeVisible();
    await expect(page.getByTestId("explorer-table").getByText("პროგნოზი", { exact: true })).toHaveCount(6);
    await expect(page.getByTestId("explorer-table").locator("td").filter({ hasText: "−1.53" })).not.toHaveCount(0);
  });

  // U07-01/U07-16: the dashed segment was the only forecast cue, and a range of one projection point has none.
  test("hovering a projection year shows the forecast label", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/deficit#r=2030-2031`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    const chart = page.getByTestId("chart-panel").getByRole("img");
    await chart.hover({ position: { x: 300, y: 100 } });
    await expect(page.getByTestId("chart-tooltip")).toContainText("პროგნოზი");

    // An actual year reads without it.
    await page.goto(`${TEST_BASE_URL}/explorer/deficit#r=2024-2025`);
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await chart.hover({ position: { x: 300, y: 100 } });
    await expect(page.getByTestId("chart-tooltip")).toBeVisible();
    await expect(page.getByTestId("chart-tooltip")).not.toContainText("პროგნოზი");
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
    await page.getByTestId("series-row-toggle").click();
    await expect(page).toHaveURL(/sel=deficit\.general_government\.balance$/);
  });

  // U07-02: the hash was read once on mount, so an address-bar edit left the URL and the view disagreeing.
  test("editing the hash in the address bar updates the view", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/deficit`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "line");

    await page.evaluate(() => { window.location.hash = "m=table&sh=0&r=2020-2025"; });
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
    await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "amount");
    await expect(page.getByRole("slider", { name: "საწყისი წელი" })).toHaveAttribute("aria-valuenow", "2020");
    await expect(page.getByRole("slider", { name: "საბოლოო წელი" })).toHaveAttribute("aria-valuenow", "2025");

    // The next change builds on the edited state instead of overwriting it with the old one.
    await page.getByTestId("chart-mode-line").click();
    await expect(page).toHaveURL(/#m=line&sh=0&r=2020-2025&sel=deficit\.general_government\.balance$/);
  });

  // Review Focus 3: a deliberate clear must not come back as the default selection.
  test("an explicitly empty sel= survives Back and Forward", async ({ page }) => {
    await page.goto(`${TEST_BASE_URL}/explorer/deficit`);
    await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
    await page.getByTestId("series-row-toggle").click();
    await expect(page).toHaveURL(/sel=$/);

    await page.evaluate(() => { window.location.hash = "m=line&sh=1&r=2010-2025&sel=deficit.general_government.balance"; });
    await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/sel=$/);
    await expect(page.getByTestId("no-selection-callout")).toBeVisible();
    await expect(page.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "false");

    await page.goForward();
    await expect(page.getByTestId("no-selection-callout")).toHaveCount(0);
    await expect(page.getByRole("slider", { name: "საწყისი წელი" })).toHaveAttribute("aria-valuenow", "2010");
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
    expect(dataRows.find((row) => row.getCell(1).value === 2025)?.getCell(4).value).toBe("ფაქტი");
    expect(dataRows.find((row) => row.getCell(1).value === 2026)?.getCell(4).value).toBe("პროგნოზი");
    expect(workbook.getWorksheet("წყაროები")!.getCell("C4").value).toContain("IMF");
  });
});
