import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { expectReadableText } from "./color-contrast";
import { TEST_BASE_URL } from "./test-base-url";

function collectConsoleProblems(page: Page) {
  const consoleProblems: string[] = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  return consoleProblems;
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));

  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 2);
}

async function expectAppReady(page: Page) {
  await expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
}

test.describe("main explorer", () => {
for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  for (const section of ["expenditure", "revenue"] as const) {
    test(`${section} series values stay readable on selected and hover backgrounds at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`${TEST_BASE_URL}/explorer/${section}`);
      await expectAppReady(page);
      const row = page.locator(`[data-testid="series-row"][data-series-id="${section}.total"]`);
      const toggle = row.getByTestId("series-row-toggle");
      const value = toggle.locator(":scope > span").last();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(row).toHaveCSS("background-color", "rgb(241, 234, 220)");
      await expectReadableText(value, row);

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await page.mouse.move(0, 0);
      await expect(row).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expectReadableText(value, page.locator("body"));

      await row.hover();
      await expect(row).toHaveCSS("background-color", "rgb(241, 234, 220)");
      await expectReadableText(value, row);
    });
  }
}

async function downloadWorkbook(page: Page, testId = "series-excel") {
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId(testId).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Expected a local XLSX download path");
  const bytes = await readFile(path);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(bytes).buffer);
  return { download, workbook };
}

async function expectSidebarWidth(page: Page, width: number) {
  // The rail animates over 150ms, so a single boundingBox() can land mid-transition.
  await expect
    .poll(async () => Math.round((await page.getByTestId("data-sidebar").boundingBox())?.width ?? 0))
    .toBe(width);
}

async function expectLineChartRendered(page: Page) {
  // Before hydration the frame holds a desktop and a phone drawing and CSS shows
  // one (D1), so read the visible drawing.
  const line = page.getByTestId("chart-frame").locator("svg:visible path[stroke-linejoin='round']").first();

  await expect(line).toBeVisible();

  const box = await line.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(2);
  expect(box?.height ?? 0).toBeGreaterThan(2);
}

for (const section of ["expenditure", "revenue", "analysis"] as const) {
  test(`${section} keeps its initial chart content available without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await page.goto(`${TEST_BASE_URL}/explorer/${section}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (section === "analysis") {
        const snapshot = page.getByTestId("single-year-snapshot");
        await expect(snapshot).toBeVisible();
        await expect(snapshot.locator("svg").first()).toBeVisible();
      } else {
        await expectLineChartRendered(page);
        await expect(page.locator(`[data-series-id="${section}.total"]`)).toBeVisible();
      }
      await expectNoPageOverflow(page);
    } finally {
      await context.close();
    }
  });
}

test("explorer hydrates with the editorial shell and default expenditure view", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  await expect(page.getByTestId("explorer-shell")).toBeVisible();
  await expect(page.getByTestId("explorer-header")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ იხარჯება საქართველოს ბიუჯეტი");

  // Editorial paper background, no cards.
  const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(paper).toBe("rgb(247, 242, 233)");

  // Default: line mode, total-only selection, chart drawn on paper.
  await expectLineChartRendered(page);
  await expect(page.getByTestId("series-selector")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toContainText("სერიები");
  await expect(page.getByTestId("series-status")).toContainText(/სერიები\s*1 \/ \d+/);
  await expect(page.getByTestId("source-label")).toContainText("გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები");
  await expect(page.getByTestId("source-label").getByText("ხარჯვითი მონაცემები: 2004–2025", { exact: true })).toBeVisible();
  await expect(page.getByTestId("source-label")).toContainText("მშპ: საქსტატი, მიმდინარე ფასებში");
  await expect(page.getByTestId("source-label")).toContainText("2025 წლის მშპ წინასწარია");

  // Indicators below the chart.
  await expect(page.getByTestId("period-indicators")).toBeVisible();
  await expect(page.getByTestId("period-kpi-cards")).toContainText("პერიოდის ცვლილება");
  await expect(page.getByTestId("period-movers")).toContainText("ყველაზე მზარდი");
  await expect(page.getByTestId("period-comparison")).toContainText("პერიოდის შედარება");
  await expect(page.getByTestId("period-comparison")).not.toContainText("საწყისი მნიშვნელობა, ცვლილება და საბოლოო მნიშვნელობა (მლრდ ₾)");
  const comparison = page.getByTestId("period-comparison");
  const availableSeries = page.getByTestId("series-selector").getByTestId("series-row");
  await expect(comparison.locator("tbody tr")).toHaveCount(await availableSeries.count());

  await expectNoPageOverflow(page);
  expect(consoleProblems).toEqual([]);
});

test("national selector uses the standardized search, action, status, and row anatomy", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const sections = await panel.locator("[data-selector-section]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-selector-section")),
  );
  expect(sections).toEqual(["controls", "search", "actions", "list"]);

  await expect(panel.getByTestId("series-status")).toContainText(/სერიები\s*1 \/ \d+/);
  await expect(panel.getByTestId("series-toggle-all")).toContainText("გასუფთავება");

  const actionBox = await panel.getByTestId("series-toggle-all").boundingBox();
  const statusBox = await panel.getByTestId("series-status").boundingBox();
  expect(actionBox).not.toBeNull();
  expect(statusBox).not.toBeNull();
  expect(actionBox!.x).toBeLessThan(statusBox!.x);

  const rows = panel.getByTestId("series-row");
  await expect(rows.first()).toContainText("მთლიანი ხარჯი");
  await expect(rows.locator("[data-testid='series-swatch']")).toHaveCount(await rows.count());
  expect(
    await rows
      .first()
      .getByTestId("series-label")
      .evaluate((node) => getComputedStyle(node).getPropertyValue("-webkit-line-clamp")),
  ).toBe("2");
});

test("national selector treats a pinned total search as a match and reports genuine misses", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const search = panel.getByTestId("series-search");
  const totalLabel = await panel.locator('[data-level="total"] [data-testid="series-label"]').innerText();
  const emptyState = panel.getByText(/^კატეგორია ვერ მოიძებნა/);

  await search.fill(totalLabel);
  await expect(panel.getByTestId("series-row")).toHaveCount(1);
  await expect(emptyState).toHaveCount(0);

  await search.fill("definitely-no-national-series-match");
  await expect(panel.getByTestId("series-row")).toHaveCount(1);
  await expect(emptyState).toBeVisible();
});

test("standardized selector keeps its order when stacked below the chart", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const chartBox = await page.getByTestId("chart-panel").boundingBox();
  const selector = page.getByTestId("series-selector");
  const selectorBox = await selector.boundingBox();
  expect(chartBox).not.toBeNull();
  expect(selectorBox).not.toBeNull();
  expect(selectorBox!.y).toBeGreaterThan(chartBox!.y + chartBox!.height);

  const sections = await selector.locator("[data-selector-section]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-selector-section")),
  );
  expect(sections).toEqual(["controls", "search", "actions", "list"]);
});

test("series header clears and selects every series independently of search", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const bulk = panel.getByTestId("series-toggle-all");
  const seriesButtons = panel.locator("button[title]");

  await expect(panel.locator('[data-level="total"]').first()).toContainText("მთლიანი ხარჯი");
  await expect(panel.getByTestId("series-status")).toContainText(/სერიები\s*1 \/ \d+/);
  await expect(bulk).toContainText("გასუფთავება");

  await bulk.click();
  await expect(panel.locator('button[title][aria-pressed="true"]')).toHaveCount(0);
  await expect(bulk).toContainText("ყველას მონიშვნა");

  await panel.getByTestId("series-search").fill("ჯანმრთელობა");
  await bulk.click();
  await panel.getByTestId("series-search").fill("");

  const allCount = await seriesButtons.count();
  await expect(panel.locator('button[title][aria-pressed="true"]')).toHaveCount(allCount);
});

test("bulk selector exposes mixed, empty, and checked states", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const bulk = panel.getByTestId("series-toggle-all");
  const indicator = panel.getByTestId("series-toggle-indicator");

  await expect(bulk).toHaveAttribute("role", "checkbox");
  await expect(bulk).toHaveAttribute("aria-checked", "mixed");
  await expect(indicator).toHaveText("—");

  await panel.getByTestId("series-row").nth(1).getByTestId("series-row-toggle").click();
  await expect(panel.getByTestId("series-status")).toContainText(/სერიები\s*2 \/ \d+/);
  await expect(bulk).toHaveAttribute("aria-checked", "mixed");
  await expect(indicator).toHaveText("—");

  await bulk.click();
  await expect(bulk).toHaveAttribute("aria-checked", "false");
  await expect(indicator).toHaveText("");
  await expect(bulk).toContainText("ყველას მონიშვნა");

  await panel.getByTestId("series-search").fill("ჯანმრთელობა");
  await bulk.click();
  await expect(bulk).toHaveAttribute("aria-checked", "true");
  await expect(indicator).toHaveText("✓");
  await expect(bulk).toContainText("გასუფთავება");
});

test("explorer controls expose line, table, grouping, and the share pill", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const chartPanel = page.getByTestId("chart-panel");
  const seriesPanel = page.getByTestId("series-selector");
  await expect(chartPanel.getByTestId("chart-mode-line")).toHaveAttribute("aria-pressed", "true");
  await expect(chartPanel.getByTestId("chart-mode-table")).toBeVisible();
  // The grouping switch lives in the series panel, not in the chart controls row.
  await expect(seriesPanel.getByTestId("grouping-fields")).toHaveAttribute("aria-pressed", "true");
  await expect(seriesPanel.getByTestId("grouping-ministries")).toBeVisible();
  await expect(seriesPanel.getByTestId("grouping-ministries")).toHaveText("სამინისტროები");
  await expect(seriesPanel.getByTestId("series-search")).toHaveAttribute("placeholder", "ძებნა");
  await expect(chartPanel.getByTestId("measure-share-toggle")).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toContainText("დიაპაზონი");

  await chartPanel.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await expect(page.getByTestId("explorer-table")).toContainText("მთლიანი ხარჯი");
  await expect(page.getByTestId("explorer-table")).not.toContainText("ცვლილება");
  await expect(page.getByTestId("explorer-table").locator("caption")).toHaveText(
    "ხარჯვითი მონაცემები — ხარჯები ლარში, 2004–2025",
  );

  await chartPanel.getByTestId("chart-mode-line").click();
  await expect(page.getByTestId("chart-frame")).toBeVisible();

  await seriesPanel.getByTestId("grouping-ministries").click();
  await expect(seriesPanel.getByTestId("series-search")).toHaveAttribute("placeholder", "ძებნა");

  await chartPanel.getByTestId("measure-share-toggle").click();
  await expect(chartPanel).toHaveAttribute("data-measure", "share_of_gdp");
  await expect(chartPanel.getByTestId("measure-share-toggle")).toHaveText("% მშპ-ში");
  await expect(chartPanel.getByTestId("measure-share-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("img", { name: "მრავალწლიანი დინამიკა" }).hover({ position: { x: 300, y: 100 } });
  await expect(page.getByTestId("chart-tooltip")).toContainText("წილი მშპ-ში");
  await chartPanel.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).not.toContainText("წილი მშპ-ში 2025");
  await expect(page.getByTestId("explorer-table")).not.toContainText("100.0%");
  await expect(page.getByTestId("explorer-table").locator("caption")).toHaveText(
    "უწყებრივი მონაცემები — წილი მშპ-ში, 2004–2025",
  );

  expect(consoleProblems).toEqual([]);
});

test("revenue nav reuses the identical system without a grouping switch", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/revenue`);
  await expectAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ფინანსდება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("grouping-fields")).toHaveCount(0);
  await expect(page.getByTestId("series-selector")).toContainText("დამატებული ღირებულების გადასახადი");
  await expect(page.getByTestId("source-label")).toContainText("შემოსავლების მონაცემები: 2004–2025");
  await expect(page.getByTestId("source-label")).toContainText("2004 წლის ვალდებულებების ზრდა არ არის ხელმისაწვდომი");
  await expectLineChartRendered(page);
  await expect(page.getByTestId("period-comparison")).not.toContainText("საწყისი მნიშვნელობა, ცვლილება და საბოლოო მნიშვნელობა (მლრდ ₾)");

  expect(consoleProblems).toEqual([]);
});

test("sidebar section links move between sections in-app", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const sidebar = page.getByTestId("data-sidebar");
  await expect(sidebar.getByTestId("section-link-expenditure")).toHaveAttribute("aria-current", "page");

  await sidebar.getByTestId("section-link-revenue").click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ფინანსდება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("series-selector")).toContainText("დამატებული ღირებულების გადასახადი");
  await expect(sidebar.getByTestId("section-link-revenue")).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByTestId("section-link-expenditure")).not.toHaveAttribute("aria-current", "page");

  await sidebar.getByTestId("section-link-analysis").click();
  await expect(page).toHaveURL(/\/explorer\/analysis/);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(sidebar.getByTestId("section-link-analysis")).toHaveAttribute("aria-current", "page");

  await sidebar.getByTestId("section-link-expenditure").click();
  await expect(page).toHaveURL(/\/explorer\/expenditure/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ იხარჯება საქართველოს ბიუჯეტი");
  await expectLineChartRendered(page);

  // მუნიციპალიტეტები is now routed: a real link, not a "მალე" marker. Scoped to
  // the row itself, not the whole sidebar — the unrelated TEASERS rows below
  // (უმუშევრობა etc.) are still genuinely coming soon and keep their badge.
  const municipalitiesLink = sidebar.getByTestId("section-link-municipalities");
  await expect(municipalitiesLink).not.toContainText("მალე");
  expect(await municipalitiesLink.evaluate((node) => node.tagName)).toBe("A");
  await municipalitiesLink.click();
  await expect(page).toHaveURL(/\/explorer\/municipalities/);
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await expect(municipalitiesLink).toHaveAttribute("aria-current", "page");

  expect(consoleProblems).toEqual([]);
});

