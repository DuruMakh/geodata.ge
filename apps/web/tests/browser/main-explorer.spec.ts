import { expect, test, type Page } from "@playwright/test";

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

async function expectSidebarWidth(page: Page, width: number) {
  // The rail animates over 150ms, so a single boundingBox() can land mid-transition.
  await expect
    .poll(async () => Math.round((await page.getByTestId("data-sidebar").boundingBox())?.width ?? 0))
    .toBe(width);
}

async function expectLineChartRendered(page: Page) {
  const line = page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']").first();

  await expect(line).toBeVisible();

  const box = await line.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(2);
  expect(box?.height ?? 0).toBeGreaterThan(2);
}

test("explorer hydrates with the editorial shell and default expenditure view", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100/explorer/expenditure");
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
  await page.goto("http://localhost:3100/explorer/expenditure");
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
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  const search = panel.getByTestId("series-search");
  const totalLabel = await panel.locator('[data-level="total"] [data-testid="series-label"]').innerText();
  const emptyState = panel.getByText(/^0 შედეგი/);

  await search.fill(totalLabel);
  await expect(panel.getByTestId("series-row")).toHaveCount(1);
  await expect(emptyState).toHaveCount(0);

  await search.fill("definitely-no-national-series-match");
  await expect(panel.getByTestId("series-row")).toHaveCount(1);
  await expect(emptyState).toBeVisible();
});

test("standardized selector keeps its order when stacked below the chart", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto("http://localhost:3100/explorer/expenditure");
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
  await page.goto("http://localhost:3100/explorer/expenditure");
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
  await page.goto("http://localhost:3100/explorer/expenditure");
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

  await page.goto("http://localhost:3100/explorer/expenditure");
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
  await expect(page.getByTestId("explorer-table")).toContainText("ცვლილება");

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
  await expect(page.getByTestId("explorer-table")).toContainText("წილი მშპ-ში 2025");
  await expect(page.getByTestId("explorer-table")).not.toContainText("100.0%");

  expect(consoleProblems).toEqual([]);
});

