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

async function expectTreemapLabelsContained(page: Page) {
  const overflowingLabels = await page.getByTestId("snapshot-treemap").locator("svg").evaluate((svg) => {
    const root = svg as SVGSVGElement;
    const viewBox = root.viewBox.baseVal;
    const maxX = viewBox.x + viewBox.width;
    const maxY = viewBox.y + viewBox.height;

    return Array.from(svg.querySelectorAll("text")).filter((label) => {
      const box = label.getBBox();
      return box.x < viewBox.x || box.y < viewBox.y || box.x + box.width > maxX || box.y + box.height > maxY;
    }).length;
  });

  expect(overflowingLabels).toBe(0);
}

async function expectExplorerReady(page: Page) {
  await expect(page.getByTestId("explorer-shell")).toBeVisible();
  await expect(page.getByTestId("explorer-controls")).toBeVisible();
  await expect(page.getByTestId("series-selector")).toBeVisible();
}

async function selectChartMode(page: Page, mode: "line" | "bar" | "stacked" | "table") {
  await expect(async () => {
    await page.getByTestId(`chart-mode-${mode}`).click();
    await expect(page.getByTestId(`chart-mode-${mode}`)).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
  }).toPass();
}

async function expectCsvDownload(page: Page, action: () => Promise<void>) {
  const download = await Promise.all([page.waitForEvent("download"), action()]).then(([file]) => file);
  const filename = download.suggestedFilename();
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Expected CSV download stream");

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return {
    filename,
    text: Buffer.concat(chunks).toString("utf8"),
  };
}

for (const host of previewHosts) {
  test(`main explorer hydrates, renders chart, and responds on ${host}`, async ({ page }) => {
    const consoleProblems = collectConsoleProblems(page);

    await page.goto(`http://${host}:3100`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
    await expectLineChartRendered(page);
    await expect(page.getByTestId("explorer-shell")).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toBeVisible();
    await expect(page.getByTestId("explorer-controls")).toBeVisible();
    await expect(page.getByTestId("active-total-card")).toBeVisible();
    await expect(page.getByTestId("source-label")).toBeVisible();
    await expect(page.getByTestId("series-selector")).toBeVisible();
    await expectNoPageOverflow(page);
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    await expect(page.locator("aside")).toContainText("ხარჯები სულ");

    await page.getByTestId("side-revenue").click();

    await expect(page.locator("aside")).toContainText("დამატებული ღირებულების გადასახადი");
    await expect(page.locator(".recharts-wrapper")).toBeVisible();
    await expect(page.locator('path.recharts-line-curve[stroke-dasharray="5 5"]')).toHaveCount(0);
    expect(consoleProblems).toEqual([]);
  });
}

test("stacked composition mode renders real expenditure bars", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expect(async () => {
    await page.getByRole("button", { name: "კომპოზიცია" }).click();
    await expect(page.getByLabel("საზომი")).toHaveValue("share_of_total", { timeout: 500 });
  }).toPass();

  const stackedChart = page.getByTestId("stacked-composition-chart");
  await expect(stackedChart).toBeVisible();
  await expect(stackedChart).toHaveAttribute("data-chart-mode", "stacked");
  await expect(stackedChart).toHaveAttribute("data-measure", "share_of_total");
  expect(Number(await stackedChart.getAttribute("data-series-count"))).toBeGreaterThan(1);
  await expect(stackedChart.locator(".recharts-bar-rectangle, .recharts-bar .recharts-rectangle, .recharts-bar rect")).not.toHaveCount(0);
  await expect(page.getByText("კომპოზიცია აჩვენებს არჩეული კატეგორიების წილს მთლიანში; არაარჩეული კატეგორიები გრაფიკში არ ჯამდება.")).toBeVisible();
  await expect(page.getByText("კომპოზიციისთვის აირჩიე ცალკეული კატეგორიები, არა ჯამის სერია.")).toHaveCount(0);
  await expect(page.getByLabel("საზომი")).toBeVisible();
  await expect(page.getByLabel("საზომი")).toHaveValue("share_of_total");

  expect(consoleProblems).toEqual([]);
});

test("single-year snapshot renders sections and revenue data", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expect(page.locator("aside")).toBeVisible();
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await expect(page.getByTestId("explorer-shell")).toBeVisible();

  await page.getByTestId("view-single_year").click();

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("spending-petals")).toBeVisible();
  await expect(page.getByTestId("budget-field")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();

  const yearSelect = page.locator("select");
  const earliestYear = await yearSelect.locator("option").first().getAttribute("value");
  if (!earliestYear) throw new Error("Expected at least one single-year option");
  await yearSelect.selectOption(earliestYear);

  await page.getByTestId("side-revenue").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toContainText("დამატებული ღირებულების გადასახადი");

  expect(consoleProblems).toEqual([]);
});

