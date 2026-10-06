import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

// Two frames and a short timer flush the effects that follow a render, so a URL write made on load would have happened by now.
const settled = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 100)))),
  );

for (const [locale, prefix, heading, coverage] of [
  ["ka", "", "მოსახლეობა", "2004–2026 · 1 იანვრის მდგომარეობით"],
  ["en", "/en", "Population", "2004–2026 · as of 1 January"],
] as const) {
  test(`${locale}: the Population page opens on Georgia with the map, chart, list and highlights`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography/population`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toContainText(coverage);
    await expect(page.locator("[data-region-map-target]")).toHaveCount(11);
    await expect(page.getByTestId("population-georgia-pill")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chart-break")).toHaveCount(1);
    await expect(page.getByTestId("series-row")).toHaveCount(12);
    await expect(page.getByTestId("population-highlights")).toContainText("3,941,103");
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(0);
    await expect(page.getByTestId("population-excel-download")).toBeEnabled();
  });

  test(`${locale}: the hub lists four pages and links the live one`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography`);
    await expect(page.getByTestId("demography-hub").getByTestId("hub-card")).toHaveCount(4);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveCount(1);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveAttribute("href", `${prefix}/explorer/demography/population`);
    await expect(page.getByTestId("demography-link")).toHaveAttribute("aria-current", "page");
  });
}

test("choosing a region replaces the selection, ticking adds a line and the Georgia pill resets", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.locator('[data-region-id="region.imereti"]').click();
  await expect(page).toHaveURL(/sel=region\.imereti(&|$)/);
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(1);
  await expect(page.getByTestId("population-highlights")).toContainText("Imereti");
  await expect(page.getByTestId("population-georgia-pill")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("series-row").filter({ hasText: "Kakheti" }).getByTestId("series-row-toggle").click();
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(2);
  await page.getByTestId("population-mode-table").click();
  await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(2);

  await page.getByTestId("population-georgia-pill").click();
  await expect(page.getByTestId("population-georgia-pill")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(0);
});

test("a region is a keyboard button", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.locator('[data-region-id="region.adjara"]').focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/sel=region\.adjara(&|$)/);
});

test("municipalities: density is disabled with a reason, a municipality can be chosen and Tbilisi is one place", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("population-measure-density").click();
  await expect(page.getByTestId("population-measure-density")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("regional-map-legend")).toContainText("persons per km²");
  await expect(page.getByTestId("population-map-block")).toContainText("504.24");

  await page.getByTestId("population-level-municipalities").click();
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await expect(page.getByTestId("population-measure-density")).toBeDisabled();
  await expect(page.getByTestId("population-density-note")).toBeVisible();
  await expect(page).toHaveURL(/level=municipalities/);
  await expect(page).toHaveURL(/map=population/);

  await page.getByTestId("municipality-shape-11").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("population-highlights")).toContainText("Khulo");
  await expect(page.getByTestId("municipality-chosen-11")).toHaveCount(1);

  await page.getByTestId("municipality-marker-04").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/sel=region\.tbilisi(&|$)/);
  await page.getByTestId("population-mode-table").click();
  await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(1);
  await page.getByTestId("population-level-regions").click();
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(1);
});

test("the census re-base is a gap in the chart and a rule in the table", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await expect(page.getByTestId("chart-break")).toContainText("Census re-base");
  await page.getByTestId("population-mode-table").click();
  const header = page.getByTestId("explorer-table").locator("thead th", { hasText: "2025" });
  await expect(header).toContainText("Census re-base");
  expect(await header.evaluate((cell) => getComputedStyle(cell).borderLeftWidth)).toBe("2px");
  await expect(page.getByTestId("population-census-note")).toContainText("re-based the population to the 2024 census");
});

