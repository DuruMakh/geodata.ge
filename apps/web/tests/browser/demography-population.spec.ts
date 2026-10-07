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
  test(`${locale}: the index opens on the municipalities with the map, four key figures and no button row`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography/population`);
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByTestId("explorer-header")).toContainText(coverage);
    await expect(page.getByTestId("municipality-map")).toBeVisible();
    await expect(page.getByTestId("index-kpi")).toHaveCount(4);
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);
    await expect(page.locator('[data-testid^="population-level-"], [data-testid^="population-measure-"], [data-testid="population-georgia-pill"]')).toHaveCount(0);
    await expect(page.getByTestId("breadcrumb-json-ld")).toHaveCount(1);
    await expect(page.getByTestId("explorer-dataset-json-ld")).toHaveCount(0);
  });

  test(`${locale}: the hub lists four pages and links the live one`, async ({ page }) => {
    await page.goto(`${prefix}/explorer/demography`);
    await expect(page.getByTestId("demography-hub").getByTestId("hub-card")).toHaveCount(4);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveCount(1);
    await expect(page.getByTestId("demography-hub").locator("a")).toHaveAttribute("href", `${prefix}/explorer/demography/population`);
    await expect(page.getByTestId("demography-link")).toHaveAttribute("aria-current", "page");
  });
}

test("clicking a municipality on the map opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipality-shape-11").click();
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population\/khulo$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Khulo");
  await expect(page.getByTestId("explorer-header")).toContainText("Adjara");
  await expect(page.getByTestId("population-highlights")).toContainText("16,098");
});

test("a list row opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipal-list-row").filter({ hasText: "Batumi" }).click();
  await expect(page).toHaveURL(/\/population\/batumi$/);
  await expect(page.getByTestId("population-highlights")).toContainText("246,267");
});

test("the Regions tab lists Georgia and the 11 regions, with density, and a region row opens its page", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("level-region").click();
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
  await expect(page.getByTestId("municipal-list-region")).toContainText("2,715.7/km²");
  await expect(page.getByTestId("municipality-map")).toBeVisible();
  await page.getByTestId("municipal-list-row").filter({ hasText: "Imereti" }).click();
  await expect(page).toHaveURL(/\/population\/region\/imereti$/);
  await expect(page.getByTestId("series-row")).toHaveCount(13);
  await expect(page.getByTestId("region-member-row")).toHaveCount(12);
});

test("Georgia's page ticks the 11 regions and has no previous or next", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/georgia");
  await ready(page);
  await expect(page.getByTestId("series-row")).toHaveCount(12);
  await expect(page.getByTestId("municipal-entity-navigation")).toHaveCount(0);
  await expect(page.getByTestId("population-highlights")).toContainText("3,941,103");
});

test("Tbilisi opens one page from the map's city dot and from the lists", async ({ page }) => {
  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipality-marker-04").click();
  await expect(page).toHaveURL(/\/population\/region\/tbilisi$/);
  await expect(page.getByTestId("series-row")).toHaveCount(1);

  await page.goto("/en/explorer/demography/population");
  await ready(page);
  await page.getByTestId("municipal-list-row").first().click();
  await expect(page).toHaveURL(/\/population\/region\/tbilisi$/);
  await expect(page.getByTestId("region-member-row")).toHaveCount(0);
});

test("on a place page the picker, previous/next and the way back work", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/batumi");
  await ready(page);
  await expect(page.getByTestId("municipal-entity-navigation")).toBeVisible();
  await page.getByTestId("entity-picker-trigger").click();
  await page.getByTestId("picker-municipality").filter({ hasText: "Khulo" }).click();
  await expect(page).toHaveURL(/\/population\/khulo$/);
  await page.getByTestId("municipal-entity-navigation").getByRole("link").last().click();
  await expect(page).not.toHaveURL(/khulo$/);
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population\/[a-z_-]+$/);
  await page.getByTestId("population-back-link").click();
  await expect(page).toHaveURL(/\/en\/explorer\/demography\/population$/);
});

test("ticking a part adds a line, puts it in the address and survives a reload", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/region/adjara");
  await ready(page);
  await expect(page.getByTestId("series-row")).toHaveCount(7);
  await page.getByTestId("series-row").filter({ hasText: "Batumi" }).getByTestId("series-row-toggle").click();
  await expect(page).toHaveURL(/sel=region\.adjara(,|%2C)06/);
  await page.getByTestId("population-mode-table").click();
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
  await expect(page.getByTestId("explorer-table")).toContainText("Adjara");
  await page.reload();
  await ready(page);
  await expect(page.getByTestId("population-mode-table")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
});

test("the census re-base is a gap in the chart and a rule in the table", async ({ page }) => {
  await page.goto("/en/explorer/demography/population/georgia");
  await ready(page);
  await expect(page.getByTestId("chart-break")).toContainText("Census re-base");
  await page.getByTestId("population-mode-table").click();
  const header = page.getByTestId("explorer-table").locator("thead th", { hasText: "2025" });
  await expect(header).toContainText("Census re-base");
  expect(await header.evaluate((cell) => getComputedStyle(cell).borderLeftWidth)).toBe("2px");
  await expect(page.getByTestId("population-census-note")).toContainText("re-based the population to the 2024 census");
});

test("the Excel download of a place page has three sheets and numeric population", async ({ page }, testInfo) => {
  await page.goto("/en/explorer/demography/population/batumi");
  await ready(page);
  const pending = page.waitForEvent("download");
  await page.getByTestId("population-excel-download").click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("fiscal-demography-population-batumi-2015-2026-en.xlsx");
  const file = testInfo.outputPath("population.xlsx");
  await download.saveAs(file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  expect(book.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Sources"]);
  expect(book.getWorksheet("Data")!.getCell("A2").value).toBe("Batumi");
  expect(book.getWorksheet("Data")!.getCell("D2").value).toBe(155_163);
});

test("the sidebar keeps Population current on a place page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/demography/population/batumi");
  await ready(page);
  await expect(page.getByTestId("demography-population-link")).toHaveAttribute("aria-current", "page");
});

test("English pages have no Georgian text on the index or on a place page", async ({ page }) => {
  for (const path of ["/en/explorer/demography/population", "/en/explorer/demography/population/region/adjara", "/en/explorer/demography/population/batumi"]) {
    await page.goto(path);
    await ready(page);
    expect(await page.locator("main").innerText(), path).not.toMatch(/[Ⴀ-ჿ]/);
  }
});

// URL state: loading never writes the URL (DESIGN.md section 6.3; pristine-urls.spec.ts covers a clean load); only a later change does.
test("a shared link restores a place page's view and the address stays exactly as shared", async ({ page }) => {
  const hash = "#m=table&r=2018-2024&sel=region.adjara%2C06";
  await page.goto(`/en/explorer/demography/population/region/adjara${hash}`);
  await ready(page);
  await expect(page.getByTestId("population-mode-table")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("explorer-table")).toContainText("Batumi");
  await settled(page);
  expect(new URL(page.url()).hash).toBe(hash);
});

test("a shared link restores the index's Regions tab and the address stays as shared", async ({ page }) => {
  await page.goto("/en/explorer/demography/population#lvl=region");
  await ready(page);
  await expect(page.getByTestId("municipal-list-row")).toHaveCount(12);
  await settled(page);
  expect(new URL(page.url()).hash).toBe("#lvl=region");
});

for (const width of [320, 390, 768, 900, 1100, 1440]) {
  test(`the hub, the index and the place pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/explorer/demography",
      "/explorer/demography/population",
      "/en/explorer/demography/population",
      "/en/explorer/demography/population/georgia",
      "/explorer/demography/population/region/adjara",
      "/en/explorer/demography/population/batumi",
    ]) {
      await page.goto(path);
      if (path.endsWith("/population") || path.includes("/population/")) await ready(page);
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} at ${width}px`).toBe(true);
    }
  });
}