test("ministries grouping expands nested programs by name only", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  await page.getByTestId("grouping-ministries").click();
  await expect(page.getByTestId("grouping-ministries")).toHaveAttribute("aria-pressed", "true");

  const seriesSelector = page.getByTestId("series-selector");
  await expect(seriesSelector.locator('[data-level="admin_category"]').first()).toBeVisible();
  await expect(seriesSelector.locator('[data-level="major_program"]')).toHaveCount(0);

  // Expand the first ministry with programs.
  const ministry = seriesSelector
    .locator('[data-level="admin_category"]')
    .filter({ has: page.locator("button[aria-expanded]") })
    .first();
  const caret = ministry.locator("button[aria-expanded]");
  await caret.click();
  const firstProgram = seriesSelector.locator('[data-level="major_program"]').first();
  await expect(firstProgram).toBeVisible();
  const topLevelCount = await seriesSelector.locator('[data-level="total"], [data-level="admin_category"]').count();
  const status = seriesSelector.getByTestId("series-status");
  await expect(status).toContainText(`ძირითადი 1 / ${topLevelCount} · პროგრამები 0`);

  // Programs are shown by NAME only — the official tavi-VI code is not surfaced.
  const programText = (await firstProgram.textContent()) ?? "";
  expect(programText).not.toMatch(/\d{2} \d{2}/);
  const programName = (await firstProgram.getByTestId("series-label").textContent())?.trim().slice(0, 20);
  if (!programName) throw new Error("Expected a program name");

  // A selected child stays counted when its parent is collapsed. Clear-all
  // removes it; select-all then covers only the visible top-level domain.
  await firstProgram.getByTestId("series-row-toggle").click();
  await expect(status).toContainText(`ძირითადი 1 / ${topLevelCount} · პროგრამები 1`);
  await caret.click();
  await expect(seriesSelector.locator('[data-level="major_program"]')).toHaveCount(0);
  await expect(status).toContainText(`ძირითადი 1 / ${topLevelCount} · პროგრამები 1`);

  const bulk = seriesSelector.getByTestId("series-toggle-all");
  await bulk.click();
  await expect(status).toContainText(`ძირითადი 0 / ${topLevelCount} · პროგრამები 0`);
  await bulk.click();
  await expect(status).toContainText(`ძირითადი ${topLevelCount} / ${topLevelCount} · პროგრამები 0`);

  // Searching by program name keeps the parent and auto-expands to matches.
  await page.getByTestId("series-search").fill(programName);
  await expect(seriesSelector.locator('[data-level="major_program"]').first()).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test("2004 expenditure is complete across functions, ministries, GDP share, and Excel exports", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const fields = page.getByTestId("series-selector");
  await expect(page.getByTestId("year-range-strip")).toContainText("2004–2025");
  await expect(fields.locator('[data-level="public_field"]')).toHaveCount(13);
  await expect(fields.getByTitle("ჯანდაცვა")).toBeVisible();
  await expect(fields.getByTitle("სოციალური დაცვა")).toBeVisible();
  await expect(fields.getByTitle(/ცენტრალური ბიუჯეტი/)).toHaveCount(0);

  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toContainText("2004");
  await expect(page.getByTestId("explorer-table")).toContainText("1.9");

  await page.getByTestId("measure-share-toggle").click();
  await expect(page.getByTestId("explorer-table")).toContainText("19.6%");

  const functionalExport = await downloadWorkbook(page);
  expect(functionalExport.download.suggestedFilename()).toMatch(/^fiscal-fields-\d{4}-\d{4}\.xlsx$/);
  expect(functionalExport.workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
  const functionalRows = functionalExport.workbook.getWorksheet("მონაცემები")!.getRows(2, 30) ?? [];
  expect(functionalRows.map((row) => row.values)).toContainEqual([
    undefined,
    2004,
    "ხარჯები",
    "მთლიანი ხარჯი",
    1_930_210_300,
    "ფაქტი",
    1_930_210_300 / 9_824_300_000,
  ]);
  expect(JSON.stringify(functionalExport.workbook.getWorksheet("მარტივი ცხრილი")!.getSheetValues())).not.toContain("1500000000");

  await fields.getByTestId("grouping-ministries").click();
  await expect(page.getByTestId("year-range-strip")).toContainText("2004–2025");
  await fields.getByTestId("series-toggle-all").click();
  await fields.getByTestId("series-toggle-all").click();
  const ministryExport = await downloadWorkbook(page);
  expect(ministryExport.download.suggestedFilename()).toMatch(/^fiscal-ministries-\d{4}-\d{4}\.xlsx$/);
  const ministryRows = ministryExport.workbook.getWorksheet("მონაცემები")!.getRows(2, 2000) ?? [];
  const ministry2004Rows = ministryRows.filter((row) => row.getCell(1).value === 2004);
  expect(ministry2004Rows.length).toBeGreaterThan(0);
  expect(ministry2004Rows.some((row) => row.getCell(4).value === 172_009_000)).toBe(true);

  await page.goto(`${TEST_BASE_URL}/explorer/revenue`);
  await expectAppReady(page);
  await expect(page.getByTestId("year-range-strip")).toContainText("2004–2025");

  expect(consoleProblems).toEqual([]);
});

test("2004 revenue total excludes an unavailable liability value in tables and Excel", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/revenue#m=table&r=2004-2005&sel=revenue.total,revenue.increase_liabilities`);
  await expectAppReady(page);

  const table = page.getByTestId("explorer-table");
  const totalRow = table.getByRole("row").filter({ hasText: "მთლიანი შემოსავლები" });
  const liabilitiesRow = table.getByRole("row").filter({ hasText: "ვალდებულებების ზრდა" });
  // One decimal: national scopes cap there (DESIGN.md §11). 2004 total
  // 2,283,035,800 ₾ and 2005 liabilities 85,316,805 ₾.
  await expect(totalRow).toContainText("2.3");
  await expect(liabilitiesRow).toContainText("—");
  await expect(liabilitiesRow).toContainText("0.1");

  const revenueExport = await downloadWorkbook(page);
  expect(revenueExport.download.suggestedFilename()).toMatch(/^fiscal-revenue-\d{4}-\d{4}\.xlsx$/);
  expect(revenueExport.workbook.getWorksheet("მარტივი ცხრილი")!.getCell("A4").value).toBe("მთლიანი შემოსავლები");
  const exportedRows = revenueExport.workbook.getWorksheet("მონაცემები")!.getRows(2, 20) ?? [];
  expect(exportedRows.some((row) => row.getCell(1).value === 2004 && row.getCell(3).value === "ვალდებულებების ზრდა")).toBe(false);
  expect(exportedRows.some((row) => row.getCell(1).value === 2005 && row.getCell(3).value === "ვალდებულებების ზრდა")).toBe(true);

  expect(consoleProblems).toEqual([]);
});