test("revenue nav reuses the identical system without a grouping switch", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100/explorer/revenue");
  await expectAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება საქართველოს ბიუჯეტი");
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

  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const sidebar = page.getByTestId("data-sidebar");
  await expect(sidebar.getByTestId("section-link-expenditure")).toHaveAttribute("aria-current", "page");

  await sidebar.getByTestId("section-link-revenue").click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება საქართველოს ბიუჯეტი");
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

  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  await page.getByTestId("grouping-ministries").click();
  await expect(page.getByTestId("grouping-ministries")).toHaveAttribute("aria-pressed", "true");

  const seriesSelector = page.getByTestId("series-selector");
  await expect(seriesSelector.locator('[data-level="admin_category"]').first()).toBeVisible();
  await expect(seriesSelector.locator('[data-level="major_program"]')).toHaveCount(0);

  // Expand the first ministry with programs.
  const caret = seriesSelector.locator('[data-level="admin_category"] button[aria-expanded="false"]').first();
  await caret.click();
  const firstProgram = seriesSelector.locator('[data-level="major_program"]').first();
  await expect(firstProgram).toBeVisible();

  // Programs are shown by NAME only — the official tavi-VI code is not surfaced.
  const programText = (await firstProgram.textContent()) ?? "";
  expect(programText).not.toMatch(/\d{2} \d{2}/);

  // Searching by program name keeps the parent and auto-expands to matches.
  const programName = (await firstProgram.locator("span.line-clamp-2").textContent())?.trim().slice(0, 20);
  if (!programName) throw new Error("Expected a program name");
  await page.getByTestId("series-search").fill(programName);
  await expect(seriesSelector.locator('[data-level="major_program"]').first()).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test("2004 expenditure is complete across functions, ministries, GDP share, and CSV exports", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  const { readFile } = await import("node:fs/promises");

  async function downloadCsv() {
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("series-csv").click();
    const download = await downloadPromise;
    const path = await download.path();
    if (!path) throw new Error("Expected a local CSV download path");
    return (await readFile(path)).toString("utf8");
  }

  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const fields = page.getByTestId("series-selector");
  await expect(page.getByTestId("year-range-strip")).toContainText("2004–2025");
  await expect(fields.locator('[data-level="public_field"]')).toHaveCount(13);
  await expect(fields.getByTitle("ჯანდაცვა")).toBeVisible();
  await expect(fields.getByTitle("სოციალური დაცვა")).toBeVisible();
  await expect(fields.getByTitle(/ცენტრალური ბიუჯეტი/)).toHaveCount(0);

  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toContainText("2004");
  await expect(page.getByTestId("explorer-table")).toContainText("1.93");

  await page.getByTestId("measure-share-toggle").click();
  await expect(page.getByTestId("explorer-table")).toContainText("19.6%");

  const functionalCsv = await downloadCsv();
  expect(functionalCsv).toContain("2004,expenditure.total,,total,,,მთლიანი ხარჯი,Total expenditure,1930210300,actual");
  expect(functionalCsv).toContain("2004-annual-execution-annex.pdf");
  expect(functionalCsv).toContain(",9824300000,sna_1993,final_as_published,");
  expect(functionalCsv).not.toContain("1500000000");

  await fields.getByTestId("grouping-ministries").click();
  await expect(page.getByTestId("year-range-strip")).toContainText("2004–2025");
  await fields.getByTestId("series-toggle-all").click();
  await fields.getByTestId("series-toggle-all").click();
  const ministryCsv = await downloadCsv();
  const ministry2004Rows = ministryCsv.split("\n").filter((row) => row.startsWith("2004,"));
  expect(ministry2004Rows).not.toHaveLength(0);
  expect(ministry2004Rows).toContainEqual(expect.stringContaining("admin_spending.defence"));
  expect(ministry2004Rows).toContainEqual(expect.stringContaining(",admin_category,"));
  expect(ministry2004Rows.join("\n")).toContain(",172009000,actual,");
  expect(ministry2004Rows.join("\n")).not.toContain(",major_program,");
  expect(ministry2004Rows.join("\n")).toContain("2004-annual-execution-annex.pdf");

  await page.goto("http://localhost:3100/explorer/revenue");
  await expectAppReady(page);
  await expect(page.getByTestId("year-range-strip")).toContainText("2004–2025");

  expect(consoleProblems).toEqual([]);
});

test("range strip supports chips and dragging handles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/explorer/expenditure");
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
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  await page.getByTestId("chart-mode-table").click();
  await page.getByTestId("measure-share-toggle").click();
  await expect(page).toHaveURL(/#.*m=table/);
  await expect(page).toHaveURL(/sh=1/);

  await page.goto("http://localhost:3100/explorer/revenue#m=table&sh=1&r=2010-2020&sel=revenue.total,revenue.vat");
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2020");
  await expect(page.getByTestId("series-selector").getByTitle("მთლიანი შემოსავლები")).toHaveAttribute("aria-pressed", "true");
});

test("national URL restores an explicitly empty selection as empty", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure#m=line&sel=");
  await expectAppReady(page);
  await page.reload();
  await expectAppReady(page);

  const panel = page.getByTestId("series-selector");
  await expect(panel.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
});

test("national URL falls back to the applicable total when every selected id is unknown", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/revenue#m=line&sel=revenue.made_up");
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

  await page.goto(`http://localhost:3100/explorer/expenditure#m=line&sel=${ids.join(",")}`);
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByTestId("series-overflow-callout")).toHaveCount(0);
  await expect(page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']")).toHaveCount(ids.length);
});

test("period comparison keeps every revenue category when the selected series change", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/revenue");
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
  await expect(page.getByTestId("explorer-table").locator("tbody tr").first()).toContainText("%");
  await expect(comparison.locator("tbody tr")).toHaveCount(comparisonRowCount);
  await expect(comparison.locator("tbody tr").first()).toContainText("მთლიანი შემოსავლები");
});

