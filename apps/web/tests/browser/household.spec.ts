import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

test("the living standards hub lists Income, Spending, Poverty and Inequality in that order", async ({ page }) => {
  await page.goto("/en/explorer/living-standards");
  const hub = page.getByTestId("living-standards-hub");
  const links = hub.locator("a");
  await expect(links).toHaveCount(4);
  expect(await links.evaluateAll(elements => elements.map(element => element.getAttribute("href")))).toEqual(["income", "spending", "poverty", "inequality"].map(page => `/en/explorer/living-standards/${page}`));
  for (const [index, title] of ["Income", "Spending", "Poverty", "Inequality"].entries()) {
    await expect(links.nth(index)).toContainText(`0${index + 1}`);
    await expect(links.nth(index)).toContainText(title);
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Living standards");
});

const row = (page: Page, id: string) => page.locator(`[data-testid="regional-list-row"][data-region-id="${id}"]`);

test("income is one view: the map and list pick the area, Georgia first, and towns and villages are tickable lines", async ({ page }) => {
  await page.goto("/explorer/living-standards/income");
  await ready(page);
  await expect(page.getByTestId("household-latest")).toContainText("2,025.8");
  // No tabs and no area buttons on the chart.
  await expect(page.getByTestId("household-tabs")).toHaveCount(0);
  await expect(page.locator('[data-testid^="household-tab-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="household-area-"]')).toHaveCount(0);
  await expect(page.getByTestId("household-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toContainText("2,025.8");
  await expect(rows.first()).toHaveAttribute("aria-current", "true");
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "georgia");
  // One source line, carrying the map's boundaries credit.
  await expect(page.getByTestId("regional-source-note")).toHaveCount(0);
  await expect(page.getByTestId("source-label")).toContainText("2002–2025");
  await expect(page.getByTestId("source-label")).toContainText("geoBoundaries");
  // Towns and villages follow the parts, unticked; only the total is selected.
  await expect(page.getByTestId("series-status")).toContainText("1 / 4");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  for (const id of ["settlement.urban", "settlement.rural"]) await expect(page.locator(pressed(id))).toHaveAttribute("aria-pressed", "false");
  const lines = page.getByTestId("chart-frame").locator("svg path[stroke-linejoin='round']");
  await expect(lines).toHaveCount(1);
  await page.locator(pressed("settlement.urban")).click();
  await expect(page.locator(pressed("settlement.urban"))).toHaveAttribute("aria-pressed", "true");
  await expect(lines).toHaveCount(2);
  await expect(page).toHaveURL(/sel=income\.total(,|%2C)settlement\.urban/);
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("chart-panel").getByRole("row").filter({ hasText: "ქალაქი" })).toHaveCount(1);
  await expect(page.getByTestId("year-range-strip")).toContainText("2002–2025");
});

test("the list and the map set the area, which keeps the measure and the ticks the area has, and Georgia returns", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/income#per=household&sel=income.total,settlement.rural");
  await ready(page);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows.first()).toHaveText(/Georgia/);
  await expect(row(page, "region.tbilisi")).toContainText("2,317.5");
  // The measure icons switch the map and list values.
  await expect(page.getByTestId("household-measure-per_household")).toHaveAccessibleName("Per household");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAccessibleName("Per person");
  await expect(page.getByTestId("household-measure-per_household").locator("svg")).toHaveClass(/lucide-house-heart/);
  await page.getByTestId("household-measure-per_capita").click();
  await expect(page.getByTestId("household-regions")).toHaveAttribute("data-measure", "per_capita");
  await expect(row(page, "region.tbilisi")).toContainText("745.4");
  await expect(rows.first()).toContainText("630.7");
  await expect(page.getByTestId("regional-map-legend")).toContainText("₾ a month per person");
  // A list row.
  await row(page, "region.guria").click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income#area=region\.guria&per=person/);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "region.guria");
  await expect(page.getByTestId("chart-panel")).toBeFocused();
  await expect(row(page, "region.guria")).toHaveAttribute("aria-current", "true");
  await expect(rows.first()).not.toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("settlement.rural"))).toHaveCount(0);
  await expect(page.getByTestId("series-status")).toContainText("1 / 2");
  // A region on the map.
  await page.getByTestId("household-region-map").locator('a[data-region-id="region.kakheti"]').click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "region.kakheti");
  await expect(page.getByTestId("chart-panel")).toBeFocused();
  await expect(row(page, "region.kakheti")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2011–2025");
  // Georgia returns, with its towns and villages lines unticked.
  await rows.first().click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "georgia");
  await expect(rows.first()).toHaveAttribute("aria-current", "true");
  await expect(page).not.toHaveURL(/area=/);
  await expect(page.getByTestId("year-range-strip")).toContainText("2002–2025");
  await expect(page.locator(pressed("settlement.rural"))).toHaveAttribute("aria-pressed", "false");
});