test("Debt Excel exports the active family, forecast status, rate gaps and validated sources", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/debt#f=service&m=table&r=2025-2026&sel=debt.service.total`);
  await expectAppReady(page);

  const serviceExport = await downloadWorkbook(page, "debt-excel");
  expect(serviceExport.download.suggestedFilename()).toBe("fiscal-government-debt-service-2025-2026.xlsx");
  expect(serviceExport.workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
  const serviceRows = serviceExport.workbook.getWorksheet("მონაცემები")!.getRows(2, 10) ?? [];
  expect(serviceRows.map((row) => row.getCell(5).value).filter((value) => value !== null)).toEqual(["ფაქტი", "პროგნოზი"]);
  expect(serviceExport.workbook.getWorksheet("წყაროები")!.getCell("D4").value).toEqual(expect.objectContaining({
    text: "ფაილის ჩამოტვირთვა",
    hyperlink: expect.stringContaining("/downloads/methodology/debt/files/"),
  }));

  await page.goto(`${TEST_BASE_URL}/explorer/debt?view=rate#f=rate&m=table&r=2019-2021&sel=debt.rate.external`);
  await expectAppReady(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-family", "rate");
  const rateExport = await downloadWorkbook(page, "debt-excel");
  const rateSheet = rateExport.workbook.getWorksheet("მონაცემები")!;
  expect(rateSheet.getRow(1).values).toEqual([
    undefined,
    "წელი",
    "მთავარი ჯგუფი",
    "კატეგორია",
    "თანხა (₾)",
    "სტატუსი",
    "საპროცენტო განაკვეთი (%)",
  ]);
  const rateRows = rateSheet.getRows(2, 10) ?? [];
  expect(rateRows.some((row) => row.getCell(1).value === 2019 && row.getCell(4).value === null && row.getCell(5).value === "არ არის ხელმისაწვდომი")).toBe(true);
  expect(rateRows.some((row) => row.getCell(1).value === 2021 && row.getCell(6).value === 0.0095)).toBe(true);
});

test("range strip supports chips and dragging handles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const strip = page.getByTestId("year-range-strip");
  await expect(strip).toContainText("2004–2025");
  await expect(strip).toContainText("10წ");
  for (const testId of ["range-start-handle", "range-end-handle"]) {
    const box = await strip.getByTestId(testId).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(30);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(30);
  }

  // Late font loads shift the layout on slow CI runners; settle before
  // measuring, and let hover()'s stability checks position the pointer.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const startHandle = strip.getByTestId("range-start-handle");
  await startHandle.scrollIntoViewIfNeeded();
  await startHandle.hover();
  const startBox = await startHandle.boundingBox();
  const railBox = await strip.locator("[role='group']").boundingBox();
  if (!startBox || !railBox) throw new Error("Expected draggable range elements to be measurable");

  await page.mouse.down();
  await page.mouse.move(railBox.x + railBox.width / 2, startBox.y + startBox.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(strip).toContainText("2015–2025");

  await strip.getByRole("button", { name: "ყველა" }).click();
  await expect(strip).toContainText("2004–2025");
});

test("URL hash round-trips explorer state", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  await page.getByTestId("chart-mode-table").click();
  await page.getByTestId("measure-share-toggle").click();
  await expect(page).toHaveURL(/#.*m=table/);
  await expect(page).toHaveURL(/sh=1/);

  await page.goto(`${TEST_BASE_URL}/explorer/revenue#m=table&sh=1&r=2010-2020&sel=revenue.total,revenue.vat`);
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ფინანსდება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2020");
  await expect(page.getByTestId("explorer-table").locator("caption")).toHaveText(
    "შემოსავლების მონაცემები — წილი მშპ-ში, 2010–2020",
  );
  await expect(page.getByTestId("period-comparison").locator("caption")).toHaveText(
    "შემოსავლები საბიუჯეტო მუხლების მიხედვით — პერიოდის შედარება, 2010–2020",
  );
  await expect(page.getByTestId("series-selector").getByTitle("მთლიანი შემოსავლები")).toHaveAttribute("aria-pressed", "true");
});

test("national URL restores an explicitly empty selection as empty", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure#m=line&sel=`);
  await expectAppReady(page);
  await page.reload();
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  await expect(panel.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
});

test("national URL falls back to the applicable total when every selected id is unknown", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/revenue#m=line&sel=revenue.made_up`);
  await expectAppReady(page);
  await page.reload();
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const selected = panel.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
  await expect(selected).toHaveCount(1);
  await expect(panel.locator('[data-level="total"] [data-testid="series-row-toggle"]')).toHaveAttribute("aria-pressed", "true");
});