test("ministries period comparison keeps every top-level ministry and excludes major programs", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
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
  await page.goto("http://localhost:3100/explorer/expenditure");
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

test("CSV download uses the active filtered table data", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const socialProtectionButton = page.getByTestId("series-selector").getByTitle("სოციალური დაცვა");
  await socialProtectionButton.click();
  await expect(socialProtectionButton).toHaveAttribute("aria-pressed", "true");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("series-csv").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Expected a local CSV download path");

  const { readFile } = await import("node:fs/promises");
  const csvBytes = await readFile(path);
  const csv = csvBytes.toString("utf8");

  expect(download.suggestedFilename()).toContain("geodata-fields-");
  expect(Array.from(csvBytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  const csvWithoutBom = csv.slice(1);
  expect(csvWithoutBom.split("\n")[0]).toBe(
    "year,category_id,parent_item_id,level,detail_label,official_institution_label,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at,gdp_current_prices_gel,gdp_accounting_standard,gdp_status,gdp_source_name,gdp_source_url_or_file,gdp_last_reviewed_at,share_of_gdp",
  );
  expect(csv).toContain("spending.");
  expect(csv).toContain("expenditure.total");
  expect(csv).toContain("actual");
  expect(csv).toContain("sna_2008");
  expect(csv).toContain("Geostat GDP at current prices, SNA 2008");
});

test("analysis view renders the fixed single-year section order", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100/explorer/analysis");
  await expectAppReady(page);

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ბიუჯეტის სურათი");

  await expect(page.getByTestId("analysis-year-selector")).toContainText("2025");
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("snapshot-structure-grid")).toBeVisible();
  expect(await page.getByTestId("snapshot-structure-card").count()).toBeGreaterThan(5);

  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();

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
  await expect(page.getByTestId("analysis-grouping-fields")).toHaveCount(0);

  // Ministries grouping in analysis (categories only).
  await page.getByTestId("analysis-side-expenditure").click();
  await page.getByTestId("analysis-grouping-ministries").click();
  await expect(page.getByTestId("snapshot-treemap")).toContainText("სტრუქტურა უწყებების მიხედვით");

  expect(consoleProblems).toEqual([]);
});