test("the Georgian spending list opens a region in Georgian", async ({ page }) => {
  await page.goto("/explorer/living-standards/spending");
  await ready(page);
  await expect(page.getByTestId("household-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  await row(page, "region.guria").click();
  await expect(page).toHaveURL(/\/explorer\/living-standards\/spending#area=region\.guria&per=household/);
  expect(new URL(page.url()).pathname).toBe("/explorer/living-standards/spending");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "region.guria");
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
});

test("spending reads consumption spending and exports Excel with the ticked towns line", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/spending#sel=spending.consumption,settlement.urban");
  await ready(page);
  await expect(page.getByTestId("household-latest")).toContainText("1,438.7");
  await expect(page.locator(pressed("settlement.urban"))).toHaveAttribute("aria-pressed", "true");
  const promise = page.waitForEvent("download"); await page.getByTestId("household-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe("fiscal-household-spending-georgia-per_household-2002-2025-en.xlsx");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  const data = workbook.getWorksheet("Data")!;
  expect(data.rowCount).toBe(49);
  expect(data.getColumn(2).values).toContain("Towns");
});

test("the language switch keeps area, per person and selection", async ({ page }) => {
  await page.goto("/explorer/living-standards/income#area=region.adjara&per=person&view=table&sel=income.total,income.remittances");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income#/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "region.adjara");
  await expect(row(page, "region.adjara")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("income.remittances"))).toHaveAttribute("aria-pressed", "true");
  // A second hop for Georgia with the villages line ticked.
  await page.goto("/explorer/living-standards/income#per=person&sel=income.total,settlement.rural");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income#/);
  await ready(page);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "georgia");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("settlement.rural"))).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/sel=income\.total(,|%2C)settlement\.rural/);
});

test("the sidebar lists Living standards after Wages, with its four pages and the current one active", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/spending");
  await ready(page);
  const entry = page.getByTestId("living-standards-link");
  await expect(entry).toHaveText("Living standards");
  expect(await page.getByTestId("wages-link").evaluate((wages, living) => Boolean(wages.compareDocumentPosition(living!) & Node.DOCUMENT_POSITION_FOLLOWING), await entry.elementHandle())).toBe(true);
  for (const id of ["income", "spending", "rates", "inequality"]) await expect(page.getByTestId(`living-standards-${id}-link`)).toBeVisible();
  await expect(page.getByTestId("living-standards-spending-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("living-standards-income-link")).not.toHaveAttribute("aria-current", "page");
});

for (const prefix of ["", "/en"]) test(`household pages fit a 390px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["/explorer/living-standards", "/explorer/living-standards/income", "/explorer/living-standards/spending#sel=spending.consumption,settlement.urban,settlement.rural", "/explorer/living-standards/income#area=region.racha_lechkhumi_kvemo_svaneti"]) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/living-standards") await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("an old poverty bookmark lands on the new address with its tab", async ({ page }) => {
  // Redirects come from next.config and next dev serves them too (the municipality redirect specs run there); this one is skipped on the default local dev webServer and runs against a served build (PLAYWRIGHT_BASE_URL) or in CI.
  test.skip(!process.env.PLAYWRIGHT_BASE_URL && !process.env.CI, "redirects are checked against a served build");
  await page.goto("/en/explorer/poverty/rates#tab=relative");
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/poverty#tab=relative/);
  await ready(page);
  await expect(page.getByTestId("poverty-tab-relative")).toHaveAttribute("aria-pressed", "true");
});
