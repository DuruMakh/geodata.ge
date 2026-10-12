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

test("income is one view: the map and list of regions, Georgia first and this page, and towns and villages are tickable lines", async ({ page }) => {
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
  await expect(rows.first()).toHaveAttribute("href", /^\/explorer\/living-standards\/income#/);
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  // Each region is a plain link to its own page.
  await expect(row(page, "region.guria")).toHaveAttribute("href", "/explorer/living-standards/income/regions/guria");
  await expect(page.getByTestId("household-region-map").locator('a[data-region-id="region.guria"]')).toHaveAttribute("href", "/explorer/living-standards/income/regions/guria");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "georgia");
  await expect(page.getByTestId("household-chosen-area")).toHaveText("საქართველო");
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
  // The Georgia row is this page: following it keeps the view.
  await rows.first().click();
  await expect(page).toHaveURL(/\/explorer\/living-standards\/income#.*sel=income\.total(,|%2C)settlement\.urban/);
  await expect(page.locator(pressed("settlement.urban"))).toHaveAttribute("aria-pressed", "true");
});

test("a list row opens the region's own page: its heading, latest value, years and lines, with no map", async ({ page }) => {
  await page.goto("/explorer/living-standards/income");
  await ready(page);
  await row(page, "region.guria").click();
  await expect(page).toHaveURL(/\/explorer\/living-standards\/income\/regions\/guria$/);
  await ready(page);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("შემოსავლები —");
  await expect(heading.getByTestId("region-picker-trigger")).toHaveText("გურია");
  await expect(page.getByTestId("household-latest")).toContainText("· გურია");
  await expect(page.getByTestId("household-region-map")).toHaveCount(0);
  await expect(page.getByTestId("regional-list-row")).toHaveCount(0);
  await expect(page.getByTestId("household-chosen-area")).toHaveCount(0);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "region.guria");
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
  await expect(page.locator(pressed("income.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(pressed("settlement.urban"))).toHaveCount(0);
  await expect(page.getByTestId("source-label")).toContainText("2019–2025");
  await expect(page.getByTestId("source-label")).not.toContainText("geoBoundaries");
  await expect(page.getByTestId("household-excel-download")).toBeEnabled();
  // Breadcrumb: Living standards / Income / Guria; the sidebar keeps Income active.
  const crumbs = page.getByTestId("explorer-header").getByRole("navigation", { name: "Breadcrumb" }).first();
  await expect(crumbs.getByRole("link", { name: "შემოსავლები" })).toHaveAttribute("href", "/explorer/living-standards/income");
  await expect(crumbs.locator("[aria-current=page]")).toHaveText("გურია");
  await expect(page.getByTestId("living-standards-income-link")).toHaveAttribute("aria-current", "page");
});

test("a map region carries per person to its page, and the picker and previous/next links move between regions", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/income");
  await ready(page);
  // The measure icons switch the map and list values, and the region links carry the choice.
  await expect(page.getByTestId("household-measure-per_household")).toHaveAccessibleName("Per household");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAccessibleName("Per person");
  await expect(page.getByTestId("household-measure-per_household").locator("svg")).toHaveAttribute("data-icon", "family-restroom");
  await page.getByTestId("household-measure-per_capita").click();
  await expect(page.getByTestId("household-regions")).toHaveAttribute("data-measure", "per_capita");
  await expect(row(page, "region.tbilisi")).toContainText("745.4");
  await expect(row(page, "region.kakheti")).toHaveAttribute("href", "/en/explorer/living-standards/income/regions/kakheti#per=person");
  await page.getByTestId("household-region-map").locator('a[data-region-id="region.kakheti"]').click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/kakheti#per=person/);
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Income —");
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Kakheti");
  await expect(page.getByTestId("household-measure-per_capita")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2011–2025");
  // The picker opens the list and goes to another region.
  await page.getByTestId("region-picker-trigger").click();
  await expect(page.getByTestId("region-picker-option")).toHaveCount(11);
  await expect(page.getByTestId("region-picker-all-option")).toHaveAttribute("href", "/en/explorer/living-standards/income#per=person");
  await page.getByTestId("region-picker-option").filter({ hasText: "Guria" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/guria#per=person/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
  await expect(page.getByTestId("household-latest")).toContainText("· Guria");
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
  // Previous and next follow the regions' order.
  const navigation = page.getByTestId("household-region-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← Adjara", "Imereti →"]);
  await navigation.getByRole("link", { name: "Imereti →" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/imereti/);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Imereti");
  await page.getByTestId("household-region-navigation").getByRole("link", { name: "← Guria" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/guria/);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
});

test("the Georgian spending list opens a region page in Georgian", async ({ page }) => {
  await page.goto("/explorer/living-standards/spending");
  await ready(page);
  await expect(page.getByTestId("household-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  await row(page, "region.guria").click();
  await expect(page).toHaveURL(/\/explorer\/living-standards\/spending\/regions\/guria$/);
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ხარჯები —");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-area", "region.guria");
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
  await expect(page.getByTestId("living-standards-spending-link")).toHaveAttribute("aria-current", "page");
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

test("the language switch keeps the region page and its hash, and Georgia's view on a section page", async ({ page }) => {
  await page.goto("/explorer/living-standards/income/regions/adjara#per=person&view=table&sel=income.total,income.remittances");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/living-standards\/income\/regions\/adjara#/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Adjara");
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

test("the per household icon shows in both the plain and the pressed button", async ({ page }) => {
  await page.goto("/en/explorer/living-standards/income");
  await ready(page);
  const button = page.getByTestId("household-measure-per_household");
  const icon = button.locator("svg");
  const user = page.getByTestId("household-measure-per_capita").locator("svg");
  expect(await icon.boundingBox().then(box => [box!.width, box!.height])).toEqual(await user.boundingBox().then(box => [box!.width, box!.height]));
  const colours = () => button.evaluate(element => [getComputedStyle(element.querySelector("svg")!).fill, getComputedStyle(element).backgroundColor, getComputedStyle(element.closest("[role=group]")!.parentElement!).backgroundColor]);
  for (const state of ["pressed", "plain"]) {
    if (state === "plain") await page.getByTestId("household-measure-per_capita").click();
    await expect(button).toHaveAttribute("aria-pressed", state === "pressed" ? "true" : "false");
    const [fill, background] = await colours();
    expect(fill, state).toMatch(/^rgb/);
    expect(fill, state).not.toBe(background);
    expect(fill, state).not.toBe("rgba(0, 0, 0, 0)");
  }
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
  // Spending stays active on its region pages.
  await page.goto("/en/explorer/living-standards/spending/regions/kakheti");
  await ready(page);
  await expect(page.getByTestId("living-standards-spending-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("living-standards-income-link")).not.toHaveAttribute("aria-current", "page");
});

for (const prefix of ["", "/en"]) test(`household pages fit a 390px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["/explorer/living-standards", "/explorer/living-standards/income", "/explorer/living-standards/spending#sel=spending.consumption,settlement.urban,settlement.rural", "/explorer/living-standards/income/regions/racha_lechkhumi_kvemo_svaneti", "/explorer/living-standards/spending/regions/samegrelo_zemo_svaneti#per=person"]) {
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
