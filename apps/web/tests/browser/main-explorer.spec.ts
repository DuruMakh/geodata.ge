import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { expectReadableText } from "./color-contrast";
import { expectEnglish } from "./expect-english";
import { TEST_BASE_URL } from "./test-base-url";

// A line chart without its own label is named "{first series}, {count} სერია, {first}–{last}".
const LINE_CHART_NAME = /, \d+ სერია, \d{4}–\d{4}$/;

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
// One SeriesSelectorRow serves every section and width; its tint and muted value have no variants.
test("expenditure series values stay readable on selected and hover backgrounds at 1366px", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);
  const row = page.locator(`[data-testid="series-row"][data-series-id="expenditure.total"]`);
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

      if (section === "analysis") {
        // The English analysis is in the initial HTML too.
        expect((await page.goto(`${TEST_BASE_URL}/en/explorer/analysis`))?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
        for (const id of ["snapshot-treemap", "every-100-gel", "budget-radar", "budget-field", "single-year-ranking"]) await expect(page.getByTestId(id)).toBeVisible();
        await expectEnglish(page);
      }
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

  // Every side KPI carries one sparkline. Path count is deliberately not asserted:
  // a series with an interior gap legitimately draws more than one segment.
  const kpis = page.getByTestId("side-kpi");
  await expect(kpis).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(kpis.nth(index).locator("svg")).toHaveCount(1);
  }

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

  // Stacked below the chart at 820px, the selector keeps the same section order (above).
  await page.setViewportSize({ width: 820, height: 900 });
  const chartBox = await page.getByTestId("chart-panel").boundingBox();
  const selectorBox = await panel.boundingBox();
  expect(chartBox).not.toBeNull();
  expect(selectorBox).not.toBeNull();
  expect(selectorBox!.y).toBeGreaterThan(chartBox!.y + chartBox!.height);
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

test("bulk selector exposes mixed, empty, and checked states", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const bulk = panel.getByTestId("series-toggle-all");
  const indicator = panel.getByTestId("series-toggle-indicator");

  await expect(bulk).not.toHaveAttribute("role", "checkbox");
  await expect(bulk).toHaveAttribute("data-state", "mixed");
  await expect(indicator).toHaveText("—");

  await panel.getByTestId("series-row").nth(1).getByTestId("series-row-toggle").click();
  await expect(panel.getByTestId("series-status")).toContainText(/სერიები\s*2 \/ \d+/);
  await expect(bulk).toHaveAttribute("data-state", "mixed");
  await expect(indicator).toHaveText("—");

  await bulk.click();
  await expect(bulk).toHaveAttribute("data-state", "false");
  await expect(indicator).toHaveText("");
  await expect(bulk).toContainText("ყველას მონიშვნა");
  await expect(panel.locator('button[title][aria-pressed="true"]')).toHaveCount(0);

  await panel.getByTestId("series-search").fill("ჯანმრთელობა");
  await bulk.click();
  await expect(bulk).toHaveAttribute("data-state", "true");
  await expect(indicator).toHaveText("✓");
  await expect(bulk).toContainText("გასუფთავება");

  // Search never scopes the bulk action: with the search cleared, every series is selected.
  await panel.getByTestId("series-search").fill("");
  const allCount = await panel.locator("button[title]").count();
  await expect(panel.locator('button[title][aria-pressed="true"]')).toHaveCount(allCount);
});

