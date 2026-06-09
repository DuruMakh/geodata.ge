import { expect, test, type Page } from "@playwright/test";

const previewHosts = ["localhost", "127.0.0.1"];

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

async function expectElementNoHorizontalOverflow(page: Page, testId: string) {
  const overflow = await page.getByTestId(testId).evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

async function expectLineChartRendered(page: Page) {
  const line = page.locator(".recharts-line-curve").first();

  await expect(line).toBeVisible();

  const box = await line.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(2);
  expect(box?.height ?? 0).toBeGreaterThan(2);
}

async function expectStructureTextContained(page: Page) {
  const overflowingLabels = await page.getByTestId("snapshot-structure-grid").locator("svg").evaluate((svg) => {
    const root = svg as SVGSVGElement;
    const viewBox = root.viewBox.baseVal;
    const maxX = viewBox.x + viewBox.width;
    const maxY = viewBox.y + viewBox.height;

    return Array.from(root.querySelectorAll("text")).filter((label) => {
      const box = label.getBBox();
      return box.x < viewBox.x || box.y < viewBox.y || box.x + box.width > maxX || box.y + box.height > maxY;
    }).length;
  });

  expect(overflowingLabels).toBe(0);
}

for (const host of previewHosts) {
  test(`main explorer hydrates, renders chart, and responds on ${host}`, async ({ page }) => {
    const consoleProblems = collectConsoleProblems(page);

    await page.goto(`http://${host}:3100`);
    await expectAppReady(page);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
    await expectLineChartRendered(page);
    await expect(page.getByTestId("explorer-shell")).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toBeVisible();
    await expect(page.getByTestId("explorer-controls")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("\u10ee\u10d0\u10e0\u10ef\u10d4\u10d1\u10d8\u10e1 \u10d3\u10d8\u10dc\u10d0\u10db\u10d8\u10d9\u10d0");
    await expect(page.getByText("GeoData.ge / Budget Explorer")).toHaveCount(0);
    await expect(page.getByTestId("active-total-card")).toHaveCount(0);
    await expect(page.getByTestId("source-label")).toBeVisible();
    await expect(page.getByTestId("series-selector")).toBeVisible();
    await expectNoPageOverflow(page);
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    const mainLayout = await page.evaluate(() => {
      const h1 = document.querySelector("h1")?.getBoundingClientRect();
      const selector = document.querySelector('[data-testid="series-selector"]')?.getBoundingClientRect();
      const plot = document.querySelector('[data-testid="chart-plot"]')?.getBoundingClientRect();
      const toolbar = document.querySelector('[data-testid="chart-toolbar"]')?.getBoundingClientRect();
      const line = document.querySelector(".recharts-line-curve");
      const gridLines = document.querySelectorAll(".recharts-cartesian-grid line").length;
      const svgText = Array.from(document.querySelectorAll(".recharts-wrapper svg text"));
      const expenditureYearLabels = ["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"];
      const yAxisTicks = svgText.filter((node) => !expenditureYearLabels.includes(node.textContent ?? ""));
      const yAxisText = yAxisTicks.map((node) => node.textContent ?? "");
      const x2017Tick = svgText.find((node) => node.textContent === "2017");
      const xAxisYears = svgText.map((node) => node.textContent ?? "").filter((text) => expenditureYearLabels.includes(text));

      return {
        gridLines,
        hasMillionTicks: yAxisText.some((text) => text.includes("M GEL")),
        yAxisLeft: yAxisTicks[0]?.getBoundingClientRect().left ?? 0,
        x2017Left: x2017Tick?.getBoundingClientRect().left ?? 0,
        xAxisYears,
        plotTop: plot?.top ?? 0,
        selectorTop: selector?.top ?? 0,
        strokeWidth: Number(line?.getAttribute("stroke-width") ?? 0),
        titleTop: h1?.top ?? 0,
        toolbarTop: toolbar?.top ?? 0,
        yAxisText,
      };
    });
    expect(Math.abs(mainLayout.selectorTop - mainLayout.titleTop)).toBeLessThanOrEqual(8);
    expect(mainLayout.toolbarTop).toBeGreaterThanOrEqual(mainLayout.plotTop);
    expect(mainLayout.strokeWidth).toBeGreaterThanOrEqual(3);
    expect(mainLayout.gridLines).toBe(0);
    expect(mainLayout.hasMillionTicks).toBe(false);
    expect(mainLayout.yAxisText).toEqual(["0", "10", "20", "30"]);
    expect(mainLayout.xAxisYears).toEqual(["2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"]);
    expect(mainLayout.x2017Left - mainLayout.yAxisLeft).toBeGreaterThanOrEqual(70);
    await expect(page.locator("aside")).toContainText("ხარჯები სულ");

    await page.getByTestId("side-revenue").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("\u10e8\u10d4\u10db\u10dd\u10e1\u10d0\u10d5\u10da\u10d4\u10d1\u10d8\u10e1 \u10d3\u10d8\u10dc\u10d0\u10db\u10d8\u10d9\u10d0");

    await expect(page.locator("aside")).toContainText("დამატებული ღირებულების გადასახადი");
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    expect(consoleProblems).toEqual([]);
  });
}

test("multi-year production controls expose only line table and share toggle", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  const chartPanel = page.getByTestId("chart-panel");
  await expect(chartPanel.getByTestId("chart-plot")).toBeVisible();
  await expect(chartPanel.getByTestId("chart-mode-line")).toBeVisible();
  await expect(chartPanel.getByTestId("chart-mode-table")).toBeVisible();
  await expect(chartPanel.getByTestId("measure-share-toggle")).toBeVisible();
  await expect(chartPanel.getByTestId("chart-legend")).toBeVisible();
  await expect(chartPanel.getByTestId("year-range-strip")).toBeVisible();
  await expect(page.getByTestId("period-kpi-cards")).toBeVisible();
  await expect(page.getByTestId("period-movers")).toBeVisible();
  await expect(page.getByTestId("period-start-end")).toBeVisible();
  await expect(page.getByTestId("formula-analysis")).toBeVisible();
  const formulaRowCount = await page.getByTestId("formula-analysis").evaluate((element) => element.children.length);
  expect(formulaRowCount).toBe(14);
  const periodOrder = await page.evaluate(() => {
    const kpis = document.querySelector('[data-testid="period-kpi-cards"]')?.getBoundingClientRect();
    const movers = document.querySelector('[data-testid="period-movers"]')?.getBoundingClientRect();
    const startEnd = document.querySelector('[data-testid="period-start-end"]')?.getBoundingClientRect();

    return {
      kpisTop: kpis?.top ?? 0,
      moversTop: movers?.top ?? 0,
      startEndTop: startEnd?.top ?? 0,
    };
  });
  expect(periodOrder.kpisTop).toBeLessThan(periodOrder.moversTop);
  expect(periodOrder.moversTop).toBeLessThan(periodOrder.startEndTop);
  const moverHeights = await page.getByTestId("period-movers").evaluate((element) => {
    const gainers = Array.from(element.querySelectorAll('[data-tone="gain"]')).map((node) => node.getBoundingClientRect().height);
    const losers = Array.from(element.querySelectorAll('[data-tone="loss"]')).map((node) => node.getBoundingClientRect().height);

    return { gainers, losers };
  });
  expect(moverHeights.gainers[0]).toBeGreaterThan(moverHeights.gainers[1] ?? 0);
  expect(moverHeights.gainers[1]).toBeGreaterThan(moverHeights.gainers[2] ?? 0);
  expect(moverHeights.losers[0]).toBeLessThan(moverHeights.losers[1] ?? 0);
  expect(moverHeights.losers[1]).toBeLessThan(moverHeights.losers[2] ?? 0);
  const moverTextOverflow = await page.getByTestId("period-movers").evaluate((element) =>
    Array.from(element.querySelectorAll('[data-tone]')).filter((card) => card.scrollWidth > card.clientWidth + 2).length,
  );
  expect(moverTextOverflow).toBe(0);
  await expect(page.getByRole("button", { name: "\u10e1\u10d5\u10d4\u10e2\u10d4\u10d1\u10d8" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "\u10d9\u10dd\u10db\u10de\u10dd\u10d6\u10d8\u10ea\u10d8\u10d0" })).toHaveCount(0);
  await expect(page.getByLabel("\u10e1\u10d0\u10d6\u10dd\u10db\u10d8")).toHaveCount(0);

  await chartPanel.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toBeVisible();
  await chartPanel.getByTestId("chart-mode-line").click();
  await expect(page.getByTestId("chart-frame")).toBeVisible();
  await chartPanel.getByTestId("measure-share-toggle").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-measure", "share_of_total");

  expect(consoleProblems).toEqual([]);
});

test("year range strip supports dragging handles", async ({ page }) => {
  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  const strip = page.getByTestId("year-range-strip");
  await expect(strip).toContainText("Range: 2017 - 2025");

  const startHandle = strip.getByTestId("range-start-handle");
  await startHandle.scrollIntoViewIfNeeded();
  const startBox = await startHandle.boundingBox();
  const stripBox = await strip.boundingBox();
  if (!startBox || !stripBox) throw new Error("Expected draggable range elements to be measurable");

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(stripBox.x + stripBox.width / 2, startBox.y + startBox.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(strip).toContainText("Range: 2021 - 2025");
});

test("theme defaults to light and persists night mode without layout shift", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.addInitScript(() => localStorage.removeItem("geodata-theme"));
  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  const lightWidth = await page.getByTestId("screen-card").evaluate((element) => element.getBoundingClientRect().width);

  await page.getByTestId("theme-night").click();
  await expect(page.locator("body")).toHaveAttribute("data-theme", "night");
  const nightWidth = await page.getByTestId("screen-card").evaluate((element) => element.getBoundingClientRect().width);
  expect(Math.round(nightWidth)).toBe(Math.round(lightWidth));

  await page.reload();
  await expectAppReady(page);
  await expect(page.locator("body")).toHaveAttribute("data-theme", "night");

  expect(consoleProblems).toEqual([]);
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

  expect(download.suggestedFilename()).toContain("geodata-budget-expenditure-");
  expect(csv.split("\n")[0]).toBe("year,category_id,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at");
  expect(csv).toContain("expenditure.total");
  expect(csv).toContain("actual");
});

test("single-year snapshot renders sections and revenue data", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectAppReady(page);
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await expect(page.getByTestId("explorer-shell")).toBeVisible();

  await page.getByTestId("view-single_year").click();

  await expect(page.getByTestId("year-pills")).toBeVisible();
  await expect(page.locator("select")).toHaveCount(0);
  await expect(page.getByText("Single-year snapshot")).toHaveCount(0);
  await expect(page.getByText("Budget Radar")).toHaveCount(0);
  await expect(page.getByText("Budget Field")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Switch to multi-year view" })).toBeVisible();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("snapshot-structure-grid")).toBeVisible();
  await expect(page.getByTestId("snapshot-structure-card")).toHaveCount(13);
  const treemapAreas = await page.getByTestId("snapshot-structure-grid").evaluate((grid) => {
    return Array.from(grid.querySelectorAll("[data-testid='snapshot-structure-card']"))
      .slice(0, 4)
      .map((cell) => {
        const box = (cell as SVGGElement).getBBox();
        return Math.round(box.width * box.height);
      });
  });
  expect(treemapAreas[0]).toBeGreaterThan(treemapAreas[1] ?? 0);
  expect(treemapAreas[1]).toBeGreaterThan(treemapAreas[2] ?? 0);
  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  const every100Colors = await page.getByTestId("every-100-grid").locator("[data-cell='gel']").evaluateAll((cells) => {
    const unique = Array.from(new Set(cells.map((cell) => getComputedStyle(cell).backgroundColor)));
    const colorfulCells = cells.filter((cell) => {
      const match = getComputedStyle(cell).backgroundColor.match(/\d+/g);
      if (!match) return false;
      const [red, green, blue] = match.map(Number);
      return red !== green || green !== blue;
    });
    const grayCells = cells.filter((cell) => {
      const match = getComputedStyle(cell).backgroundColor.match(/\d+/g);
      if (!match) return false;
      const [red, green, blue] = match.map(Number);
      return Math.abs(red - green) <= 16 && Math.abs(green - blue) <= 16;
    });

    return { unique: unique.length, colorful: colorfulCells.length, gray: grayCells.length };
  });
  expect(every100Colors.unique).toBeGreaterThan(5);
  expect(every100Colors.colorful).toBeGreaterThan(50);
  expect(every100Colors.gray).toBeGreaterThan(0);
  await page.getByTestId("every-100-grid").locator("[data-cell='gel']").first().hover();
  await expect(page.getByTestId("every-100-tooltip").first()).toBeVisible();
  await expect(page.getByTestId("every-100-tooltip").first()).toContainText("\u10da\u10d0\u10e0\u10d8");
  await expect(page.getByTestId("every-100-gel").getByRole("list")).toHaveCount(0);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
  await expect(page.getByTestId("spending-petals")).toHaveCount(0);
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();

  await page.getByTestId("year-pills").getByRole("button").first().click();

  await page.getByTestId("side-revenue").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("year-pills")).not.toContainText("2017");
  await expect(page.getByTestId("single-year-ranking")).toContainText("დამატებული ღირებულების გადასახადი");

  expect(consoleProblems).toEqual([]);
});

