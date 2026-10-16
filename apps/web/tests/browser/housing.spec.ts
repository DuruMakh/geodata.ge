import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";

const pressed = (id: string) => `[data-series-id="${id}"] [data-testid="series-row-toggle"]`;
const ticked = (page: Page) => page.locator('[data-testid="series-row-toggle"][aria-pressed="true"]');
const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");
const row = (page: Page, id: string) => page.locator(`[data-testid="regional-list-row"][data-region-id="${id}"]`);
const TOPICS = ["permits", "completed", "prices"];

/** The table cell of the row labelled `label` in the `year` column (the wide, year-columns layout). */
async function cell(page: Page, label: string, year: number) {
  const table = page.getByTestId("explorer-table");
  const column = (await table.locator("thead th").allInnerTexts()).findIndex(text => text.trim().startsWith(String(year)));
  expect(column).toBeGreaterThan(0);
  // The row label is the row's <th>, so value cells start one column earlier.
  return table.locator("tbody tr", { hasText: label }).locator("td").nth(column - 1);
}

test("the hub shows four cards, each opening its page", async ({ page }) => {
  await page.goto("/explorer/housing");
  const hub = page.getByTestId("housing-hub");
  await expect(hub.getByTestId("hub-card")).toHaveCount(4);
  expect(await hub.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual([...TOPICS, "regions"].map(section => `/explorer/housing/${section}`));
  await expect(page.getByTestId("housing-link")).toHaveAttribute("aria-current", "page");
});

test("permits selects all buildings by number, lists number and floor area under two headings, and keeps one unit", async ({ page }) => {
  await page.goto("/explorer/housing/permits");
  await ready(page);
  await expect(page.getByTestId("housing-latest")).toHaveText("ნებართვები · 2025: 11,578");
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed("housing.permits_count.total"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("series-heading")).toHaveText(["რაოდენობა", "ფართობი · ათასი მ²"]);
  // Every row is listed from the start: all buildings and the 17 building types under each heading.
  await expect(page.getByRole("group", { name: "რაოდენობა" }).locator('[data-testid="series-row"]')).toHaveCount(18);
  await expect(page.getByRole("group", { name: "ფართობი · ათასი მ²" }).locator('[data-testid="series-row"]')).toHaveCount(18);
  await expect(page.getByTestId("series-status")).toContainText("1 / 36");
  // No tab row or measure switch, and the one source line.
  await expect(page.locator('[data-testid^="housing-measure-"]')).toHaveCount(0);
  await expect(page.getByTestId("year-range-strip")).toContainText("2006–2025");
  await expect(page.getByTestId("source-label")).toContainText("საქსტატი");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "count");
  // Floor area reads in thousand m² to one decimal in the list.
  await expect(page.locator('[data-series-id="housing.permits_area.total"]')).toContainText("11,397.2");
  // Ticking a floor-area row replaces the number of permits.
  await page.locator(pressed("housing.permits_area.type_residential")).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed("housing.permits_area.type_residential"))).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "area");
  await expect(page.getByTestId("housing-unit-label")).toHaveText("ათასი მ²");
  await expect(page.getByTestId("housing-latest")).toContainText("11,578");
});

test("a building type Geostat published no column for is a dash in the table, never zero", async ({ page }) => {
  await page.goto("/explorer/housing/permits");
  await ready(page);
  await page.locator(pressed("housing.permits_count.type_preschool")).click();
  await expect(ticked(page)).toHaveCount(2);
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(await cell(page, "სკოლამდელი დაწესებულებები", 2008)).toHaveText("—");
  await expect(await cell(page, "სკოლამდელი დაწესებულებები", 2009)).toHaveText(/^\d[\d,]*$/);
});

test("prices: the index by default, and ticking a district under flats replaces it", async ({ page }) => {
  await page.goto("/explorer/housing/prices");
  await ready(page);
  await expect(page.getByTestId("housing-latest")).toContainText("159.4");
  await expect(page.getByTestId("housing-latest")).toHaveText("ფასების ინდექსი · 2025, IV კვ.: 159.4");
  await expect(page.getByTestId("series-heading")).toHaveText(["ფასების ინდექსი · 2020 = 100", "თბილისი, ახალი ბინები · ლარი 1 მ²\u2011ზე", "თბილისი, ახალი კერძო სახლები · ლარი 1 მ²\u2011ზე"]);
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.getByTestId("year-range-strip")).toContainText("2020–2025");
  await page.locator(pressed("housing.price_flat.district_vake")).click();
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.locator(pressed("housing.price_index.total"))).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "price");
  await expect(page.getByTestId("year-range-strip")).toContainText("2021–2025");
  // Flats and houses share a unit: the same district's house row joins the chart, dashed.
  await page.locator(pressed("housing.price_house.district_vake")).click();
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.getByTestId("chart-panel").locator('[data-testid="chart-series-housing.price_house.district_vake-dashed"]').first()).toHaveAttribute("stroke-dasharray", "6 5");
});

