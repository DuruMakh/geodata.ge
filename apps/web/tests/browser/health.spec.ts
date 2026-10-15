import { expect, test, type Locator, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const toggle = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const caret = (id: string) => `[data-series-id="${id}"] [aria-expanded]`;
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const listRow = (page: Page, id: string) => page.locator(`[data-testid="regional-list-row"][data-region-id="${id}"]`);

/** The table cell of a row in a year's column. */
async function cell(table: Locator, rowLabel: string, year: number) {
  const headers = (await table.locator("thead th").allTextContents()).map(text => text.trim());
  const column = headers.findIndex(text => text.startsWith(String(year)));
  expect(column, `${year} column`).toBeGreaterThan(0);
  return table.locator("tbody tr", { hasText: rowLabel }).locator("th, td").nth(column);
}

/** Moves the range's start handle to `year` with the keyboard. */
async function startAt(page: Page, year: number) {
  const start = page.getByTestId("range-start-handle");
  for (let presses = 0; await start.getAttribute("aria-valuenow") !== String(year); presses++) {
    expect(presses, `the start handle should reach ${year} within 30 presses`).toBeLessThan(30);
    await start.press("ArrowRight");
  }
}

test("doctors and hospitals selects Doctors, marks both staff counting changes and drops them on a range without one (Review Focus 1)", async ({ page }) => {
  await page.goto("/en/explorer/health/doctors-hospitals");
  await ready(page);
  await expect(page.getByTestId("health-latest")).toHaveText("Doctors · 2025: 22,491");
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator(toggle("health.staff.doctors"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-status")).toContainText("1 / 2");
  await expect(page.locator('[data-testid^="health-tab"]')).toHaveCount(0);
  const breaks = page.getByTestId("chart-panel").getByTestId("chart-break");
  await expect(breaks).toHaveCount(2);
  for (const index of [0, 1]) await expect(breaks.nth(index)).toContainText("new counting");
  await expect(page.getByTestId("source-label")).toContainText("Source: Geostat, healthcare · persons · 2002–2025");
  await expect(page.getByTestId("source-label").getByRole("link")).toHaveAttribute("href", "/en/methodology/health");
  await startAt(page, 2021);
  await expect(page).toHaveURL(/start=2021/);
  await expect(page.getByTestId("year-range-strip")).toContainText("2021–2025");
  await expect(breaks).toHaveCount(0);
  // The table marks 2020 when the range holds the year before it.
  await page.goto("/en/explorer/health/doctors-hospitals#view=table&start=2018&end=2025&sel=health.staff.doctors");
  await ready(page);
  const header = page.getByTestId("explorer-table").locator("thead th", { hasText: "2020" });
  await expect(header).toContainText("new counting");
  expect(await header.evaluate(element => getComputedStyle(element).borderLeftWidth)).toBe("2px");
});

test("the measure switch is four named icons; Beds selects Hospital beds and states the latest beds", async ({ page }) => {
  await page.goto("/en/explorer/health/doctors-hospitals");
  await ready(page);
  for (const [view, name] of [["staff", "Staff"], ["hospitals", "Hospitals and clinics"], ["beds", "Beds"], ["visits", "Visits"]] as const) {
    await expect(page.getByTestId(`health-view-${view}`)).toHaveAccessibleName(name);
    await expect(page.getByTestId(`health-view-${view}`).locator("svg")).toHaveCount(1);
  }
  await expect(page.getByTestId("health-view-staff")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("health-view-beds").click();
  await expect(page.getByTestId("health-view-beds")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tab=beds/);
  await expect(page.locator(toggle("health.facilities.beds"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByTestId("health-latest")).toHaveText("Hospital beds · 2025: 15,232");
  await expect(page.getByTestId("health-unit-label")).toHaveText("beds");
  await expect(page.getByTestId("chart-break")).toHaveCount(0);
  // A saved link from another view falls back to that view's default (Review Focus 4).
  await page.goto("/en/explorer/health/doctors-hospitals#tab=beds&sel=health.staff.doctors");
  await ready(page);
  await expect(page.locator(toggle("health.facilities.beds"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(toggle("health.staff.doctors"))).toHaveCount(0);
});

test("doctor's assistants stop in 2011: the table shows a dash for 2015, not a zero (Review Focus 2)", async ({ page }) => {
  await page.goto("/en/explorer/health/doctors-hospitals");
  await ready(page);
  await page.locator(caret("health.staff.nurses")).click();
  await page.locator(toggle("health.staff.nurses_doctor_assistants")).click();
  await expect(page.locator(toggle("health.staff.nurses_doctor_assistants"))).toHaveAttribute("aria-pressed", "true");
  // A nested tick is counted apart; the top-level count stays.
  await expect(page.getByTestId("series-status")).toContainText("1 / 2");
  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  await expect(await cell(table, "Doctors’ assistants", 2015)).toHaveText("—");
  await expect(await cell(table, "Doctors’ assistants", 2011)).not.toHaveText("—");
  await expect(await cell(table, "Doctors", 2015)).not.toHaveText("—");
});

test("illnesses select the five largest disease groups under their two headings, and search keeps the count", async ({ page }) => {
  await page.goto("/explorer/health/illnesses");
  await ready(page);
  await expect(page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]')).toHaveCount(5);
  for (const id of ["respiratory", "eye", "musculoskeletal", "circulatory", "urogenital"]) await expect(page.locator(toggle(`health.illness.${id}`))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-status")).toContainText("5 / 25");
  await expect(page.getByTestId("series-heading")).toHaveText(["დაავადებათა ჯგუფები", "ცალკეული დაავადებები"]);
  await expect(page.getByTestId("health-latest")).toContainText("2025: 500.4 ათასი");
  await expect(page.getByTestId("chart-panel").getByTestId("chart-break")).toHaveCount(1);
  await page.getByTestId("series-search").fill("ტუბ");
  await expect(page.locator('[data-series-id="health.illness.tuberculosis"]')).toBeVisible();
  await expect(page.getByTestId("series-heading")).toHaveText(["ცალკეული დაავადებები"]);
  await expect(page.getByTestId("series-status")).toContainText("5 / 25");
});

test("the causes-of-death index maps the regions' death rate, leads with Georgia and opens a region's page", async ({ page }) => {
  await page.goto("/explorer/health/causes-of-death");
  await ready(page);
  await expect(page.getByTestId("health-latest")).toContainText("2025: 11.3");
  await expect(page.getByTestId("health-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/health/causes-of-death/regions/georgia");
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.racha_lechkhumi_kvemo_svaneti");
  await expect(rows.nth(1)).toContainText("19.7");
  // No chart workspace; the one source line is the map's footer.
  for (const id of ["chart-panel", "series-status", "health-excel-download", "source-label"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId("regional-source-note")).toContainText("geoBoundaries");
  await listRow(page, "region.guria").click();
  await expect(page).toHaveURL(/\/explorer\/health\/causes-of-death\/regions\/guria$/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("გურია");
  await expect(page.getByTestId("health-causes-of-death-link")).toHaveAttribute("aria-current", "page");
});

test("the Guria page: All deaths, the picker, previous and next, and no COVID-19 deaths before 2020 (Review Focus 5)", async ({ page }) => {
  await page.goto("/explorer/health/causes-of-death/regions/guria");
  await ready(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("სიკვდილის მიზეზები —");
  await expect(page.getByTestId("health-latest")).toContainText("· გურია");
  await expect(page.getByTestId("health-latest")).toContainText("1,567");
  await expect(page.locator(toggle("health.deaths.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-status")).toContainText("1 / 21");
  await expect(page.getByTestId("year-range-strip")).toContainText("2014–2025");
  await expect(page.locator('[data-testid^="health-view-"]')).toHaveCount(0);
  await page.getByTestId("region-picker-trigger").click();
  await expect(page.getByTestId("region-picker-option")).toHaveCount(12);
  await expect(page.getByTestId("region-picker-option").first()).toHaveText("საქართველო");
  await expect(page.getByTestId("region-picker-all-option")).toHaveAttribute("href", "/explorer/health/causes-of-death");
  await page.keyboard.press("Escape");
  const navigation = page.getByTestId("health-region-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← აჭარა", "იმერეთი →"]);
  await page.locator(toggle("health.deaths.covid19")).click();
  await expect(page).toHaveURL(/sel=health\.deaths\.total(,|%2C)health\.deaths\.covid19/);
  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  for (let year = 2014; year <= 2019; year++) await expect(await cell(table, "COVID-19", year)).toHaveText("—");
  await expect(await cell(table, "COVID-19", 2021)).not.toHaveText("—");
  await navigation.getByRole("link", { name: "იმერეთი →" }).click();
  await expect(page).toHaveURL(/\/explorer\/health\/causes-of-death\/regions\/imereti$/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("იმერეთი");
});

test("the language switch keeps the hash on Doctors and hospitals and on Guria", async ({ page }) => {
  await page.goto("/explorer/health/doctors-hospitals#tab=hospitals&view=table&start=2010&end=2020&sel=health.facilities.hospitals,health.facilities.outpatient_clinics");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/health\/doctors-hospitals#/);
  await ready(page);
  await expect(page.getByTestId("health-view-hospitals")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(toggle("health.facilities.outpatient_clinics"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2020");
  await page.goto("/explorer/health/causes-of-death/regions/guria#view=table&sel=health.deaths.total,health.deaths.circulatory");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/health\/causes-of-death\/regions\/guria#/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(toggle("health.deaths.circulatory"))).toHaveAttribute("aria-pressed", "true");
});

test("Excel downloads an .xlsx of the selection", async ({ page }) => {
  for (const path of ["/en/explorer/health/doctors-hospitals#start=2018&end=2025", "/en/explorer/health/causes-of-death/regions/guria"]) {
    await page.goto(path);
    await ready(page);
    const promise = page.waitForEvent("download"); await page.getByTestId("health-excel-download").click();
    const download = await promise;
    expect(download.suggestedFilename()).toMatch(/^fiscal-health-.+\.xlsx$/);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
    expect(workbook.worksheets).toHaveLength(3);
    // The Sources sheet links to the fiscal.ge archive copies of the Geostat workbooks.
    const links: string[] = [];
    workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toContain("/downloads/methodology/health/files/");
  }
});

for (const prefix of ["", "/en"]) test(`the methodology link opens the health methodology with its original files ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/health/illnesses`);
  await ready(page);
  await page.getByTestId("source-label").getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/health$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(prefix ? "Healthcare and causes of death" : "ჯანდაცვა და სიკვდილის მიზეზები");
  const archived = page.locator('a[href^="/downloads/methodology/health/files/"]');
  expect(await archived.count()).toBeGreaterThan(0);
  const response = await page.request.get(await archived.first().getAttribute("href") as string);
  expect(response.status()).toBe(200);
});

for (const prefix of ["", "/en"]) test(`health pages fit a 390px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["/explorer/health", "/explorer/health/doctors-hospitals", "/explorer/health/illnesses", "/explorer/health/causes-of-death", "/explorer/health/causes-of-death/regions/guria"]) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/health") await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