test("mobile explorer and analysis layouts have no page overflow", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  await expect(page.getByTestId("explorer-header")).toBeVisible();
  await expect(page.getByTestId("chart-frame")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto("http://localhost:3100/explorer/analysis");
  await expectAppReady(page);

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expectNoPageOverflow(page);

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("http://localhost:3100/explorer/analysis");
    await expectAppReady(page);

    const selector = page.getByTestId("analysis-year-selector");
    const yearButtons = selector.locator("button");
    const activeYear = selector.locator("button[aria-pressed='true']");

    const metrics = await selector.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

    const boxes = await yearButtons.evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      }),
    );
    expect(boxes.every((box) => box.width >= 36)).toBe(true);
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index]!.left).toBeGreaterThanOrEqual(boxes[index - 1]!.right);
    }

    const activeBox = await activeYear.boundingBox();
    const selectorBox = await selector.boundingBox();
    expect(activeBox).not.toBeNull();
    expect(selectorBox).not.toBeNull();
    expect(activeBox!.x).toBeGreaterThanOrEqual(selectorBox!.x);
    expect(activeBox!.x + activeBox!.width).toBeLessThanOrEqual(selectorBox!.x + selectorBox!.width);

    const tabGroups = page.getByTestId("analysis-tab-groups");
    expect(await tabGroups.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const snapshot = page.getByTestId("single-year-snapshot");
    expect(await snapshot.evaluate((element) => getComputedStyle(element).overflowX)).not.toBe("clip");

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

test("mobile chart and table explain their contained horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const chart = page.getByTestId("chart-frame");
  await expect(page.getByTestId("chart-scroll-hint")).toBeVisible();
  await expect(chart).toHaveAttribute("tabindex", "0");
  await expect(chart).toHaveAttribute("aria-label", "მრავალწლიანი გრაფიკი — ჰორიზონტალურად გადაადგილებადი");
  expect(await chart.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  await expect(page.getByTestId("table-scroll-hint")).toBeVisible();
  await expect(table).toHaveAttribute("tabindex", "0");
  await expect(table).toHaveAttribute("aria-label", "მრავალწლიანი ცხრილი — ჰორიზონტალურად გადაადგილებადი");
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  await expectNoPageOverflow(page);
});

test("mobile chart accepts a horizontal touch drag", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const chart = page.getByTestId("chart-frame");
  expect(await chart.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await chart.evaluate((element) => element.scrollLeft)).toBe(0);

  const box = await chart.boundingBox();
  expect(box).not.toBeNull();

  const cdp = await page.context().newCDPSession(page);
  const y = box!.y + Math.min(100, box!.height / 2);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box!.x + box!.width - 32, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box!.x + 32, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await expect.poll(() => chart.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test("captures editorial desktop and mobile screenshots", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);
  await expectLineChartRendered(page);
  await page.screenshot({ path: "test-results/geodata-editorial-desktop.png", fullPage: true, caret: "initial" });

  await page.goto("http://localhost:3100/explorer/analysis");
  await expectAppReady(page);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await page.screenshot({ path: "test-results/geodata-editorial-analysis.png", fullPage: true, caret: "initial" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);
  await page.screenshot({ path: "test-results/geodata-editorial-mobile.png", fullPage: true, caret: "initial" });
});

test("every side KPI carries a sparkline", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
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
  await page.goto("http://localhost:3100/explorer/expenditure");
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

  const PAD_L = 74;
  const PAD_T = 16;
  expect(geometry.patternX + geometry.circleCx).toBeCloseTo(PAD_L, 5);
  expect(geometry.patternY + geometry.circleCy).toBeCloseTo(PAD_T, 5);
  expect(geometry.circleCx).toBeCloseTo(geometry.patternWidth / 2, 5);
  expect(geometry.circleCy).toBeCloseTo(geometry.patternHeight / 2, 5);

  // A single-year range gives the lattice no interval to divide, so it drops out
  // entirely and the hairline rules have to come back — without them the axis
  // labels sit against blank paper with nothing to read a value against.
  await page.getByRole("button", { name: "1წ", exact: true }).click();
  await expect(chart.getByTestId("chart-dot-lattice")).toHaveCount(0);

  const singleYearStrokes = await chart.locator("svg line").evaluateAll((lines) =>
    lines.map((line) => line.getAttribute("stroke")),
  );
  expect(singleYearStrokes).toContain("#E7DECF");
});

test("sidebar collapses to a rail and remembers the choice", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100/explorer/expenditure");
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

  await page.goto("http://localhost:3100/explorer/expenditure");
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

test("hub lists four cards, all four now live", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100/explorer");
  await expectAppReady(page);

  await expect(page.getByTestId("hub-card")).toHaveCount(4);
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
  // with every dataset update, the "<year> · <n.nn> მლრდ ₾" contract does not.
  await expect(page.getByTestId("hub-card").first()).toContainText(/\d{4} · [\d,]+\.\d{2} მლრდ ₾/);
  // Card 03 now carries the same contract — this is the figure this task adds.
  await expect(municipalities).toContainText(/\d{4} · [\d,]+\.\d{2} მლრდ ₾/);
  await expect(municipalities).toContainText("2025 · 6.11 მლრდ ₾");

  // The card is not just styled as a link — clicking it actually lands on the
  // municipalities index.
  await municipalities.click();
  await expect(page).toHaveURL(/\/explorer\/municipalities$/);
  await expect(page.getByTestId("municipality-map")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});

test("legacy nav hashes redirect to their route", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100/explorer#nav=analysis&ay=2024");
  await expect(page).toHaveURL(/\/explorer\/analysis/);
  await expect(page).toHaveURL(/ay=2024/);
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();

  await page.goto("http://localhost:3100/explorer#nav=revenue&m=table");
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByTestId("explorer-table")).toBeVisible();

  expect(consoleProblems).toEqual([]);
});