test("regions is the map and list with Georgia first, and a region opens its own page", async ({ page }) => {
  await page.goto("/explorer/housing/regions");
  await ready(page);
  await expect(page.getByTestId("housing-latest")).toHaveText("ნებართვები · თბილისი · 2025: 6.4 მლნ მ²");
  await expect(page.getByTestId("housing-region-map").getByTestId("regional-map-path")).toHaveCount(11);
  const rows = page.getByTestId("regional-list-row");
  await expect(rows).toHaveCount(12);
  await expect(rows.first()).toHaveAttribute("data-region-id", "georgia");
  await expect(rows.first()).toContainText("საქართველო");
  await expect(rows.first()).toHaveAttribute("href", "/explorer/housing/regions/georgia");
  await expect(rows.nth(1)).toHaveAttribute("data-region-id", "region.tbilisi");
  // The list reads bare numbers in thousand m², named by the legend and the source line.
  for (const text of await rows.allInnerTexts()) expect(text).toMatch(/\d[\d,]*\.\d/);
  for (const text of await rows.allInnerTexts()) expect(text).not.toContain("ათასი მ²");
  await expect(rows.first()).toContainText("11,397.2");
  await expect(page.getByTestId("regional-source-note")).toContainText("ათასი მ²");
  // No map switch and no chart workspace: the one source line is the index footer.
  await expect(page.locator('[data-testid^="housing-map-"]')).toHaveCount(0);
  for (const id of ["chart-panel", "series-status", "housing-excel-download", "source-label"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId("regional-source-note")).toContainText("geoBoundaries");
  await row(page, "region.guria").click();
  await expect(page).toHaveURL(/\/explorer\/housing\/regions\/guria$/);
  await ready(page);
  await expect(page.locator(pressed("housing.permits_count.region_guria"))).toHaveAttribute("aria-pressed", "true");
});

test("the Guria page: picker, neighbours carrying the selection, the language switch and Excel", async ({ page }) => {
  await page.goto("/explorer/housing/regions/guria");
  await ready(page);
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("საცხოვრებელი და მშენებლობა —");
  await expect(heading.getByTestId("region-picker-trigger")).toHaveText("გურია");
  await expect(page.getByTestId("housing-latest")).toHaveText("ნებართვები · 2025: 150 · გურია");
  // Four headings name what the rows count and the unit; each lists all buildings and residential buildings by their plain names.
  await expect(page.getByTestId("series-heading")).toHaveText(["მშენებლობის ნებართვები · რაოდენობა", "ექსპლუატაციაში მიღებული ობიექტები · რაოდენობა", "მშენებლობის ნებართვები · ფართობი, ათასი მ²", "ექსპლუატაციაში მიღებული ობიექტები · ფართობი, ათასი მ²"]);
  for (const group of await page.getByTestId("series-heading-group").all()) await expect(group.getByTestId("series-label")).toHaveText(["ყველა შენობა", "საცხოვრებელი შენობები"]);
  await expect(ticked(page)).toHaveCount(1);
  await expect(page.getByTestId("year-range-strip")).toContainText("2006–2025");
  // The picker lists Georgia first and returns to the index.
  await page.getByTestId("region-picker-trigger").click();
  await expect(page.getByTestId("region-picker-option")).toHaveCount(12);
  await expect(page.getByTestId("region-picker-option").first()).toHaveText("საქართველო");
  await expect(page.getByTestId("region-picker-all-option")).toHaveAttribute("href", "/explorer/housing/regions");
  await page.keyboard.press("Escape");
  const navigation = page.getByTestId("housing-region-navigation");
  await expect(navigation.getByRole("link")).toHaveText(["← აჭარა", "იმერეთი →"]);
  await expect(navigation.getByRole("link").last()).toHaveAttribute("href", "/explorer/housing/regions/imereti");
  // Ticking completed homes adds it (same unit); the next region's link carries the selection, moved to that region.
  await page.locator(pressed("housing.completed_count.region_guria_residential")).click();
  await expect(ticked(page)).toHaveCount(2);
  await expect(page).toHaveURL(/#view=line&sel=housing\.permits_count\.region_guria%2Chousing\.completed_count\.region_guria_residential/);
  await expect(navigation.getByRole("link").last()).toHaveAttribute("href", "/explorer/housing/regions/imereti#sel=housing.permits_count.region_imereti%2Chousing.completed_count.region_imereti_residential");
  const promise = page.waitForEvent("download");
  await page.getByTestId("housing-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-housing-guria-2006-2025\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  // The language switch keeps the selection.
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/housing\/regions\/guria#view=line&sel=housing\.permits_count\.region_guria%2Chousing\.completed_count\.region_guria_residential/);
  await ready(page);
  await expect(page.getByTestId("region-picker-trigger")).toHaveText("Guria");
  await expect(page.getByTestId("series-heading")).toHaveText(["Building permits · number", "Completed buildings · number", "Building permits · floor area, thousand m²", "Completed buildings · floor area, thousand m²"]);
  await expect(page.getByTestId("series-heading-group").first().getByTestId("series-label")).toHaveText(["All buildings", "Residential buildings"]);
  await expect(ticked(page)).toHaveCount(2);
  await page.getByTestId("housing-region-navigation").getByRole("link", { name: "Imereti →" }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/housing\/regions\/imereti#sel=housing\.permits_count\.region_imereti%2Chousing\.completed_count\.region_imereti_residential$/);
  await ready(page);
  await expect(page.locator(pressed("housing.completed_count.region_imereti_residential"))).toHaveAttribute("aria-pressed", "true");
});

test("the language switch keeps the selection, years and table mode on permits", async ({ page }) => {
  await page.goto("/explorer/housing/permits#view=table&start=2015&end=2025&sel=housing.permits_area.total,housing.permits_area.type_hotels");
  await ready(page);
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  const hash = new URL(page.url()).hash;
  expect(hash).toContain("view=table");
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/explorer\/housing\/permits#/);
  expect(new URL(page.url()).hash).toBe(hash);
  await ready(page);
  await expect(page.getByTestId("housing-latest")).toHaveText("Permits · 2025: 11,578");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-mode", "table");
  await expect(page.getByTestId("chart-panel")).toHaveAttribute("data-unit", "area");
  await expect(ticked(page)).toHaveCount(2);
  await expect(page.getByTestId("series-heading")).toHaveText(["Number", "Floor area · thousand m²"]);
});

test("the topic Excel download is a workbook", async ({ page }) => {
  await page.goto("/explorer/housing/completed");
  await ready(page);
  await expect(page.getByTestId("housing-latest")).toHaveText("ექსპლუატაციაში მიღებული · 2025: 3,393");
  const promise = page.waitForEvent("download");
  await page.getByTestId("housing-excel-download").click();
  const download = await promise;
  expect(download.suggestedFilename()).toMatch(/^fiscal-housing-completed-2006-2025\.xlsx$/);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile((await download.path())!);
  expect(workbook.worksheets).toHaveLength(3);
  // The Sources sheet links to the fiscal.ge archive copies of the Geostat workbooks.
  const links: string[] = [];
  workbook.worksheets[2].eachRow(row => row.eachCell(cell => { const value = cell.value as { hyperlink?: string } | null; if (value && typeof value === "object" && value.hyperlink) links.push(value.hyperlink); }));
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toContain("/downloads/methodology/housing/files/");
});

for (const prefix of ["", "/en"]) test(`the methodology link opens the housing methodology with its original files ${prefix || "ka"}`, async ({ page }) => {
  await page.goto(`${prefix}/explorer/housing/prices`);
  await ready(page);
  await page.getByTestId("source-label").getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${prefix}/methodology/housing$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(prefix ? "Housing and construction" : "საცხოვრებელი და მშენებლობა");
  await expect(page.locator("main")).toContainText(prefix ? "asking prices, not sale prices" : "შეთავაზების ფასებია და არა გაყიდვის ფასები");
  const archived = page.locator('a[href^="/downloads/methodology/housing/files/"]');
  expect(await archived.count()).toBeGreaterThan(0);
  const response = await page.request.get(await archived.first().getAttribute("href") as string);
  expect(response.status()).toBe(200);
});

for (const prefix of ["", "/en"]) test(`housing pages fit a 390px screen ${prefix || "ka"}`, async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["/explorer/housing", ...TOPICS.map(section => `/explorer/housing/${section}`), "/explorer/housing/regions", "/explorer/housing/regions/guria"]) {
    await page.goto(`${prefix}${path}`);
    if (path !== "/explorer/housing") await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
  expect(errors).toEqual([]);
});