test("line mode renders every series from a large shared selection", async ({ page }) => {
  const ids = [
    "spending.social_protection",
    "spending.health",
    "spending.education",
    "spending.defence",
    "spending.public_order_safety",
    "spending.economic_affairs",
    "spending.culture",
    "spending.sport",
  ];

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure#m=line&sel=${ids.join(",")}`);
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByTestId("series-overflow-callout")).toHaveCount(0);
  await expect(page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']")).toHaveCount(ids.length);
});

test("period comparison keeps every revenue category when the selected series change", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/revenue`);
  await expectAppReady(page);

  const vatButton = page.getByTestId("series-selector").getByTitle("დამატებული ღირებულების გადასახადი");
  await vatButton.click();
  await expect(vatButton).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("chart-mode-table").click();
  await page.getByTestId("measure-share-toggle").click();

  const comparison = page.getByTestId("period-comparison");
  await expect(comparison.locator("tbody tr").first()).toContainText("მთლიანი შემოსავლები");
  const comparisonRowCount = await comparison.locator("tbody tr").count();

  const totalButton = page.getByTestId("series-selector").getByTitle("მთლიანი შემოსავლები");
  await totalButton.click();

  await expect(page.getByTestId("explorer-table")).not.toContainText("მთლიანი შემოსავლები");
  await expect(page.getByTestId("explorer-table").getByRole("columnheader", { name: "ცვლილება" })).toHaveCount(0);
  await expect(page.getByTestId("explorer-table").getByRole("columnheader", { name: /წილი მშპ/ })).toHaveCount(0);
  await expect(page.getByTestId("explorer-table").locator("tbody tr").first()).toContainText("%");
  await expect(comparison.locator("tbody tr")).toHaveCount(comparisonRowCount);
  await expect(comparison.locator("tbody tr").first()).toContainText("მთლიანი შემოსავლები");
});

test("ministries period comparison keeps every top-level ministry and excludes major programs", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  await page.getByTestId("grouping-ministries").click();
  const panel = page.getByTestId("series-selector");
  const comparisonRows = page.getByTestId("period-comparison").locator("tbody tr");
  const topLevelRows = panel.locator('[data-level="total"], [data-level="admin_category"]');
  const expectedRowCount = await topLevelRows.count();

  await expect(comparisonRows).toHaveCount(expectedRowCount);

  const collapsedMinistry = panel.locator('[data-level="admin_category"] button[aria-expanded="false"]').first();
  await collapsedMinistry.click();
  const firstProgram = panel.locator('[data-level="major_program"]').first();
  await expect(firstProgram).toBeVisible();
  await firstProgram.getByTestId("series-row-toggle").click();
  await expect(firstProgram.getByTestId("series-row-toggle")).toHaveAttribute("aria-pressed", "true");

  await expect(comparisonRows).toHaveCount(expectedRowCount);
});

test("shared ministries program links restore with the parent expanded", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  await page.getByTestId("grouping-ministries").click();
  const panel = page.getByTestId("series-selector");
  await panel.getByRole("button", { name: "ქვეპროგრამები" }).first().click();
  const firstProgram = panel.locator("[data-level='major_program']").first();
  await firstProgram.getByRole("button").last().click();
  await expect(page).toHaveURL(/sel=[^&]*admin_program/);

  await page.reload();
  await expectAppReady(page);

  // The restore expands the selected program's parent, so the checked row is
  // visible in the panel instead of hiding behind a collapsed ministry.
  const restored = page.getByTestId("series-selector").locator("[data-level='major_program']").locator("[aria-pressed='true']").first();
  await expect(restored).toBeVisible();
});

test("Excel download uses only the selected range and series", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure#r=2020-2021&sel=spending.social_protection`);
  await expectAppReady(page);

  const socialProtectionButton = page.getByTestId("series-selector").getByTitle("სოციალური დაცვა");
  await expect(socialProtectionButton).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("series-search").fill("ჯანდაცვა");

  await expect(page.getByTestId("series-csv")).toHaveCount(0);
  const { download, workbook } = await downloadWorkbook(page);
  expect(download.suggestedFilename()).toBe("fiscal-fields-2020-2021.xlsx");
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["მარტივი ცხრილი", "მონაცემები", "წყაროები"]);
  expect(workbook.getWorksheet("მარტივი ცხრილი")!.getRow(3).values).toEqual([
    undefined,
    "კატეგორია",
    2020,
    2021,
    "ცვლილება 2020–2021",
  ]);
  const dataRows = (workbook.getWorksheet("მონაცემები")!.getRows(2, 10) ?? []).filter((row) => row.getCell(1).value !== null);
  expect([...new Set(dataRows.map((row) => row.getCell(1).value))]).toEqual([2020, 2021]);
  expect([...new Set(dataRows.map((row) => row.getCell(3).value))]).toEqual(["სოციალური დაცვა"]);
  expect(JSON.stringify(workbook.getWorksheet("მარტივი ცხრილი")!.getSheetValues())).not.toContain("geostat.ge");
});

