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

test("income defaults to total income per household, and area and per person keep the ticked lines", async ({ page }) => {
  await page.goto("/explorer/living-standards/income");
  await ready(page);
  await expect(page.getByTestId("household-latest")).toContainText("2,025.8");
  await expect(page.getByTestId("household-tab-parts")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-status")).toContainText("1 / 2");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2002–2025");
  await expect(page.getByTestId("source-label")).toContainText("2002–2025");
  await expect(page.getByTestId("household-area-georgia")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("household-area-settlement.rural").click();
  await expect(page.getByTestId("household-area-settlement.rural")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2006–2025");
  await page.locator('[data-series-id="income.total"] [aria-expanded]').click();
  await page.locator(pressed("income.wages")).click();
  await page.getByTestId("household-measure-per_capita").click();
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("income.wages"))).toHaveAttribute("aria-pressed", "true");
  // The headline stays Georgia per household whatever is chosen below.
  await expect(page.getByTestId("household-latest")).toContainText("2,025.8");
  await expect(page).toHaveURL(/area=settlement\.rural/);
  await expect(page).toHaveURL(/per=person/);
});

test("the Regions tab maps the eleven regions, and a region opens the first tab for it", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/income#tab=areas&per=household");
  await ready(page);
  await expect(page.getByTestId("household-tab-areas")).toHaveText("Regions");
  await expect(page.getByTestId("household-tab-areas")).toHaveAttribute("aria-pressed", "true");
  const map = page.getByTestId("household-region-map");
  await expect(map.getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(11);
  await expect(rows.first()).toHaveAttribute("data-region-id", "region.tbilisi");
  await expect(rows.first()).toContainText("2,317.5");
  // No at-a-glance block, no Chart | Table, no area switch, and the map's source note is the only source line.
  await expect(page.getByText("Regional overview")).toHaveCount(0);
  await expect(page.getByTestId("chart-mode-line")).toHaveCount(0);
  await expect(page.getByTestId("household-area-georgia")).toHaveCount(0);
  await expect(page.getByTestId("source-label")).toHaveCount(0);
  await expect(page.getByTestId("regional-source-note")).toContainText("Household Incomes and Expenditures Survey · ₾ a month per household · 2025");
  await expect(page.getByTestId("household-latest")).toContainText("2,025.8");
  // The workbook holds Georgia and the eleven regions for the map's year.
  const promise = page.waitForEvent("download"); await page.getByTestId("household-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe("fiscal-household-income-areas-all-per_household-2025-2025-en.xlsx");
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.getWorksheet("Data")!.rowCount).toBe(13);
  // The measure switch is an icon pair named by its full labels.
  await expect(page.getByTestId("household-measure-per_household")).toHaveAccessibleName("Per household");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAccessibleName("Per person");
  await expect(page.getByTestId("household-measure-per_capita").locator("svg")).toHaveCount(1);
  await page.getByTestId("household-measure-per_capita").click();
  await expect(rows.first()).toContainText("745.4");
  await expect(page.getByTestId("regional-source-note")).toContainText("₾ a month per person · 2025");
  await page.locator('[data-testid="regional-list-row"][data-region-id="region.guria"]').click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income#tab=parts&area=region\.guria&per=person/);
  await expect(page.getByTestId("household-tab-parts")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("household-area-region.guria")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("household-area-region.guria")).toHaveText("Guria");
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  // Back to the map, then a region on the map itself.
  await page.getByTestId("household-all-regions").click();
  await expect(page.getByTestId("household-tab-areas")).toHaveAttribute("aria-pressed", "true");
  await map.locator('a[data-region-id="region.kakheti"]').click();
  await expect(page.getByTestId("household-area-region.kakheti")).toHaveAttribute("aria-pressed", "true");
  // Choosing Georgia drops the region option.
  await page.getByTestId("household-area-georgia").click();
  await expect(page.getByTestId("household-area-region.kakheti")).toHaveCount(0);
  await expect(page.getByTestId("household-all-regions")).toHaveCount(0);
});

test("the Georgian Regions tab opens a region in Georgian", async ({ page }) => {
  await page.goto("/explorer/living-standards/spending#tab=areas&per=household");
  await ready(page);
  await expect(page.getByTestId("household-tab-areas")).toHaveText("რეგიონები");
  await expect(page.getByTestId("household-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  await page.locator('[data-testid="regional-list-row"][data-region-id="region.guria"]').click();
  await expect(page).toHaveURL(/\/explorer\/living-standards\/spending#tab=parts&area=region\.guria&per=household/);
  expect(new URL(page.url()).pathname).toBe("/explorer/living-standards/spending");
  await expect(page.getByTestId("household-area-region.guria")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
});

test("spending reads consumption spending and exports Excel", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/spending");
  await ready(page);
  await expect(page.getByTestId("household-latest")).toContainText("1,438.7");
  await expect(page.getByTestId("household-tab-parts")).toHaveText("What it’s spent on");
  const promise = page.waitForEvent("download"); await page.getByTestId("household-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
});

test("the language switch keeps tab, area, per person and selection", async ({ page }) => {
  await page.goto("/explorer/living-standards/income#tab=parts&area=region.adjara&per=person&view=table&sel=income.total,income.remittances");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income#/);
  await ready(page);
  await expect(page.getByTestId("household-area-region.adjara")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("income.remittances"))).toHaveAttribute("aria-pressed", "true");
  // A second hop on the Regions tab: the tab itself must survive the switch.
  await page.goto("/explorer/living-standards/income#tab=areas&per=person&sel=georgia,region.tbilisi");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income#/);
  await ready(page);
  await expect(page.getByTestId("household-tab-areas")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("household-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  await expect(page).toHaveURL(/sel=georgia(,|%2C)region\.tbilisi/);
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
  for (const path of ["/explorer/living-standards", "/explorer/living-standards/income", "/explorer/living-standards/spending#tab=areas", "/explorer/living-standards/income#tab=parts&area=region.racha_lechkhumi_kvemo_svaneti"]) {
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
