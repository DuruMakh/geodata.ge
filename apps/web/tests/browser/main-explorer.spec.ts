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

  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const chartPanel = page.getByTestId("chart-panel");
  const seriesPanel = page.getByTestId("series-selector");
  await expect(chartPanel.getByTestId("chart-mode-line")).toHaveAttribute("aria-pressed", "true");
  await expect(chartPanel.getByTestId("chart-mode-table")).toBeVisible();
  // The grouping switch lives in the series panel, not in the chart controls row.
  await expect(seriesPanel.getByTestId("grouping-fields")).toHaveAttribute("aria-pressed", "true");
  await expect(seriesPanel.getByTestId("grouping-ministries")).toBeVisible();
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

  await page.goto("http://localhost:3100/explorer/revenue");
  await expectAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("grouping-fields")).toHaveCount(0);
  await expect(page.getByTestId("series-selector")).toContainText("დამატებული ღირებულების გადასახადი");
  await expect(page.getByTestId("source-label")).toContainText("შემოსავლების მონაცემები: 2005–2025");
  await expectLineChartRendered(page);

  expect(consoleProblems).toEqual([]);
});

test("sidebar section links move between sections in-app", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const sidebar = page.getByTestId("data-sidebar");
  await expect(sidebar.getByTestId("section-link-expenditure")).toHaveAttribute("aria-current", "page");

  // Fill the line-mode series budget, then overflow it: the callout that appears
  // is component state, and it must not follow the user into another section.
  // Two clicks assume the documented top-5 default, so pin it — otherwise a
  // changed default would fail below with an unrelated-looking message.
  await expect(page.getByTestId("series-selector")).toContainText("5 / 6");
  const unselected = page.getByTestId("series-selector").locator('button[title][aria-pressed="false"]');
  await unselected.first().click();
  await unselected.first().click();
  await expect(page.getByTestId("series-limit-callout")).toBeVisible();

  await sidebar.getByTestId("section-link-revenue").click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("series-selector")).toContainText("დამატებული ღირებულების გადასახადი");
  await expect(page.getByTestId("series-limit-callout")).toHaveCount(0);
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

  // მუნიციპალიტეტები is listed but unbuilt: a marker, never a link.
  await expect(sidebar.getByRole("link", { name: "მუნიციპალიტეტები" })).toHaveCount(0);
  await expect(sidebar).toContainText("მუნიციპალიტეტები");

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

test("range strip supports chips and dragging handles", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  const strip = page.getByTestId("year-range-strip");
  await expect(strip).toContainText("2005–2025");
  await expect(strip).toContainText("10წ");

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
  await expect(strip).toContainText("2005–2025");
});

test("URL hash round-trips explorer state", async ({ page }) => {
  await page.goto("http://localhost:3100/explorer/expenditure");
  await expectAppReady(page);

  await page.getByTestId("chart-mode-table").click();
  await page.getByTestId("measure-share-toggle").click();
  await expect(page).toHaveURL(/#.*m=table/);
  await expect(page).toHaveURL(/sh=1/);

  await page.goto("http://localhost:3100/explorer/revenue#m=table&sh=1&r=2010-2020&sel=revenue.vat");
  await page.reload();
  await expectAppReady(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ივსება საქართველოს ბიუჯეტი");
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2020");
  await expect(page.getByTestId("series-selector")).toContainText("1");
});

test("line mode caps over-limit shared selections with a callout", async ({ page }) => {
  const sel = [
    "spending.social_protection",
    "spending.health",
    "spending.education",
    "spending.defence",
    "spending.public_order_safety",
    "spending.economic_affairs",
    "spending.culture",
    "spending.sport",
  ].join(",");

  await page.goto(`http://localhost:3100/explorer/expenditure#m=line&sel=${sel}`);
  await page.reload();
  await expectAppReady(page);

  // The full selection is kept (table mode can show it), but the line chart
  // draws only the first 6 series and says so.
  await expect(page.getByTestId("series-overflow-callout")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toContainText("8 / 6");
  expect(await page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']").count()).toBe(6);
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

  expect(consoleProblems).toEqual([]);
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

  expect(consoleProblems).toEqual([]);
});
