import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const PATH = "/explorer/demography/migration";

for (const [locale, prefix, heading, coverage, net] of [
  ["ka", "", "მიგრაცია", "2012–2025 · წლიური", "წმინდა მიგრაცია"],
  ["en", "/en", "Migration", "2012–2025 · annual", "Net migration"],
] as const) {
  test(`${locale}: opens on all six groups with both directions and the net line`, async ({ page }) => {
    await page.goto(`${prefix}${PATH}`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toContainText(coverage);
    await expect(page.getByTestId("series-row")).toHaveCount(6);
    await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(6);
    await expect(page.getByTestId("chart-panel").locator("[data-overlay]").first()).toBeAttached();
    await expect(page.getByTestId("chart-panel")).toContainText(net);
    await expect(page.getByTestId("migration-highlights")).toContainText("+17,127");
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("");
  });
}

test("removing Russia relabels the net line, removes its bars and writes the selection to the address", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  const segments = (id: string) => page.locator(`rect[data-segment="${id}"]`);
  await expect.poll(() => segments("arrivals:citizenship.russian_federation").count()).toBeGreaterThan(0);
  await expect.poll(() => segments("departures:citizenship.russian_federation").count()).toBeGreaterThan(0);
  const russia = page.locator('[data-testid="series-row"][data-series-id="citizenship.russian_federation"] [data-testid="series-row-toggle"]');
  await russia.click();
  await expect(russia).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toContainText("Net migration (selected groups)");
  await expect(segments("arrivals:citizenship.russian_federation")).toHaveCount(0);
  await expect(segments("departures:citizenship.russian_federation")).toHaveCount(0);
  expect(await segments("arrivals:citizenship.georgia").count()).toBeGreaterThan(0);
  expect(await segments("departures:citizenship.georgia").count()).toBeGreaterThan(0);
  await expect(page).toHaveURL(/sel=citizenship\.georgia%2Ccitizenship\.turkey/);
});

test("moving the range end changes the period of the key figures and the address", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  const highlights = page.getByTestId("migration-highlights");
  await expect(highlights).toHaveAttribute("data-end-year", "2025");
  const endHandle = page.getByTestId("range-end-handle");
  await endHandle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(endHandle).toHaveAttribute("aria-valuenow", "2024");
  await expect(highlights).toHaveAttribute("data-end-year", "2024");
  await expect(page).toHaveURL(/end=2024/);
});

test("the series search matches the group in either language", async ({ page }) => {
  for (const [path, query] of [
    [PATH, "russia"],
    [`/en${PATH}`, "რუსეთი"],
  ] as const) {
    await page.goto(path);
    await ready(page);
    await page.getByTestId("series-search").fill(query);
    await expect(page.getByTestId("series-row"), `${path} search "${query}"`).toHaveCount(1);
    await expect(page.getByTestId("series-row")).toHaveAttribute("data-series-id", "citizenship.russian_federation");
  }
});

test("the sex tabs change the chart, the table and the key figures", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  const overlay = page.getByTestId("chart-panel").locator("path[data-overlay]").first();
  const totalNet = await overlay.getAttribute("d");
  await page.getByTestId("migration-sex-female").click();
  await expect(page.getByTestId("migration-highlights")).toContainText("+7,516");
  await expect(page).toHaveURL(/sex=female/);
  await expect(overlay).not.toHaveAttribute("d", totalNet!);
  await page.getByTestId("chart-mode-table").click();
  const totalRow = page.getByTestId("explorer-table").locator("tbody tr").last();
  await expect(totalRow).toContainText("Total");
  await expect(totalRow).not.toContainText("205,857");
});

test("the table shows arrivals, departures and net with a total row", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByRole("table")).toContainText("205,857");
  const totalRow = page.getByTestId("explorer-table").locator("tbody tr").last();
  await expect(totalRow).toContainText("Total");
  await expect(totalRow).toContainText("205,857");
  await page.getByTestId("migration-direction-departures").click();
  await expect(page.getByRole("table")).toContainText("245,064");
  await page.getByTestId("migration-direction-net").click();
  await expect(page.getByRole("table")).toContainText("−39,207");
  await expect(page).toHaveURL(/dir=net/);
});

test("a shared link restores the view and the address stays as shared", async ({ page }) => {
  const shared = `/en${PATH}#view=table&sex=male&dir=departures&start=2020&end=2023`;
  await page.goto(shared);
  await ready(page);
  await expect(page.getByTestId("migration-sex-male")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("migration-highlights")).toHaveAttribute("data-end-year", "2023");
  expect(page.url()).toContain("#view=table&sex=male&dir=departures&start=2020&end=2023");
});

test("the Excel download has three sheets and numeric persons", async ({ page }, testInfo) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("migration-excel-download").click()]);
  expect(download.suggestedFilename()).toBe("fiscal-demography-migration-2012-2025-en.xlsx");
  const file = testInfo.outputPath("migration.xlsx");
  await download.saveAs(file);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  const data = workbook.getWorksheet("Data")!;
  expect(typeof data.getRow(2).getCell(5).value).toBe("number");
});

test("the hub card and the sidebar link the Migration page", async ({ page }) => {
  await page.goto("/en/explorer/demography");
  await expect(page.getByTestId("demography-hub").locator(`a[href="/en${PATH}"]`)).toHaveCount(1);
  await page.goto(`/en${PATH}`);
  await ready(page);
  await expect(page.getByTestId("demography-migration-link")).toHaveAttribute("aria-current", "page");
});

test("English page has no Georgian text", async ({ page }) => {
  await page.goto(`/en${PATH}`);
  await ready(page);
  expect(await page.locator("main").innerText()).not.toMatch(/\p{Script=Georgian}/u);
});

for (const width of [390, 768, 1100, 1440]) {
  test(`no horizontal page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [PATH, `/en${PATH}`]) {
      await page.goto(path);
      await ready(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} @${width}`).toBe(true);
    }
  });
}