test("final mobile explorer layout has no page overflow", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("http://localhost:3100");

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
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await page.getByTestId("view-single_year").click();

  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expect(page.getByTestId("snapshot-treemap")).toBeVisible();
  await expect(page.getByTestId("every-100-gel")).toBeVisible();
  await expect(page.getByTestId("spending-petals")).toBeVisible();
  await expect(page.getByTestId("budget-field-scroll")).toBeVisible();
  await expect(page.getByTestId("single-year-ranking")).toBeVisible();
  await expectElementNoHorizontalOverflow(page, "every-100-grid");
  await expectTreemapLabelsContained(page);
  await expectNoPageOverflow(page);
  expect(consoleProblems).toEqual([]);
});

test("table mode allows selecting more than the chart series limit", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectExplorerReady(page);
  await selectChartMode(page, "table");
  await expect(page.getByTestId("explorer-table")).toBeVisible();

  const checkboxes = page.getByTestId("series-selector").locator('input[type="checkbox"]:not(:checked)');
  const count = await checkboxes.count();
  expect(count).toBeGreaterThanOrEqual(8);

  for (let index = 0; index < 8; index += 1) {
    await checkboxes.first().click();
  }

  await expect(page.getByTestId("series-limit-message")).toHaveCount(0);
  await expect(page.getByTestId("selected-series-count")).toContainText("9");
  expect(consoleProblems).toEqual([]);
});

test("share of GDP shows a clear unavailable state instead of a chart", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectExplorerReady(page);
  await expect(async () => {
    await page.getByTestId("measure-select").selectOption("share_of_gdp");
    await expect(page.getByTestId("measure-select")).toHaveValue("share_of_gdp", { timeout: 500 });
    await expect(page.getByTestId("unavailable-state")).toBeVisible({ timeout: 500 });
  }).toPass();

  await expect(page.getByTestId("unavailable-state")).toBeVisible();
  await expect(page.getByTestId("chart-frame")).toHaveCount(0);
  await expect(page.getByTestId("source-label")).toBeVisible();
  expect(consoleProblems).toEqual([]);
});

test("CSV download uses the active side, years, and metadata columns", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectExplorerReady(page);
  await expect(async () => {
    await page.getByTestId("side-revenue").click();
    await expect(page.getByTestId("side-revenue")).toHaveAttribute("aria-pressed", "true", { timeout: 500 });
    await expect(page.getByTestId("selected-series-count")).toContainText("1", { timeout: 500 });
  }).toPass();

  const result = await expectCsvDownload(page, async () => {
    await page.getByTestId("csv-download").click();
  });

  expect(result.filename).toBe("geodata-budget-revenue-2023-2025.csv");
  expect(result.text.split("\n")[0]).toBe(
    "year,category_id,ka_label,en_label,amount_gel,basis,source_name,source_url_or_file,last_reviewed_at",
  );
  expect(result.text).toContain("revenue.vat");
  expect(result.text).toContain("actual");
  expect(consoleProblems).toEqual([]);
});

test("series selector search shows a no-results state", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectExplorerReady(page);
  await expect(async () => {
    await page.getByTestId("series-search").clear();
    await page.getByTestId("series-search").fill("no-such-budget-series-999");
    await expect(page.getByTestId("series-no-results")).toBeVisible({ timeout: 500 });
  }).toPass();

  await expect(page.getByTestId("series-no-results")).toBeVisible();
  expect(consoleProblems).toEqual([]);
});

test("expenditure and revenue remember separate selections in line mode", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expectExplorerReady(page);
  await expect(page.getByTestId("selected-series-count")).toContainText("1");

  await expect(async () => {
    const selectedCount = await page.getByTestId("selected-series-count").textContent();

    if (!selectedCount?.includes("2")) {
      await page.getByTestId("series-selector").locator('input[type="checkbox"]:not(:checked)').first().click();
    }

    await expect(page.getByTestId("selected-series-count")).toContainText("2", { timeout: 500 });
  }).toPass();

  await expect(async () => {
    await page.getByTestId("side-revenue").click();
    await expect(page.getByTestId("selected-series-count")).toContainText("1", { timeout: 500 });
  }).toPass();

  await expect(async () => {
    await page.getByTestId("side-expenditure").click();
    await expect(page.getByTestId("selected-series-count")).toContainText("2", { timeout: 500 });
  }).toPass();
  expect(consoleProblems).toEqual([]);
});

test("captures final v1 desktop and mobile smoke screenshots", async ({ page }) => {
  const consoleProblems = collectConsoleProblems(page);

  await page.goto("http://localhost:3100");
  await expect(page.getByTestId("explorer-shell")).toBeVisible();
  await expectLineChartRendered(page);
  await page.screenshot({ path: "test-results/geodata-v1-final-desktop.png", fullPage: true, caret: "initial" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3100");
  await expect(page.locator(".recharts-wrapper")).toBeVisible();
  await page.getByTestId("view-single_year").click();
  await expect(page.getByTestId("single-year-snapshot")).toBeVisible();
  await expectElementNoHorizontalOverflow(page, "every-100-grid");
  await expectTreemapLabelsContained(page);
  await page.screenshot({ path: "test-results/geodata-v1-final-mobile.png", fullPage: true, caret: "initial" });

  expect(consoleProblems).toEqual([]);
});
