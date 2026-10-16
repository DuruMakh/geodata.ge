import { expect, test, type Locator, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const toggle = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const pressed = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const SECTIONS = ["recorded", "convictions", "prisons", "victims", "road-accidents"] as const;

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

test("recorded crimes select the total, mark the 2018 counting change and drop it on 2019–2025 (Review Focus 1)", async ({ page }) => {
  await page.goto("/en/explorer/crime/recorded");
  await ready(page);
  await expect(page.getByTestId("crime-latest")).toHaveText("Recorded crimes · 2025: 54,134");
  await expect(pressed(page)).toHaveCount(1);
  await expect(page.locator(toggle("crime.recorded.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-status")).toContainText("1 / 12");
  await expect(page.getByTestId("series-heading")).toHaveText(["Type of crime"]);
  await expect(page.getByTestId("crime-unit-label")).toHaveText("crimes");
  await expect(page.getByTestId("source-label")).toContainText("Source: Geostat, Ministry of Internal Affairs · crimes · 2015–2025");
  const breaks = page.getByTestId("chart-panel").getByTestId("chart-break");
  await expect(breaks).toHaveCount(1);
  await expect(breaks.first()).toContainText("new counting");
  await startAt(page, 2019);
  await expect(page).toHaveURL(/start=2019/);
  await expect(page.getByTestId("year-range-strip")).toContainText("2019–2025");
  await expect(breaks).toHaveCount(0);
  // The table marks 2018 when the range holds the year before it.
  await page.goto("/en/explorer/crime/recorded#view=table&start=2015&end=2025&sel=crime.recorded.total");
  await ready(page);
  await expect(page.getByTestId("explorer-table").locator("thead th", { hasText: "2018" })).toContainText("new counting");
});

test("the measure switch is two named icons, and per 100,000 people keeps the selection and the count headline", async ({ page }) => {
  await page.goto("/en/explorer/crime/recorded");
  await ready(page);
  await expect(page.locator('[data-testid^="crime-measure-"]')).toHaveCount(2);
  for (const [measure, name] of [["count", "Number"], ["per100k", "Per 100,000 people"]] as const) {
    await expect(page.getByTestId(`crime-measure-${measure}`)).toHaveAccessibleName(name);
    await expect(page.getByTestId(`crime-measure-${measure}`).locator("svg")).toHaveCount(1);
  }
  await expect(page.getByTestId("crime-measure-count")).toHaveAttribute("aria-pressed", "true");
  await page.locator(toggle("crime.recorded.property")).click();
  await page.getByTestId("crime-measure-per100k").click();
  await expect(page.getByTestId("crime-measure-per100k")).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/tab=per100k/);
  await expect(page.getByTestId("crime-unit-label")).toHaveText("per 100,000 people");
  await expect(pressed(page)).toHaveCount(2);
  for (const id of ["crime.recorded.total", "crime.recorded.property"]) await expect(page.locator(toggle(id))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("crime-latest")).toHaveText("Recorded crimes · 2025: 54,134");
  // The rates also cross the census recalculation of the 2025 population.
  await expect(page.getByTestId("chart-panel").getByTestId("chart-break")).toHaveCount(2);
});

test("convictions list four headings, and per 100,000 shows no rate before 2004 (Review Focus 2)", async ({ page }) => {
  await page.goto("/en/explorer/crime/convictions");
  await ready(page);
  await expect(page.getByTestId("crime-latest")).toHaveText("People convicted · 2025: 22,767");
  await expect(page.getByTestId("series-heading")).toHaveText(["Type of crime", "Age", "Sex", "Sentence"]);
  await page.goto("/en/explorer/crime/convictions#tab=per100k&view=table");
  await ready(page);
  await expect(page.getByTestId("year-range-strip")).toContainText("2001–2025");
  const table = page.getByTestId("explorer-table");
  for (const year of [2001, 2002, 2003]) await expect(await cell(table, "People convicted", year)).toHaveText("—");
  await expect(await cell(table, "People convicted", 2004)).toHaveText("230.4");
});

test("victims show nothing for 2012–2014 (Review Focus 3)", async ({ page }) => {
  await page.goto("/en/explorer/crime/victims");
  await ready(page);
  await expect(page.getByTestId("crime-latest")).toHaveText("Victims · 2025: 17,209");
  await page.locator(toggle("crime.victims.sex_women")).click();
  await page.getByTestId("chart-mode-table").click();
  const table = page.getByTestId("explorer-table");
  for (const year of [2012, 2013, 2014]) await expect(await cell(table, "Women", year)).toHaveText("—");
  await expect(await cell(table, "Women", 2011)).not.toHaveText("—");
  await expect(await cell(table, "Women", 2015)).not.toHaveText("—");
});

test("road accidents keep one unit: ticking People killed replaces Road accidents", async ({ page }) => {
  await page.goto("/en/explorer/crime/road-accidents");
  await ready(page);
  await expect(page.getByTestId("crime-latest")).toHaveText("Road accidents · 2025: 5,969 · 469 killed");
  await expect(page.getByTestId("series-heading")).toHaveText(["Accidents", "People"]);
  await expect(page.locator(toggle("crime.road.accidents"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("crime-unit-label")).toHaveText("accidents");
  await page.locator(toggle("crime.road.killed")).click();
  await expect(pressed(page)).toHaveCount(1);
  await expect(page.locator(toggle("crime.road.killed"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("crime-unit-label")).toHaveText("persons");
});

test("the language switch keeps the hash", async ({ page }) => {
  await page.goto("/explorer/crime/convictions#tab=per100k&view=table&start=2010&end=2020&sel=crime.convicted.total,crime.convicted.sex_women");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/crime\/convictions#/);
  await ready(page);
  await expect(page.getByTestId("crime-measure-per100k")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.locator(toggle("crime.convicted.sex_women"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("year-range-strip")).toContainText("2010–2020");
});

test("Excel downloads an .xlsx of the selection, citing the population table for rates", async ({ page }) => {
  for (const [path, rates] of [["/en/explorer/crime/prisons", false], ["/en/explorer/crime/prisons#tab=per100k", true]] as const) {
    await page.goto(path);
    await ready(page);
    const promise = page.waitForEvent("download"); await page.getByTestId("crime-excel-download").click();
    const download = await promise;
    expect(download.suggestedFilename()).toMatch(/^fiscal-crime-prisons.*\.xlsx$/);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
    expect(workbook.worksheets).toHaveLength(3);
    const links: string[] = [];
    workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
    expect(links.length).toBeGreaterThan(0);
    expect(links.some(link => link.includes("/downloads/methodology/demography/files/")), path).toBe(rates);
  }
});

for (const prefix of ["", "/en"]) test(`crime pages fit a 390px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["/explorer/crime", ...SECTIONS.map(section => `/explorer/crime/${section}`)]) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/crime") await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