test("Excel button shows working and retryable error states", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  await page.evaluate(() => {
    const realCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = () => {
      URL.createObjectURL = realCreateObjectURL;
      throw new Error("induced workbook download failure");
    };
  });

  const button = page.getByTestId("series-excel");
  const announcement = page.getByRole("status");
  await expect(button).toHaveText("ჩამოტვირთვა");
  await page.evaluate(() => {
    const target = document.querySelector<HTMLButtonElement>("[data-testid='series-excel']");
    const live = target?.parentElement?.querySelector<HTMLElement>("[role='status']");
    if (!target || !live) throw new Error("Expected the Excel button and live status");

    type ExcelState = { text: string; disabled: boolean; busy: string | null; announcement: string };
    const tracked = window as typeof window & {
      __excelStates?: ExcelState[];
      __excelStateObserver?: MutationObserver;
    };
    tracked.__excelStates = [];
    const record = () => {
      const state = {
        text: target.textContent ?? "",
        disabled: target.disabled,
        busy: target.getAttribute("aria-busy"),
        announcement: live.textContent ?? "",
      };
      const previous = tracked.__excelStates?.at(-1);
      if (JSON.stringify(previous) !== JSON.stringify(state)) tracked.__excelStates?.push(state);
    };
    tracked.__excelStateObserver = new MutationObserver(record);
    tracked.__excelStateObserver.observe(target, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
    });
    tracked.__excelStateObserver.observe(live, { childList: true, subtree: true, characterData: true });
    record();
  });

  await button.click();
  await expect(announcement).toHaveText("ფაილი ვერ მომზადდა — სცადეთ თავიდან.");
  await expect(button).toHaveAttribute("aria-busy", "false");
  const observedStates = await page.evaluate(() => {
    const tracked = window as typeof window & {
      __excelStates?: Array<{ text: string; disabled: boolean; busy: string | null; announcement: string }>;
      __excelStateObserver?: MutationObserver;
    };
    tracked.__excelStateObserver?.disconnect();
    return tracked.__excelStates ?? [];
  });
  expect(observedStates).toContainEqual({
    text: "Excel მზადდება…",
    disabled: true,
    busy: "true",
    announcement: "Excel მზადდება…",
  });

  const retry = await downloadWorkbook(page);
  expect(retry.download.suggestedFilename()).toMatch(/^fiscal-fields-\d{4}-\d{4}\.xlsx$/);
  await expect(announcement).toBeEmpty();
  await expect(button).toHaveAttribute("aria-busy", "false");

  await page.getByTestId("series-toggle-all").click();
  await expect(button).toBeDisabled();
});

test("GDP share Excel download adds the analysis column and official sources", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure#r=2020-2021&sel=expenditure.total`);
  await expectAppReady(page);
  await page.getByTestId("measure-share-toggle").click();

  const { workbook } = await downloadWorkbook(page);
  expect(workbook.getWorksheet("მონაცემები")!.getRow(1).values).toEqual([
    undefined,
    "წელი",
    "მთავარი ჯგუფი",
    "კატეგორია",
    "თანხა (₾)",
    "სტატუსი",
    "მშპ-ის წილი (%)",
  ]);
  const analysis = workbook.getWorksheet("მონაცემები")!;
  expect(analysis.getCell("F2").value).toEqual(expect.any(Number));
  expect(analysis.getCell("F2").numFmt).toBe("0.0%");
  const readableText = JSON.stringify(workbook.getWorksheet("მარტივი ცხრილი")!.getSheetValues());
  const sourceText = JSON.stringify(workbook.getWorksheet("წყაროები")!.getSheetValues());
  expect(readableText).not.toContain("https://www.geostat.ge/");
  expect(sourceText).toContain("https://www.geostat.ge/");
  expect(sourceText).not.toMatch(/docs[\\/]Raw Data|national-gdp-annual/);
});

test("analysis view renders the fixed single-year section order", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
  await expectAppReady(page);

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ბიუჯეტის სურათი");
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator("main h2")).toHaveCount(5);

  await expect(page.getByTestId("analysis-year-selector")).toContainText("2025");
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("snapshot-structure-grid")).toBeVisible();
  expect(await page.getByTestId("snapshot-structure-card").count()).toBeGreaterThan(5);

  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking").locator("caption")).toHaveText(
    "ხარჯები სფეროების მიხედვით — სრული რეიტინგი, 2025",
  );
  await expect(page.getByTestId("single-year-ranking").locator("thead th")).toHaveCount(4);
  await expect(page.getByTestId("single-year-ranking").getByTestId("ranking-share-bar").first()).toBeVisible();
  await expect(page.getByTestId("single-year-ranking").locator('td[title="ინფრასტრუქტურა და რეგიონული განვითარება"]')).toContainText("ინფრასტრუქტურა და რეგიონული განვითარება");

  const sectionOrder = await page.evaluate(() => {
    const ids = ["snapshot-treemap", "every-100-gel", "budget-radar", "budget-field", "single-year-ranking"];
    return ids.map((id) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().top ?? 0);
  });
  for (let index = 1; index < sectionOrder.length; index += 1) {
    expect(sectionOrder[index]).toBeGreaterThan(sectionOrder[index - 1]);
  }

  // Treemap tiles shrink with rank.
  const tileAreas = await page.getByTestId("snapshot-structure-grid").evaluate((grid) =>
    Array.from(grid.querySelectorAll("[data-testid='snapshot-structure-card']"))
      .slice(0, 3)
      .map((tile) => {
        const box = tile.getBoundingClientRect();
        return Math.round(box.width * box.height);
      }),
  );
  expect(tileAreas[0]).toBeGreaterThan(tileAreas[1] ?? 0);
  expect(tileAreas[1]).toBeGreaterThan(tileAreas[2] ?? 0);

  // Revenue side reuses the same layout.
  await page.getByTestId("analysis-side-revenue").click();
  await expect(page.getByTestId("single-year-ranking")).toContainText("დამატებული ღირებულების გადასახადი");
  await expect(page.getByTestId("single-year-ranking").locator("caption")).toHaveText(
    "შემოსავლები კატეგორიების მიხედვით — სრული რეიტინგი, 2025",
  );
  await expect(page.getByTestId("analysis-grouping-fields")).toHaveCount(0);

  await page.getByTestId("analysis-year-selector").getByRole("button", { name: "2024", exact: true }).click();
  await expect(page.getByTestId("single-year-ranking").locator("caption")).toHaveText(
    "შემოსავლები კატეგორიების მიხედვით — სრული რეიტინგი, 2024",
  );

  // Ministries grouping in analysis (categories only).
  await page.getByTestId("analysis-side-expenditure").click();
  await page.getByTestId("analysis-grouping-ministries").click();
  await expect(page.getByTestId("snapshot-treemap")).toContainText("სტრუქტურა უწყებების მიხედვით");
  await expect(page.getByTestId("single-year-ranking").locator("caption")).toHaveText(
    "ხარჯები უწყებების მიხედვით — სრული რეიტინგი, 2024",
  );

  expect(consoleProblems).toEqual([]);
});

test("budget field identifies a circle with its category and amount on hover and focus", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
  await expectAppReady(page);

  const field = page.getByTestId("budget-field");
  await expect(field.getByRole("group", { name: "ბიუჯეტის ველი" })).toBeVisible();
  const point = field.getByRole("img", { name: "სოციალური დაცვა · 7.2 მლრდ ₾" });

  await point.hover();

  const tooltip = page.getByTestId("budget-field-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("სოციალური დაცვა");
  await expect(tooltip).toContainText("7.2 მლრდ ₾");
  // D1 (2026-10-07): the readout also states the growth its y position encodes.
  await expect(tooltip).toContainText(/ცვლილება \+?−?\d+\.\d%/);
  await expect(tooltip).not.toContainText(/წილი/);

  await page.getByRole("heading", { name: "ბიუჯეტის ველი" }).hover();
  await expect(tooltip).toHaveCount(0);
  await point.focus();
  await expect(tooltip).toBeVisible();
});