test("explorer controls expose line, table, grouping, and the share pill", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const chartPanel = page.getByTestId("chart-panel");
  const seriesPanel = page.getByTestId("series-selector");
  await expect(chartPanel.getByTestId("chart-mode-line")).toHaveAttribute("aria-pressed", "true");
  await expect(chartPanel.getByTestId("chart-mode-table")).toBeVisible();
  // Stacked (this 1280px viewport leaves a column under 1100px), the grouping switch leads
  // the chart panel; the series panel's copy is for the two-column layout only (owner decision D4).
  await expect(chartPanel.getByTestId("grouping-fields")).toHaveAttribute("aria-pressed", "true");
  await expect(chartPanel.getByTestId("grouping-ministries")).toBeVisible();
  await expect(chartPanel.getByTestId("grouping-ministries")).toHaveText("სამინისტროები");
  await expect(seriesPanel.getByTestId("aside-grouping-ministries")).toBeHidden();
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

  await chartPanel.getByTestId("grouping-ministries").click();
  await expect(seriesPanel.getByTestId("series-search")).toHaveAttribute("placeholder", "ძებნა");

  await chartPanel.getByTestId("measure-share-toggle").click();
  await expect(chartPanel).toHaveAttribute("data-measure", "share_of_gdp");
  await expect(chartPanel.getByTestId("measure-share-toggle")).toHaveText("% მშპ-ში");
  await expect(chartPanel.getByTestId("measure-share-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("img", { name: LINE_CHART_NAME }).hover({ position: { x: 300, y: 100 } });
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

  // Municipalities is the first section with child routes: the row stays
  // current one level deeper, on a municipality page, and no other row claims it.
  await page.goto(`${TEST_BASE_URL}/explorer/municipalities/tbilisi`);
  await expect(page.getByTestId("data-sidebar").getByTestId("section-link-municipalities")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("data-sidebar").getByTestId("section-link-expenditure")).not.toHaveAttribute("aria-current", "page");

  expect(consoleProblems).toEqual([]);
});

// Next prefetches a <Link> as soon as it enters the viewport, so every sidebar, footer and
// list row used to pull its page's data in the background. Prefetch runs only in production:
// against `next dev` these tests pass without proving anything (CI runs them on `next start`).
// The municipal index also at phone width, where the whole 64-row list is in the page; the
// regional index and a region page list their regions; dataset pages link their methodology
// page; the methodology hub lists every dataset.
for (const [path, width] of [
  ["/explorer/municipalities", 390],
  ["/explorer/municipalities", 1280],
  ["/explorer/economy/regions", 1280],
  ["/explorer/economy/regions/imereti", 1280],
  ["/explorer/unemployment/overview", 1280],
  ["/methodology", 1280],
  ["/explorer/expenditure", 1280],
] as const) {
  test(`opening ${path} at ${width}px fetches no other page's data`, async ({ page }) => {
    const prefetched: string[] = [];
    let inFlight = 0;
    let lastActivity = Date.now();
    page.on("request", (request) => {
      inFlight += 1;
      lastActivity = Date.now();
      const url = new URL(request.url());
      if (url.searchParams.has("_rsc")) prefetched.push(url.pathname);
    });
    const settled = () => {
      inFlight -= 1;
      lastActivity = Date.now();
    };
    page.on("requestfinished", settled);
    page.on("requestfailed", settled);

    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${TEST_BASE_URL}${path}`);
    // A link starts prefetching once it has hydrated and enters the viewport, so wait until
    // React has hydrated every link (not every page here marks itself ready: the methodology
    // hub does not). networkidle is not that signal: under load Playwright reports it before
    // DOMContentLoaded, and a request after it (the sidebar's compact logo) followed by the
    // load event clears it for good, so a second wait for it hung until the test timed out.
    await page.waitForFunction(() =>
      [...document.querySelectorAll("a[href]")].every((link) => Object.keys(link).some((key) => key.startsWith("__reactFiber$"))),
    );
    // Scroll the page down half a screen at a time so every link in the page flow passes
    // through the viewport (a list in its own scroll box, as the municipal index is from
    // 768px, shows only its first screen), then wait until nothing has been in flight for
    // half a second, so a prefetch that starts late under load is still counted.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
        window.scrollTo(0, y);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    });
    await expect
      .poll(() => inFlight === 0 && Date.now() - lastActivity >= 500, { intervals: [100], timeout: 15_000 })
      .toBe(true);
    expect(prefetched).toEqual([]);

    if (path !== "/explorer/expenditure") return;
    // Without a prefetch the sidebar still navigates in-app, not by a full reload.
    await expectAppReady(page);
    await page.evaluate(() => ((window as unknown as { stillHere?: boolean }).stillHere = true));
    await page.getByTestId("data-sidebar").getByTestId("section-link-revenue").click();
    await expect(page).toHaveURL(/\/explorer\/revenue$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ფინანსდება საქართველოს ბიუჯეტი");
    expect(await page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(true);
  });
}

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

  await page.getByTestId("grouping-ministries").click();
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
  // Two decimals: revenue caps there, as five of its lines sit under 1 bn (DESIGN.md §11, U04-05). 2004 total
  // 2,283,035,800 ₾ and 2005 liabilities 85,316,805 ₾.
  await expect(totalRow).toContainText("2.28");
  await expect(liabilitiesRow).toContainText("—");
  await expect(liabilitiesRow).toContainText("0.09");

  const revenueExport = await downloadWorkbook(page);
  expect(revenueExport.download.suggestedFilename()).toMatch(/^fiscal-revenue-\d{4}-\d{4}\.xlsx$/);
  expect(revenueExport.workbook.getWorksheet("მარტივი ცხრილი")!.getCell("A4").value).toBe("მთლიანი შემოსავლები");
  const exportedRows = revenueExport.workbook.getWorksheet("მონაცემები")!.getRows(2, 20) ?? [];
  expect(exportedRows.some((row) => row.getCell(1).value === 2004 && row.getCell(3).value === "ვალდებულებების ზრდა")).toBe(false);
  expect(exportedRows.some((row) => row.getCell(1).value === 2005 && row.getCell(3).value === "ვალდებულებების ზრდა")).toBe(true);

  expect(consoleProblems).toEqual([]);
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
  // Each caret is named after its own ministry.
  await panel.getByRole("button", { name: /^.+ — ქვეკატეგორიები$/ }).first().click();
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

  // The GDP share adds its analysis column, and the official GDP source sits in Sources only.
  await page.getByTestId("measure-share-toggle").click();
  const { workbook: share } = await downloadWorkbook(page);
  expect(share.getWorksheet("მონაცემები")!.getRow(1).values).toEqual([
    undefined,
    "წელი",
    "მთავარი ჯგუფი",
    "კატეგორია",
    "თანხა (₾)",
    "სტატუსი",
    "მშპ-ის წილი (%)",
  ]);
  const analysis = share.getWorksheet("მონაცემები")!;
  expect(analysis.getCell("F2").value).toEqual(expect.any(Number));
  expect(analysis.getCell("F2").numFmt).toBe("0.0%");
  const readableText = JSON.stringify(share.getWorksheet("მარტივი ცხრილი")!.getSheetValues());
  const sourceText = JSON.stringify(share.getWorksheet("წყაროები")!.getSheetValues());
  expect(readableText).not.toContain("https://www.geostat.ge/");
  expect(sourceText).toContain("https://www.geostat.ge/");
  expect(sourceText).not.toMatch(/docs[\\/]Raw Data|national-gdp-annual/);
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
  // The Excel button's own status: the chart's share button has one too (DESIGN.md §7.17).
  const announcement = button.locator("..").getByRole("status");
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

test("analysis view renders the fixed single-year section order", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
  await expectAppReady(page);

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ბიუჯეტის სურათი");
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator("main h2")).toHaveCount(5);

  await expect(page.getByTestId("analysis-year-selector")).toContainText("2025");
  // On a desktop the years wrap instead of scrolling (phones scroll one row; see the mobile test).
  expect(await page.getByTestId("analysis-year-selector").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
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

// U05-15: the side tabs, grouping tabs and year row are reached with Tab and pressed with Enter or Space.
test("the analysis tabs and year row work from the keyboard", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
  await expectAppReady(page);
  const caption = page.getByTestId("single-year-ranking").locator("caption");
  const expenditure = page.getByTestId("analysis-side-expenditure"), revenue = page.getByTestId("analysis-side-revenue");

  await expenditure.focus();
  await page.keyboard.press("Tab");
  await expect(revenue).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(revenue).toHaveAttribute("aria-pressed", "true");
  await expect(caption).toContainText("შემოსავლები კატეგორიების მიხედვით");

  await page.keyboard.press("Shift+Tab");
  await expect(expenditure).toBeFocused();
  await page.keyboard.press("Space");
  await expect(expenditure).toHaveAttribute("aria-pressed", "true");
  // Revenue, then the grouping row's fields and ministries.
  for (let press = 0; press < 3; press += 1) await page.keyboard.press("Tab");
  const ministries = page.getByTestId("analysis-grouping-ministries");
  await expect(ministries).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(ministries).toHaveAttribute("aria-pressed", "true");
  await expect(caption).toContainText("ხარჯები უწყებების მიხედვით");

  const years = page.getByTestId("analysis-year-selector").getByRole("button");
  const earlier = years.nth((await years.count()) - 2);
  const year = (await earlier.textContent())!.match(/\d{4}/)![0];
  await earlier.focus();
  await page.keyboard.press("Space");
  await expect(earlier).toHaveAttribute("aria-pressed", "true");
  await expect(caption).toContainText(year);
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

test("the line chart is named from its series and read with the arrow keys", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const frame = page.getByTestId("chart-frame");
  const chart = frame.locator('svg[role="img"]:visible');
  await expect(chart).toHaveAttribute("aria-label", /^.+, 1 სერია, \d{4}–\d{4}$/);
  const [, first, last] = /(\d{4})–(\d{4})$/.exec((await chart.getAttribute("aria-label")) ?? "")!;
  const caption = page.locator(`[id="${await chart.getAttribute("aria-describedby")}"]`);
  await expect(caption).toContainText(`, ${last}: `);

  // A pointer sees the readout; the live line speaks only for the keys.
  const live = page.locator('figure [aria-live="polite"]');
  await chart.hover({ position: { x: 300, y: 100 } });
  await expect(page.getByTestId("chart-tooltip")).toBeVisible();
  await expect(live).toHaveText("");
  await page.mouse.move(0, 0);

  // Nothing scrolls sideways, so the frame is no stop: Tab goes from the control before it straight to the chart.
  await expect(frame).not.toHaveAttribute("tabindex");
  await chart.evaluate((svg) => {
    const stops = [...document.querySelectorAll<HTMLElement | SVGElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => element.getClientRects().length > 0);
    (stops[stops.indexOf(svg) - 1] as HTMLElement).focus();
  });
  await page.keyboard.press("Tab");
  await expect(chart).toBeFocused();

  const period = page.getByTestId("chart-tooltip").getByTestId("chart-tooltip-period");
  await page.keyboard.press("End");
  await expect(period).toHaveText(last!);
  await page.keyboard.press("ArrowLeft");
  await expect(period).toHaveText(String(Number(last) - 1));
  await page.keyboard.press("Home");
  await expect(period).toHaveText(first!);
  await expect(live).toHaveText(new RegExp(`^${first}: .+ \\d`));

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("chart-tooltip")).toHaveCount(0);
});

test("mobile analysis layouts have no page overflow", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`${TEST_BASE_URL}/explorer/analysis`);
  await expectAppReady(page);

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  // No native select on the phone analysis page; the radar still shows there.
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
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
    // Phones: one horizontally scrolling row (DESIGN §12), opened on the active year.
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

    const boxes = await yearButtons.evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, width: box.width, height: box.height };
      }),
    );
    expect(boxes.every((box) => box.width >= 36 && box.height >= 36)).toBe(true);
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);

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
    // The whole name is in the cell; CSS clamps it to two lines on a phone.
    await expect(longLabel).toContainText("ინფრასტრუქტურა და რეგიონული განვითარება");
    expect(await longLabel.locator(".line-clamp-2").evaluate((element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight))).toBeLessThanOrEqual(2.05);

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

    // Picking an early year keeps it in view and still drives the page.
    await selector.evaluate((element) => { element.scrollLeft = 0; });
    await selector.getByRole("button", { name: "2010", exact: true }).click();
    await expect(selector.getByRole("button", { name: "2010", exact: true })).toHaveAttribute("aria-pressed", "true");
  }

  expect(consoleProblems).toEqual([]);
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

// The payload is the inline script text of the served HTML — the RSC flight
// data the client hydrates from — so a plain request reads it without a page.
// Script text joined with nothing. A separator can only hide an occurrence
// that straddles two flight chunks; it can never invent one, and this is a
// guard, so it should err towards counting.
const readPayloadOccurrences = async (request: APIRequestContext, route: string) => {
  const response = await request.get(`${TEST_BASE_URL}${route}`);
  expect(response.status(), route).toBe(200);
  const html = await response.text();
  const payload = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join("");
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
    estimateBases: count("estimateBasis"),
    reviewDates: count("lastReviewedAt"),
  };
};

test("ships no server-only provenance fields in explorer payloads", async ({ request }) => {
  for (const route of ["/explorer/expenditure", "/explorer/revenue", "/explorer/analysis"]) {

    // lastUpdatedAt and workbook source links are computed from the complete
    // server rows before projection. Per-row source ids and original institution
    // labels have no browser consumer and must not be repeated through RSC.
    const { sourceRegistry, sourceIds, officialInstitutionLabels } =
      await readPayloadOccurrences(request, route);

    expect({ sourceRegistry, sourceIds, officialInstitutionLabels }, route).toEqual({
      sourceRegistry: 0,
      sourceIds: 0,
      officialInstitutionLabels: 0,
    });
  }
});

test("ships no unread provenance columns on the dataset routes", async ({ request }) => {
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
    "/explorer/demography",
    "/explorer/demography/population",
    "/explorer/demography/population/georgia",
    "/explorer/demography/population/region/adjara",
    "/explorer/demography/population/batumi",
    "/explorer/demography/births-deaths",
    "/explorer/demography/age-sex",
    "/explorer/demography/marriages-divorces",
  ]) {
    const occurrences = await readPayloadOccurrences(request, route);

    // These columns exist for validation, mapping review and the database
    // parity check. No client component reads one.
    expect(
      {
        sourceLocators: occurrences.sourceLocators,
        snapshotDates: occurrences.snapshotDates,
        valuations: occurrences.valuations,
        priceBases: occurrences.priceBases,
        calculations: occurrences.calculations,
        estimateBases: occurrences.estimateBases,
      },
      route,
    ).toEqual({
      sourceLocators: 0,
      snapshotDates: 0,
      valuations: 0,
      priceBases: 0,
      calculations: 0,
      estimateBases: 0,
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

test("hoists the source ids the workbook builders read", async ({ request }) => {
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
    const occurrences = await readPayloadOccurrences(request, route);
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
  const trail = header.getByRole("navigation", { name: "ნავიგაციის ბილიკი" });

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
    // Below 900px the brand sits in the phone bar, which is its own element (sidebar-topbar) beside the closed menu.
    const phone = viewport.width < 900;
    const shell = page.getByTestId(phone ? "sidebar-topbar" : "data-sidebar");
    const home = shell.getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true });
    const mark = phone ? home.locator("img") : shell.getByTestId("sidebar-brand-mark");
    await expect(home).toHaveCount(1);
    await expect(mark).toHaveAttribute("src", "/brand/fiscal-logo-mark-reversed.svg");
    await expect(mark).toHaveAttribute("alt", "");
    const assetResponse = await request.get(await mark.evaluate((image: HTMLImageElement) => image.currentSrc));
    expect(assetResponse.status()).toBe(200);
    expect(assetResponse.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
    await expect.poll(() => mark.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect((await mark.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(24);
    await expect(home).toContainText("Fiscal.ge");
    if (!phone) await expect(home).toContainText("ღია მონაცემები");
  }
});

test("sidebar collapses to a rail and remembers the choice", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const sidebar = page.getByTestId("data-sidebar");
  const toggle = page.getByTestId("sidebar-toggle");

  // 272px expanded and a 72px icon rail (spec 2026-10-24-explorer-regroup §4).
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expectSidebarWidth(page, 272);
  await expect(page.getByTestId("section-link-revenue")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expectSidebarWidth(page, 72);
  await expect(sidebar).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByTestId("section-link-revenue")).toHaveCount(0);
  // The rail keeps the brand mark as its way home, and keeps orientation by marking the current group's icon.
  const home = sidebar.getByRole("link", { name: "Fiscal.ge — მთავარი", exact: true });
  await expect(home).toBeVisible();
  await expect(home.getByTestId("sidebar-brand-mark")).toBeVisible();
  await expect(page.getByTestId("group-link-budget")).toHaveCSS("box-shadow", /inset/);
  await expect(page.getByTestId("group-link-economy")).toHaveCSS("box-shadow", "none");

  // The toggle is not one-way: expanding must bring the sections back.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expectSidebarWidth(page, 272);
  await expect(page.getByTestId("section-link-revenue")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
  await expectSidebarWidth(page, 72);

  expect(consoleProblems).toEqual([]);
});

// Below 900px the bar (sidebar-topbar) holds the menu button, and the menu opens the sidebar itself full screen.
test("sidebar is a full-width top bar with a menu below 900px", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // Arrive carrying a collapse preference set on a desktop. It must be ignored
  // here rather than applied as an unexplained 72px rail on a phone.
  await page.addInitScript(() => window.localStorage.setItem("geodata:sidebar-collapsed", "1"));

  await page.goto(`${TEST_BASE_URL}/explorer/expenditure`);
  await expectAppReady(page);

  const toggle = page.getByTestId("sidebar-menu-button");
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
  const bar = await page.getByTestId("sidebar-topbar").boundingBox();
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

  // Escape closes the menu from inside it and hands focus back to the trigger
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

// Budget's eight cards moved from /explorer (now All data) to the Budget group page; a card shows its figure, then its period.
test("the Budget group page lists eight cards, all eight live", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto(`${TEST_BASE_URL}/explorer/budget`);
  await expectAppReady(page);

  const cards = page.locator("#t-budget").getByTestId("explorer-card");
  await expect(cards).toHaveCount(8);
  for (const card of await cards.all()) {
    await expect(card.locator("h3")).toHaveCount(1);
  }
  // Scoped to the section: the sidebar carries a ხარჯები link too, and an unscoped
  // role query would trip Playwright's strict mode.
  await expect(page.locator("#t-budget").getByRole("link", { name: "ხარჯები", exact: true })).toHaveAttribute(
    "href",
    "/explorer/expenditure",
  );

  // Card 05: routed like the others, not a "მალე" marker any more.
  const municipalities = cards.nth(4);
  await expect(municipalities).toContainText("მუნიციპალიტეტები");
  await expect(municipalities).not.toContainText("მალე");
  await expect(municipalities).not.toHaveAttribute("aria-disabled");
  expect(await municipalities.evaluate((node) => node.tagName)).toBe("A");
  await expect(municipalities).toHaveAttribute("href", "/explorer/municipalities");

  // No invented article count or unit total anywhere on the page's cards.
  await expect(page.locator("#t-budget")).not.toContainText("სტატია");

  // Absence alone would pass on a page whose figures all came back null, so also
  // assert a real figure is there. The shape, not the figure: the number moves
  // with every dataset update, the "<n.n> მლრდ ₾" then "<year>" contract does not.
  await expect(cards.first()).toContainText(/[\d,]+\.\d მლრდ ₾\d{4}/);
  const types = cards.nth(1);
  await expect(types).toContainText("ხარჯების სახეები");
  await expect(types).toHaveAttribute("href", "/explorer/expenditure-types");
  await expect(types).toContainText(/[\d,]+\.\d მლრდ ₾\d{4}/);
  // Card 05 carries the same contract.
  await expect(municipalities).toContainText(/[\d,]+\.\d მლრდ ₾\d{4}/);

  await expect(cards.nth(5).getByRole("heading")).toHaveText("ანალიზი");

  const debt = cards.nth(6);
  await expect(debt).toContainText("ვალი");
  await expect(debt).toHaveAttribute("href", "/explorer/debt");
  await expect(debt).toContainText(/[\d,]+\.\d მლრდ ₾2025/);

  const deficit = cards.nth(7);
  await expect(deficit).toContainText("დეფიციტი");
  await expect(deficit).toHaveAttribute("href", "/explorer/deficit");
  await expect(deficit).toContainText(/[+−]?\d+\.\d%\d{4}/);

  // The card is not just styled as a link — clicking it actually lands on the
  // municipalities index.
  await municipalities.click();
  await expect(page).toHaveURL(/\/explorer\/municipalities$/);
  await expect(page.getByTestId("municipality-map")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test("legacy nav hashes redirect to their route", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  // The hub redirects from an effect, so only once it has hydrated; it raises data-app-ready in
  // that same commit. Waiting for it first keeps the hub's hydration out of the redirect's budget.
  await page.goto(`${TEST_BASE_URL}/explorer#nav=analysis&ay=2024`);
  await expectAppReady(page);
  await expect(page).toHaveURL(/\/explorer\/analysis/);
  await expect(page).toHaveURL(/ay=2024/);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();

  await page.goto(`${TEST_BASE_URL}/explorer#nav=revenue&m=table`);
  await expectAppReady(page);
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByTestId("explorer-table")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});
});
