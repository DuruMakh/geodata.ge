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

async function expectLineChartRendered(page: Page) {
  const line = page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']").first();

  await expect(line).toBeVisible();

  const box = await line.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(2);
  expect(box?.height ?? 0).toBeGreaterThan(2);
}

test("explorer hydrates with the editorial shell and default expenditure view", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  await expect(page.getByTestId("explorer-shell")).toBeVisible();
  await expect(page.getByTestId("explorer-header")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ იხარჯება საქართველოს ბიუჯეტი");

  // Editorial paper background, no cards.
  const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(paper).toBe("rgb(247, 242, 233)");

  // Three-tab nav.
  await expect(page.getByTestId("nav-expenditure")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("nav-revenue")).toBeVisible();
  await expect(page.getByTestId("nav-analysis")).toBeVisible();

  // Default: line mode, top-5 selection, chart drawn on paper.
  await expectLineChartRendered(page);
  await expect(page.getByTestId("series-selector")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toContainText("სერიები");
  await expect(page.getByTestId("series-selector")).toContainText("5 / 6");
  await expect(page.getByTestId("source-label")).toContainText("გადამოწმებული ოფიციალური საბიუჯეტო დოკუმენტები");
  await expect(page.getByTestId("source-label")).toContainText("2005–2025");

  // Indicators below the chart.
  await expect(page.getByTestId("period-indicators")).toBeVisible();
  await expect(page.getByTestId("period-kpi-cards")).toContainText("პერიოდის ცვლილება");
  await expect(page.getByTestId("period-movers")).toContainText("ყველაზე მზარდი");
  await expect(page.getByTestId("period-comparison")).toContainText("პერიოდის შედარება");

  await expectNoPageOverflow(page);
  expect(consoleProblems).toEqual([]);
});

test("explorer controls expose line, table, grouping, and the share pill", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  const chartPanel = page.getByTestId("chart-panel");
  await expect(chartPanel.getByTestId("chart-mode-line")).toHaveAttribute("aria-pressed", "true");
  await expect(chartPanel.getByTestId("chart-mode-table")).toBeVisible();
  await expect(chartPanel.getByTestId("grouping-fields")).toHaveAttribute("aria-pressed", "true");
  await expect(chartPanel.getByTestId("grouping-ministries")).toBeVisible();
  await expect(chartPanel.getByTestId("measure-share-toggle")).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toContainText("დიაპაზონი");

  await chartPanel.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await expect(page.getByTestId("explorer-table")).toContainText("სულ");
  await expect(page.getByTestId("explorer-table")).toContainText("ცვლილება");

  await chartPanel.getByTestId("chart-mode-line").click();
  await expect(page.getByTestId("chart-frame")).toBeVisible();

  await chartPanel.getByTestId("measure-share-toggle").click();
  await expect(chartPanel).toHaveAttribute("data-measure", "share_of_total");
  await expect(chartPanel.getByTestId("measure-share-toggle")).toHaveAttribute("aria-pressed", "true");

  expect(consoleProblems).toEqual([]);
});

test("revenue nav reuses the identical system without a grouping switch", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  await page.getByTestId("nav-revenue").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("grouping-fields")).toHaveCount(0);
  await expect(page.getByTestId("series-selector")).toContainText("დამატებული ღირებულების გადასახადი");
  await expect(page.getByTestId("source-label")).toContainText("შემოსავლების მონაცემები: 2005–2025");
  await expectLineChartRendered(page);

  expect(consoleProblems).toEqual([]);
});

test("ministries grouping expands nested programs by name only", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
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

test("range strip supports chips and dragging handles", async ({ page }) => {
  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  const strip = page.getByTestId("year-range-strip");
  await expect(strip).toContainText("2005–2025");
  await expect(strip).toContainText("10წ");

  const startHandle = strip.getByTestId("range-start-handle");
  await startHandle.scrollIntoViewIfNeeded();
  const startBox = await startHandle.boundingBox();
  const railBox = await strip.locator("[role='group']").boundingBox();
  if (!startBox || !railBox) throw new Error("Expected draggable range elements to be measurable");

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(railBox.x + railBox.width / 2, startBox.y + startBox.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(strip).toContainText("2015–2025");

  await strip.getByRole("button", { name: "ყველა" }).click();
  await expect(strip).toContainText("2005–2025");
});

test("URL hash round-trips explorer state", async ({ page }) => {
  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  await page.getByTestId("chart-mode-table").click();
  await page.getByTestId("measure-share-toggle").click();
  await expect(page).toHaveURL(/#.*m=table/);
  await expect(page).toHaveURL(/sh=1/);

  await page.goto("http://localhost:3100/#nav=revenue&m=table&sh=1&r=2010-2020&sel=revenue.vat");
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2020");
  await expect(page.getByTestId("series-selector")).toContainText("1");
});

test("CSV download uses the active filtered table data", async ({ page }) => {
  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /CSV/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Expected a local CSV download path");

  const { readFile } = await import("node:fs/promises");
  const csv = await readFile(path, "utf8");

  expect(download.suggestedFilename()).toContain("geodata-fields-");
  expect(csv.split("\n")[0]).toBe(
    "year,category_id,parent_item_id,level,detail_label,official_institution_label,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
  );
  expect(csv).toContain("spending.");
  expect(csv).toContain("actual");
});

test("analysis view renders the fixed single-year section order", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  await page.getByTestId("nav-analysis").click();
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

  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  await expect(page.getByTestId("explorer-header")).toBeVisible();
  await expect(page.getByTestId("chart-frame")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toBeVisible();
  await expectNoPageOverflow(page);

  await page.getByTestId("nav-analysis").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expectNoPageOverflow(page);

  expect(consoleProblems).toEqual([]);
});

test("captures editorial desktop and mobile screenshots", async ({ page }) => {
  await page.goto("http://localhost:3100");
  await expectAppReady(page);
  await expectLineChartRendered(page);
  await page.screenshot({ path: "test-results/geodata-editorial-desktop.png", fullPage: true, caret: "initial" });

  await page.getByTestId("nav-analysis").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await page.screenshot({ path: "test-results/geodata-editorial-analysis.png", fullPage: true, caret: "initial" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100");
  await expectAppReady(page);
  await page.screenshot({ path: "test-results/geodata-editorial-mobile.png", fullPage: true, caret: "initial" });
});