test("the Excel download has three sheets and numeric population", async ({ page }, testInfo) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  const pending = page.waitForEvent("download");
  await page.getByTestId("population-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("fiscal-demography-population-2004-2026-en.xlsx");
  const file = testInfo.outputPath("population.xlsx");
  await download.saveAs(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(book.getWorksheet("Data")!.getCell("A2").value).toBe("Georgia");
  expect(book.getWorksheet("Data")!.getCell("D2").value).toBe(3_937_716);
});

test("the sidebar shows the demography group with the page current", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/demography/population");
  await ready(page);
  await expect(page.getByTestId("demography-population-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("data-sidebar").getByText("მალე", { exact: true })).toHaveCount(1);
});

// The maps are the budget and regional-economy maps with population wording: no budget or GDP text may leak through.
test("en: the map wording is about people at both levels and both measures", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  const block = page.getByTestId("population-map-block");
  await expect(page.getByTestId("regional-map-legend")).toContainText(/persons, 1 January \d{4}/);
  await expect(block).not.toContainText("Regional GDP");
  await expect(block).not.toContainText(/per resident/i);

  await page.getByTestId("population-measure-density").click();
  await expect(page.getByTestId("regional-map-legend")).toContainText(/persons per km², 1 January \d{4}/);
  await expect(block).not.toContainText("Regional GDP");

  await page.getByTestId("population-level-municipalities").click();
  await expect(page.getByTestId("municipality-map-legend")).toContainText(/persons, 1 January \d{4}/);
  await expect(block).not.toContainText("Regional GDP");
  await expect(block).not.toContainText(/per resident/i);
});

test("ka: the map wording is about people at both levels", async ({ page }) => {
  await page.goto("/explorer/demography/population");
  await ready(page);
  const block = page.getByTestId("population-map-block");
  await expect(page.getByTestId("regional-map-legend")).toContainText("1 იანვარი");
  await expect(block).not.toContainText("მშპ");

  await page.getByTestId("population-level-municipalities").click();
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await expect(page.getByTestId("municipality-map-legend")).toContainText("1 იანვარი");
  await expect(block).not.toContainText("ერთ მოსახლეზე");
  await expect(block).not.toContainText("მშპ");
});

// URL state: loading never writes the URL (DESIGN.md section 6.3); only a later change does, and it replaces the entry.
test("loading a clean URL leaves it clean", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await settled(page);
  expect(new URL(page.url()).hash).toBe("");
});

test("a shared link restores the view and the URL stays exactly as shared", async ({ page }) => {
  const hash = "#sel=region.imereti&level=regions&map=population&view=table";
  await page.goto(`/en/explorer/demography/population${hash}`);
  await ready(page);
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(1);
  await expect(page.getByTestId("population-mode-table")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table").locator("tbody tr")).toHaveCount(1);
  await expect(page.getByTestId("population-highlights")).toContainText("Imereti");
  await settled(page);
  expect(new URL(page.url()).hash).toBe(hash);
});

test("a reload after one click restores the clicked place", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.locator('[data-region-id="region.imereti"]').click();
  await expect(page).toHaveURL(/sel=region\.imereti(&|$)/);
  await page.reload();
  await ready(page);
  await expect(page.getByTestId("regional-map-chosen")).toHaveCount(1);
  await expect(page.getByTestId("population-highlights")).toContainText("Imereti");
  await expect(page.getByTestId("population-georgia-pill")).toHaveAttribute("aria-pressed", "false");
});

// The keyboard tests above prove Enter; these prove the pointer does the same, and that the hover text is about people.
test("a region's tooltip shows its population and no budget amount", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.locator('[data-region-id="region.imereti"]').hover();
  const tooltip = page.getByTestId("regional-map-tooltip");
  await expect(tooltip).toContainText("Imereti");
  await expect(tooltip).toContainText("492,505");
  await expect(tooltip).not.toContainText(/₾|GEL|GDP/);
});

test("a mouse click chooses a municipality and its tooltip shows population, not a budget per resident", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("population-level-municipalities").click();
  const khulo = page.getByTestId("municipality-shape-11");
  await khulo.hover();
  const tooltip = page.getByTestId("municipality-map-tooltip");
  await expect(tooltip).toContainText("Khulo");
  await expect(tooltip).toContainText("16,098");
  await expect(tooltip).not.toContainText(/per resident|₾|GEL/i);

  await khulo.click();
  await expect(page.getByTestId("population-highlights")).toContainText("Khulo");
  await expect(page.getByTestId("municipality-chosen-11")).toHaveCount(1);
  await expect(page).toHaveURL(/sel=11(&|$)/);
});

for (const width of [390, 768, 900, 1100, 1440]) {
  test(`the hub and the Population page have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/explorer/demography", "/explorer/demography/population", "/en/explorer/demography/population"]) {
      await page.goto(path);
      if (path.endsWith("/population")) await ready(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} at ${width}px`).toBe(true);
    }
  });
}