test("mobile explorer and analysis layouts have no page overflow", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  await expect(page.getByTestId("explorer-header")).toBeVisible();
  await expect(page.getByTestId("chart-frame")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
  await expectAppReady(page);

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expectNoPageOverflow(page);

  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
    await expectAppReady(page);

    const selector = page.getByTestId("analysis-year-selector");
    const yearButtons = selector.locator("button");
    const activeYear = selector.locator("button[aria-pressed='true']");

    const metrics = await selector.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);

    const boxes = await yearButtons.evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, width: box.width };
      }),
    );
    expect(boxes.every((box) => box.width >= 36)).toBe(true);
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBeGreaterThan(1);

    const activeBox = await activeYear.boundingBox();
    const selectorBox = await selector.boundingBox();
    expect(activeBox).not.toBeNull();
    expect(selectorBox).not.toBeNull();
    expect(activeBox!.x).toBeGreaterThanOrEqual(selectorBox!.x);
    expect(activeBox!.x + activeBox!.width).toBeLessThanOrEqual(selectorBox!.x + selectorBox!.width + 1);

    const tabGroups = page.getByTestId("analysis-tab-groups");
    expect(await tabGroups.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const snapshot = page.getByTestId("single-year-snapshot");
    expect(await snapshot.evaluate((element) => getComputedStyle(element).overflowX)).not.toBe("clip");

    const ranking = page.getByTestId("single-year-ranking");
    const rankingTable = ranking.locator("table");
    expect(await rankingTable.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(rankingTable.locator("thead th").nth(1)).toHaveText("მლრდ ₾");
    expect(await ranking.getByTestId("ranking-share-bar").evaluateAll((elements) => elements.every((element) => getComputedStyle(element).display === "none"))).toBe(true);
    const longLabel = ranking.locator('tbody td[title="ინფრასტრუქტურა და რეგიონული განვითარება"]');
    await expect(longLabel).toHaveCount(1);
    await expect(longLabel).toContainText("ინფრასტრუქტურა და…");

    for (const sideTestId of ["analysis-side-expenditure", "analysis-side-revenue"]) {
      await page.getByTestId(sideTestId).click();

      const headlineCards = page.locator("[data-testid='single-year-snapshot'] > div[class*='grid-cols-2'] > div");
      await expect(headlineCards).toHaveCount(4);

      for (let index = 0; index < (await headlineCards.count()); index += 1) {
        const card = headlineCards.nth(index);
        const value = card.locator("p").first();
        const unit = value.locator("span");
        const unitCount = await unit.count();

        const [valueMetrics, cardMetrics, rootMetrics] = await Promise.all([
          value.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            left: element.getBoundingClientRect().left,
            right: element.getBoundingClientRect().right,
          })),
          card.evaluate((element) => ({
            left: element.getBoundingClientRect().left,
            right: element.getBoundingClientRect().right,
          })),
          snapshot.evaluate((element) => ({
            left: element.getBoundingClientRect().left,
            right: element.getBoundingClientRect().right,
          })),
        ]);

        expect(valueMetrics.scrollWidth).toBeLessThanOrEqual(valueMetrics.clientWidth);
        expect(valueMetrics.left).toBeGreaterThanOrEqual(Math.max(cardMetrics.left, rootMetrics.left));
        expect(valueMetrics.right).toBeLessThanOrEqual(Math.min(cardMetrics.right, rootMetrics.right));
        for (let unitIndex = 0; unitIndex < unitCount; unitIndex += 1) {
          const unitMetrics = await unit.nth(unitIndex).evaluate((element) => ({
            visible: element.checkVisibility(),
            left: element.getBoundingClientRect().left,
            right: element.getBoundingClientRect().right,
          }));
          expect(unitMetrics.visible).toBe(true);
          expect(unitMetrics.left).toBeGreaterThanOrEqual(Math.max(valueMetrics.left, cardMetrics.left, rootMetrics.left));
          expect(unitMetrics.right).toBeLessThanOrEqual(Math.min(valueMetrics.right, cardMetrics.right, rootMetrics.right));
        }
      }
    }

    await expectNoPageOverflow(page);
  }

  expect(consoleProblems).toEqual([]);
});

test("mobile chart fits its frame and the table keeps contained horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  // D1 (2026-10-07): phones draw the chart at the frame's width, so it no
  // longer scrolls; the frame keeps its focusable, named region.
  const chart = page.getByTestId("chart-frame");
  await expect(page.getByTestId("chart-scroll-hint")).toHaveCount(0);
  await expect(chart).toHaveAttribute("tabindex", "0");
  await expect(chart).toHaveAttribute("aria-label", "მრავალწლიანი გრაფიკი — ჰორიზონტალურად გადაადგილებადი");
  expect(await chart.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  await expect(page.getByTestId("table-scroll-hint")).toHaveCount(0);
  await expect(table).toHaveAttribute("tabindex", "0");
  await expect(table).toHaveAttribute("aria-label", "მრავალწლიანი ცხრილი — ჰორიზონტალურად გადაადგილებადი");
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  await expectNoPageOverflow(page);
});

test("a chart frame that still overflows accepts a horizontal touch drag", async ({ page }) => {
  // Phones fit the chart (D1); at 768px the desktop drawing's 720px minimum
  // still overflows its frame, so that is where the scroller has to work.
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const chart = page.getByTestId("chart-frame");
  expect(await chart.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  // An overflowing frame opens on the latest data, so the drag goes back in time.
  const maxScroll = await chart.evaluate((element) => element.scrollWidth - element.clientWidth);
  await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBeGreaterThanOrEqual(maxScroll - 1);

  const box = await chart.boundingBox();
  expect(box).not.toBeNull();

  const cdp = await page.context().newCDPSession(page);
  const y = box!.y + Math.min(100, box!.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box!.x + 32, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box!.x + box!.width - 32, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBeLessThan(maxScroll - 1);
});

test("captures editorial desktop and mobile screenshots", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);
  await expectLineChartRendered(page);
  await page.screenshot({ path: "test-results/geodata-editorial-desktop.png", fullPage: true, caret: "initial" });

  await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
  await expectAppReady(page);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await page.screenshot({ path: "test-results/geodata-editorial-analysis.png", fullPage: true, caret: "initial" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);
  await page.screenshot({ path: "test-results/geodata-editorial-mobile.png", fullPage: true, caret: "initial" });
});

test("every side KPI carries a sparkline", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const kpis = page.getByTestId("side-kpi");
  await expect(kpis).toHaveCount(3);

  // One sparkline each. Path count is deliberately not asserted — a series with
  // an interior gap legitimately draws more than one segment.
  for (let index = 0; index < 3; index += 1) {
    await expect(kpis.nth(index).locator("svg")).toHaveCount(1);
  }
});

test("chart draws a dot lattice instead of horizontal gridlines", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const chart = page.getByTestId("chart-frame");
  await expect(chart.getByTestId("chart-dot-lattice")).toBeVisible();

  // Only the zero rule survives; the hairline-soft gridlines are gone.
  const strokes = await chart.locator("svg line").evaluateAll((lines) =>
    lines.map((line) => line.getAttribute("stroke")),
  );
  expect(strokes).not.toContain("#E7DECF");
  expect(strokes).toContain("#1E1B16");

  // The pattern tile is offset back by half a pitch and its circle is centred
  // in the tile (editorial-line-chart.tsx: `x={PAD_L - lattice.colPitch / 2}`,
  // `cx={lattice.colPitch / 2}`), so dots land exactly on the chart's own grid
  // at (PAD_L, PAD_T) rather than merely tiling the plot rect. Dropping that
  // offset wouldn't affect the lattice's visibility or stroke colors above,
  // so the half-pitch relationship is asserted directly against the live DOM.
  const geometry = await chart.locator("#chart-dot-lattice").evaluate((pattern) => {
    const circle = pattern.querySelector("circle");
    return {
      patternX: Number(pattern.getAttribute("x")),
      patternY: Number(pattern.getAttribute("y")),
      patternWidth: Number(pattern.getAttribute("width")),
      patternHeight: Number(pattern.getAttribute("height")),
      circleCx: Number(circle?.getAttribute("cx")),
      circleCy: Number(circle?.getAttribute("cy")),
    };
  });

  // The left padding grows to fit the widest y label, so read the plot's left
  // edge from the y-axis hairline instead of assuming the 74-unit minimum.
  const PAD_L = Number(await chart.locator('svg line[stroke="#D9CFBE"]').first().getAttribute("x1"));
  expect(PAD_L).toBeGreaterThanOrEqual(74);
  const PAD_T = 16;
  expect(geometry.patternX + geometry.circleCx).toBeCloseTo(PAD_L, 5);
  expect(geometry.patternY + geometry.circleCy).toBeCloseTo(PAD_T, 5);
  expect(geometry.circleCx).toBeCloseTo(geometry.patternWidth / 2, 5);
  expect(geometry.circleCy).toBeCloseTo(geometry.patternHeight / 2, 5);

  // A single-year range gives the lattice no interval to divide, so it drops out
  // entirely and the hairline rules have to come back — without them the axis
  // labels sit against blank paper with nothing to read a value against.
  await page.getByTestId("range-start-handle").press("End");
  await expect(chart.getByTestId("chart-dot-lattice")).toHaveCount(0);

  const singleYearStrokes = await chart.locator("svg line").evaluateAll((lines) =>
    lines.map((line) => line.getAttribute("stroke")),
  );
  expect(singleYearStrokes).toContain("#E7DECF");
});