test("final mobile explorer layout has no page overflow", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("http://localhost:3100");
  await expectAppReady(page);

  await expect(page.getByTestId("explorer-header")).toBeVisible();
  await expect(page.getByTestId("explorer-controls")).toBeVisible();
  await expect(page.getByTestId("chart-frame")).toBeVisible();
  await expect(page.getByTestId("source-label")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toBeVisible();
  await expectNoPageOverflow(page);
  expect(consoleProblems).toEqual([]);
});

test("final mobile single-year layout keeps fixed visuals contained", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("http://localhost:3100");
  await expectAppReady(page);
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await page.getByTestId("view-single_year").click();

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("snapshot-structure-grid")).toBeVisible();
  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("every-100-grid").locator("[data-cell='gel']")).toHaveCount(100);
  await expect(page.getByTestId("every-100-gel").getByRole("list")).toHaveCount(0);
  await expect(page.getByTestId("budget-radar")).toBeVisible();
  await expect(page.getByTestId("spending-petals")).toHaveCount(0);
  await expect(page.getByTestId("budget-field-scroll")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();
  await expectElementNoHorizontalOverflow(page, "every-100-grid");
  await expectStructureTextContained(page);
  await expectNoPageOverflow(page);
  expect(consoleProblems).toEqual([]);
});

test("captures final v1 desktop and mobile smoke screenshots", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectAppReady(page);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();
  await expectLineChartRendered(page);
  await page.screenshot({ path: "test-results/geodata-v1-final-desktop.png", fullPage: true, caret: "initial" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100");
  await expectAppReady(page);
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await page.getByTestId("view-single_year").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expectElementNoHorizontalOverflow(page, "every-100-grid");
  await expectStructureTextContained(page);
  await page.screenshot({ path: "test-results/geodata-v1-final-mobile.png", fullPage: true, caret: "initial" });

  expect(consoleProblems).toEqual([]);
});