test("a single-year range states that it has no period instead of reporting 0.0% everywhere", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  await expect(page.getByTestId("period-kpi-cards")).toBeVisible();

  // The 1წ chip is gone, but the rail still reaches a one-year range. Every
  // figure in ძირითადი ინდიკატორები is a start-to-end delta, so this used to
  // render a headline 0.0%, six 4%-wide green growth bars, and one category
  // named both the largest and the slowest growing.
  await page.getByTestId("range-start-handle").press("End");

  await expect(page.getByTestId("period-single-year-note")).toBeVisible();
  await expect(page.getByTestId("period-movers")).toHaveCount(0);
  await expect(page.getByTestId("period-comparison")).toHaveCount(0);

  // Only the delta-derived figures go. A point-in-time KPI is still a fact
  // about the chosen year, so it stays — the two growth KPIs do not.
  const kpis = page.getByTestId("period-kpi-cards");
  await expect(kpis).toContainText("ყველაზე დიდი წილი მშპ-ში");
  await expect(kpis).not.toContainText("ყველაზე დიდი ზრდა");
  await expect(kpis).not.toContainText("ყველაზე ნელი ზრდა");
  await expect(kpis).not.toContainText("პერიოდის ცვლილება");
});

test("ships no server-only provenance fields in explorer payloads", async ({ page }) => {
  for (const route of ["/explorer/expenditure", "/explorer/revenue", "/explorer/analysis"]) {
    await page.goto(`${TEST_BASE_URL}${route}`);
    await expectAppReady(page);

    // lastUpdatedAt and workbook source links are computed from the complete
    // server rows before projection. Per-row source ids and original institution
    // labels have no browser consumer and must not be repeated through RSC.
    const { sourceRegistry, sourceIds, officialInstitutionLabels } =
      await readPayloadOccurrences(page);

    expect({ sourceRegistry, sourceIds, officialInstitutionLabels }, route).toEqual({
      sourceRegistry: 0,
      sourceIds: 0,
      officialInstitutionLabels: 0,
    });
  }
});

// Script text joined with nothing. A separator can only hide an occurrence
// that straddles two flight chunks; it can never invent one, and this is a
// guard, so it should err towards counting.
const readPayloadOccurrences = (page: Page) =>
  page.evaluate(() => {
    const payload = [...document.querySelectorAll("script")].map((script) => script.textContent ?? "").join("");
    const count = (needle: string) => payload.split(needle).length - 1;
    return {
      sourceRegistry: count("sourceUrlOrFile"),
      officialInstitutionLabels: count("officialInstitutionLabelKa"),
      sourceIds: count("sourceId"),
      sourceLocators: count("sourceLocator"),
      snapshotDates: count("snapshotDate"),
      valuations: count("valuation"),
      priceBases: count("priceBasis"),
      accountingStandards: count("accountingStandard"),
      calculations: count("calculation"),
      reviewDates: count("lastReviewedAt"),
    };
  });

test("ships no unread provenance columns on the dataset routes", async ({ page }) => {
  for (const route of [
    "/explorer/debt",
    "/explorer/deficit",
    "/explorer/economy/gdp",
    "/explorer/economy/sectors",
    "/explorer/economy",
    "/explorer/economy/regions",
    "/explorer/economy/regions/imereti",
    "/explorer/inflation/overview",
    "/explorer/inflation/categories",
  ]) {
    await page.goto(`${TEST_BASE_URL}${route}`);
    // The economy hub and the regions index are link maps with no client
    // explorer, so they never raise the app-ready flag; their payload is in the
    // served HTML regardless.
    if (!["/explorer/economy", "/explorer/economy/regions"].includes(route))
      await expectAppReady(page);
    const occurrences = await readPayloadOccurrences(page);

    // These columns exist for validation, mapping review and the database
    // parity check. No client component reads one.
    expect(
      {
        sourceLocators: occurrences.sourceLocators,
        snapshotDates: occurrences.snapshotDates,
        valuations: occurrences.valuations,
        priceBases: occurrences.priceBases,
        calculations: occurrences.calculations,
      },
      route,
    ).toEqual({
      sourceLocators: 0,
      snapshotDates: 0,
      valuations: 0,
      priceBases: 0,
      calculations: 0,
    });

    // The debt page also carries the budget explorer's national GDP rows, whose
    // shared client type still keeps accountingStandard — 30 values no client
    // file reads. That type is out of this change's scope; it is tracked
    // separately. Every provenance column of the debt dataset itself is gone.
    if (route !== "/explorer/debt") {
      expect(occurrences.accountingStandards, `${route} accountingStandard occurrences`).toBe(0);
    }

    // A page passes the newest review date once, as a prop, instead of carrying
    // one on every row. Measured 2026-09-22: 1 on gdp and the two inflation
    // routes, 0 on the rest.
    expect(occurrences.reviewDates, `${route} lastReviewedAt occurrences`).toBeLessThanOrEqual(1);

    // Routes whose client rows carry no source id at all — the deficit rows
    // used to ship one each.
    if (["/explorer/deficit", "/explorer/economy", "/explorer/economy/regions"].includes(route)) {
      expect(occurrences.sourceIds, `${route} sourceId occurrences`).toBe(0);
    }
  }
});

test("hoists the source ids the workbook builders read", async ({ page }) => {
  // One map or run list per page instead of an id per row. The bound is the
  // count measured on 2026-09-22 plus room for a few more published sources;
  // what matters is that none of them grows with the number of rows, which run
  // to hundreds. Debt is absent: its rows still carry sourceId (126 of them),
  // because the plan judged a hoisted map no cheaper there. Run-length encoding
  // would in fact fit it in 22 runs — a follow-up, not a regression.
  for (const [route, limit] of [
    // 10 SNA vintage runs + the prop name + one per published source.
    ["/explorer/economy/gdp", 24],
    ["/explorer/economy/sectors", 8],
    ["/explorer/economy/regions/imereti", 6],
    // Also the three NBG target rows, which cite their own source.
    ["/explorer/inflation/overview", 26],
    ["/explorer/inflation/categories", 22],
  ] as const) {
    await page.goto(`${TEST_BASE_URL}${route}`);
    await expectAppReady(page);
    const occurrences = await readPayloadOccurrences(page);
    expect(occurrences.sourceIds, `${route} sourceId occurrences`).toBeLessThanOrEqual(limit);
  }
});

test("every explorer route family renders the site footer", async ({ page }) => {
  // These are the site's main SEO landing targets, and the footer carries the
  // CC BY 4.0 licence, the contact address and the methodology link. Under the
  // owner's navigation design the footer is the only place the methodology
  // route appears on data pages, so without it ~85 pages have no path there.
  for (const route of [
    "/explorer",
    "/explorer/expenditure",
    "/explorer/revenue",
    "/explorer/analysis",
    "/explorer/debt",
    "/explorer/deficit",
    "/explorer/municipalities",
    "/explorer/municipalities/oni",
    "/explorer/municipalities/georgia",
  ]) {
    await page.goto(`${TEST_BASE_URL}${route}`);

    const footer = page.getByTestId("site-footer");
    await expect(footer, route).toBeVisible();
    await expect(footer.getByRole("link", { name: "მეთოდოლოგია" }), route).toBeVisible();
    await expect(footer, route).toContainText("CC BY 4.0");
    await expect(footer, route).toContainText("info@fiscal.ge");
  }
});

test("exposes the explorer breadcrumb as a navigation landmark", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  // BreadcrumbTrail next door already does this correctly on the methodology
  // pages. PageHeader — used on every explorer route including all
  // 76 municipal pages — rendered the same information as a paragraph of spans
  // with an unhidden "/" separator and the current page marked by colour alone.
  const header = page.getByTestId("explorer-header");
  const trail = header.getByRole("navigation", { name: "Breadcrumb" });

  await expect(trail).toBeVisible();
  await expect(trail.locator("[aria-current='page']")).toHaveText("ხარჯები");
  await expect(trail.locator("span[aria-hidden='true']").first()).toHaveText("/");
});

test("Explorer branding uses the reversed mark without changing shell behavior", async ({ page, request }) => {
  for (const viewport of [
    { width: 1200, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
    const sidebar = page.getByTestId("data-sidebar");
    const home = sidebar.getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true });
    const mark = sidebar.getByTestId("sidebar-brand-mark");
    await expect(home).toHaveCount(1);
    await expect(mark).toHaveAttribute("src", "/brand/fiscal-logo-mark-reversed.svg");
    await expect(mark).toHaveAttribute("alt", "");
    const assetResponse = await request.get(await mark.evaluate((image: HTMLImageElement) => image.currentSrc));
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
    await expect.poll(() => mark.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect((await mark.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(24);
    await expect(home).toContainText("Fiscal.ge");
    await expect(home).toContainText("ღია მონაცემები");
  }
});

test("sidebar collapses to a rail and remembers the choice", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const sidebar = page.getByTestId("data-sidebar");
  const toggle = page.getByTestId("sidebar-toggle");

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expectSidebarWidth(page, 232);
  await expect(page.getByTestId("section-link-revenue")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expectSidebarWidth(page, 52);
  await expect(sidebar).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByTestId("section-link-revenue")).toHaveCount(0);
  await expect(page.getByTestId("sidebar-brand-mark")).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "მთავარი", exact: true })).toBeVisible();
  // The rail keeps orientation instead of the section list (spec §4.2).
  await expect(sidebar).toContainText("მონაცემები · ბიუჯეტი");

  // The toggle is not one-way: expanding must bring the sections back.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expectSidebarWidth(page, 232);
  await expect(page.getByTestId("section-link-revenue")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
  await expectSidebarWidth(page, 52);

  expect(consoleProblems).toEqual([]);
});

test("sidebar is a full-width top bar with a sheet below 900px", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // Arrive carrying a collapse preference set on a desktop. It must be ignored
  // here rather than applied as an unexplained 52px rail on a phone.
  await page.addInitScript(() => window.localStorage.setItem("geodata:sidebar-collapsed", "1"));

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const toggle = page.getByTestId("sidebar-toggle");
  const revenueLink = page.getByTestId("section-link-revenue");
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox?.width ?? 0).toBeGreaterThanOrEqual(36);
  expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(36);
  await expect(toggle).toHaveAttribute("aria-controls", "data-sidebar-navigation");
  await expect(page.locator("#data-sidebar-navigation")).toHaveCount(1);

  // Tripwire: the sidebar used to ship on phones as a 232px ink column stacked
  // above the content. That state overflows nothing, so the mobile-overflow test
  // above passes in both worlds — assert the bar's shape directly.
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const bar = await page.getByTestId("data-sidebar").boundingBox();
  expect(bar?.width ?? 0).toBeGreaterThan(clientWidth - 2);
  expect(bar?.width ?? 0).toBeLessThan(clientWidth + 2);
  expect(bar?.height ?? 0).toBeLessThan(120);

  // Closed sheet, and the stored preference left data-collapsed alone.
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("data-sidebar")).toHaveAttribute("data-collapsed", "false");
  await expect(revenueLink).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(revenueLink).toBeVisible();
  await expectNoPageOverflow(page);

  // Escape closes the sheet from inside it and hands focus back to the trigger
  // rather than dropping it on a display:none link.
  await revenueLink.focus();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(revenueLink).toBeHidden();
  await expect(toggle).toBeFocused();

  // Tapping a section must close the sheet too. The explorer layout persists
  // across section routes, so nothing unmounts the panel — without a reset the
  // user lands on the nav list they just used, the section pushed below it, and
  // a phone has no Escape key to undo it.
  await toggle.click();
  await expect(revenueLink).toBeVisible();
  await revenueLink.click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expectAppReady(page);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(revenueLink).toBeHidden();

  expect(consoleProblems).toEqual([]);
});

test("hub lists six cards, all six live", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer`);
  await expectAppReady(page);

  await expect(page.getByTestId("hub-card")).toHaveCount(6);
  await expect(page.getByTestId("hub-card").locator("h2")).toHaveCount(6);
  for (const card of await page.getByTestId("hub-card").all()) {
    await expect(card.locator("h2")).toHaveCount(1);
  }
  // Scoped to the hub: the sidebar carries a ხარჯები link too, and an unscoped
  // role query would trip Playwright's strict mode.
  await expect(page.getByTestId("budget-hub").getByRole("link", { name: /ხარჯები/ })).toHaveAttribute(
    "href",
    "/explorer/expenditure",
  );

  // Card 03: routed like the other three, not a "მალე" marker any more.
  const municipalities = page.getByTestId("hub-card").nth(2);
  await expect(municipalities).toContainText("მუნიციპალიტეტები");
  await expect(municipalities).not.toContainText("მალე");
  await expect(municipalities).not.toHaveAttribute("aria-disabled");
  expect(await municipalities.evaluate((node) => node.tagName)).toBe("A");
  await expect(municipalities).toHaveAttribute("href", "/explorer/municipalities");

  // No invented article count or unit total anywhere on the hub.
  await expect(page.getByTestId("budget-hub")).not.toContainText("სტატია");
  await expect(page.getByTestId("budget-hub")).not.toContainText("64 ერთეული");

  // Absence alone would pass on a hub whose footers all came back null, so also
  // assert a real figure is there. The shape, not the figure: the number moves
  // with every dataset update, the "<year> · <n.n> მლრდ ₾" contract does not.
  await expect(page.getByTestId("hub-card").first()).toContainText(/\d{4} · [\d,]+\.\d მლრდ ₾/);
  // Card 03 now carries the same contract — this is the figure this task adds.
  await expect(municipalities).toContainText(/\d{4} · [\d,]+\.\d მლრდ ₾/);
  await expect(municipalities).toContainText("2025 · 6.1 მლრდ ₾");

  const debt = page.getByTestId("hub-card").nth(4);
  await expect(debt).toContainText("ვალი");
  await expect(debt).toHaveAttribute("href", "/explorer/debt");
  await expect(debt).toContainText(/2025 · [\d,]+\.\d მლრდ ₾/);

  const deficit = page.getByTestId("hub-card").nth(5);
  await expect(deficit).toContainText("დეფიციტი");
  await expect(deficit).toHaveAttribute("href", "/explorer/deficit");
  await expect(deficit).toContainText("2025 · −1.5% მშპ-ის");

  // The card is not just styled as a link — clicking it actually lands on the
  // municipalities index.
  await municipalities.click();
  await expect(page).toHaveURL(/\/explorer\/municipalities$/);
  await expect(page.getByTestId("municipality-map")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test("legacy nav hashes redirect to their route", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer#nav=analysis&ay=2024`);
  await expect(page).toHaveURL(/\/explorer\/analysis/);
  await expect(page).toHaveURL(/ay=2024/);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();

  await page.goto(`${TEST_BASE_URL}/explorer#nav=revenue&m=table`);
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByTestId("explorer-table")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});
});
